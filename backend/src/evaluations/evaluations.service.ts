import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { EvaluationJobStatus, Prisma, ProviderProtocol, UserRole } from "@prisma/client";
import { Readable } from "node:stream";
import { paginated, parsePagination } from "../common/pagination";
import type { Express } from "express";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EncryptionService } from "../common/encryption.service";
import { DATA_RETENTION } from "../legal/legal-documents";
import { PrismaService } from "../prisma/prisma.service";
import { FileStorageService } from "../storage/storage.service";
import {
  createReportSchema,
  EVALUATOR_SYSTEM_PROMPT,
  REPORT_STRUCTURE_INSTRUCTIONS,
  type ReportSchemaFieldDefinition,
  withReviewTimestamp,
} from "./evaluation.schema";
import { convertDocumentToMarkdown } from "./document-markdown";
import { ReportSchemaService } from "../report-schema/report-schema.service";
import { SystemPromptsService } from "../system-prompts/system-prompts.service";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";

interface EvaluationFields {
  classroomId?: string;
  studentId?: string;
  providerId?: string;
  apiKey?: string;
  modelId?: string;
}

function findNestedReportField(children: Prisma.JsonValue | null, key: string) {
  if (!Array.isArray(children)) return undefined;
  for (const candidate of children) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const child = candidate as Prisma.JsonObject;
    const childKey = child["key"];
    const label = child["label"];
    const description = child["description"];
    if (childKey === key && typeof label === "string" && typeof description === "string") {
      return { label, description };
    }
  }
  return undefined;
}

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly fileStorage: FileStorageService,
    private readonly reportSchema: ReportSchemaService,
    private readonly systemPrompts: SystemPromptsService,
    @InjectQueue(EVALUATION_QUEUE) private readonly evaluationQueue: Queue,
  ) {}

  async list(
    filters: {
      classroomId?: string;
      courseId?: string;
      studentId?: string;
      studentName?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    actor: AuthenticatedUser,
    page?: string,
    pageSize?: string,
  ) {
    const pagination = parsePagination(page, pageSize);
    if (actor.role === UserRole.STUDENT && filters.studentId && filters.studentId !== actor.id) {
      throw new ForbiddenException({ message: "No puedes consultar reportes de otro estudiante.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    const dateRange = this.parseDateRange(filters.dateFrom, filters.dateTo);
    const where: Prisma.EvaluationWhereInput = {
        ...(filters.classroomId ? { classroomId: filters.classroomId } : {}),
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(filters.search?.trim()
          ? { fileName: { contains: filters.search.trim(), mode: "insensitive" } }
          : {}),
        ...(filters.studentName?.trim()
          ? { student: { name: { contains: filters.studentName.trim(), mode: "insensitive" } } }
          : {}),
        ...(actor.role === UserRole.STUDENT
          ? { studentId: actor.id }
          : filters.studentId ? { studentId: filters.studentId } : {}),
        ...(actor.role === UserRole.INSTRUCTOR
          ? { classroom: { instructorId: actor.id, ...(filters.courseId ? { courseId: filters.courseId } : {}) } }
          : filters.courseId ? { classroom: { courseId: filters.courseId } } : {}),
      };
    const [records, total] = await Promise.all([
      this.prisma.evaluation.findMany({
        where,
        include: {
          student: { select: { name: true } },
          classroom: { select: { name: true, course: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.evaluation.count({ where }),
    ]);
    return paginated(
      records.map((record) => this.toDto(record)),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  async get(id: string, actor: AuthenticatedUser) {
    const record = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        student: { select: { name: true } },
        classroom: { select: { name: true, course: { select: { id: true, name: true } } } },
      },
    });
    if (!record) throw new NotFoundException({ message: "No se encontró la evaluación.", errors: ["EVALUATION_NOT_FOUND"] });
    if (actor.role === UserRole.STUDENT && record.studentId !== actor.id) {
      throw new ForbiddenException({ message: "No tienes acceso a esta evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    if (actor.role === UserRole.INSTRUCTOR) {
      const classroom = await this.prisma.classroom.findUnique({
        where: { id: record.classroomId },
        select: { instructorId: true },
      });
      if (classroom?.instructorId !== actor.id) {
        throw new ForbiddenException({ message: "No tienes acceso a esta evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
      }
    }
    return this.toDto(record);
  }

  async enqueue(
    file: Express.Multer.File | undefined,
    fields: EvaluationFields,
    actor: AuthenticatedUser,
    byok = false,
  ) {
    const classroomId = fields.classroomId?.trim();
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException({ message: "Solo estudiantes pueden enviar documentos para evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    if (!file || !classroomId) {
      throw new BadRequestException({ message: "El archivo y el aula son obligatorios.", errors: ["INVALID_EVALUATION"] });
    }

    const [classroom, student] = await Promise.all([
      this.prisma.classroom.findUnique({
        where: { id: classroomId },
        include: { config: { include: { provider: true, credential: true } } },
      }),
      this.prisma.user.findFirst({
        where: { id: actor.id, role: UserRole.STUDENT, classrooms: { some: { id: classroomId } } },
        select: { id: true },
      }),
    ]);
    if (!classroom || !student) {
      throw new NotFoundException({ message: "No se encontró el aula asignada.", errors: ["CLASSROOM_NOT_FOUND"] });
    }
    if (!classroom.isActive) {
      throw new BadRequestException({ message: "El aula está desactivada y no acepta evaluaciones.", errors: ["CLASSROOM_INACTIVE"] });
    }
    const activeCourse = await this.prisma.course.findFirst({
      where: { id: classroom.courseId, isActive: true },
      select: { id: true },
    });
    if (!activeCourse) {
      throw new BadRequestException({ message: "El curso está desactivado y no acepta evaluaciones.", errors: ["COURSE_INACTIVE"] });
    }
    if (!classroom.config) {
      throw new BadRequestException({ message: "El aula todavía no tiene una configuración de IA.", errors: ["CLASSROOM_CONFIG_MISSING"] });
    }
    const config = classroom.config;

    const provider = byok
      ? await this.prisma.provider.findUnique({ where: { id: fields.providerId ?? "" } })
      : config.provider;
    if (!provider) {
      throw new NotFoundException({ message: "No se encontró el proveedor de IA.", errors: ["PROVIDER_NOT_FOUND"] });
    }
    const storedEncryptedApiKey = config.credential?.encryptedKey;
    const apiKey = byok
      ? fields.apiKey?.trim()
      : storedEncryptedApiKey
        ? this.encryption.decrypt(storedEncryptedApiKey)
        : "";
    if (!apiKey) {
      throw new BadRequestException({
        message: byok ? "Se requiere una API key para continuar." : "El docente todavía no configuró una API key.",
        errors: [byok ? "BYOK_REQUIRED" : "PROVIDER_KEY_MISSING"],
      });
    }
    const encryptedApiKey = byok ? this.encryption.encrypt(apiKey) : storedEncryptedApiKey;
    if (!encryptedApiKey) {
      throw new BadRequestException({
        message: "El docente todavía no configuró una API key.",
        errors: ["PROVIDER_KEY_MISSING"],
      });
    }

    const configuredModels = byok
      ? fields.modelId?.trim() ? [fields.modelId.trim()] : []
      : config.selectedModels;
    if (!configuredModels.length) {
      throw new BadRequestException({ message: "El aula no tiene modelos habilitados.", errors: ["MODEL_NOT_CONFIGURED"] });
    }
    const modelId = configuredModels[0];
    if (!modelId) {
      throw new BadRequestException({ message: "El proveedor no tiene modelos configurados.", errors: ["MODEL_NOT_CONFIGURED"] });
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const fileKey = await this.fileStorage.saveDocument({
      classroomId,
      studentId: actor.id,
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });

    let reservation: {
      job: {
        id: string;
        status: EvaluationJobStatus;
        fileName: string;
        errorMessage: string;
        createdAt: Date;
      };
    };
    try {
      reservation = await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          SELECT 1
          FROM (
            SELECT pg_advisory_xact_lock(hashtext(${`${classroomId}:${actor.id}`}))
          ) AS reservation_lock
        `);
        const [legacyCompletedToday, acceptedJobsToday] = await Promise.all([
          transaction.evaluation.count({
            where: {
              classroomId,
              studentId: actor.id,
              jobId: null,
              createdAt: { gte: startOfDay },
            },
          }),
          transaction.evaluationJob.count({
            where: {
              classroomId,
              studentId: actor.id,
              createdAt: { gte: startOfDay },
              status: {
                in: [
                  EvaluationJobStatus.WAITING,
                  EvaluationJobStatus.PROCESSING,
                  EvaluationJobStatus.SUCCEEDED,
                ],
              },
            },
          }),
        ]);
        const usedToday = legacyCompletedToday + acceptedJobsToday;
        if (!byok && usedToday >= config.dailyLimit) {
          throw new ForbiddenException({
            message: "Alcanzaste el límite diario. Continúa con tu propia API key (BYOK).",
            errors: ["DAILY_LIMIT_REACHED"],
          });
        }
        const reservedModel = byok
          ? modelId
          : configuredModels[usedToday % configuredModels.length] ?? modelId;
        const job = await transaction.evaluationJob.create({
          data: {
            classroomId,
            studentId: actor.id,
            fileName: file.originalname,
            fileKey,
            isByok: byok,
            providerId: provider.id,
            modelId: reservedModel,
            encryptedApiKey,
          },
        });
        return { job };
      });
    } catch (error) {
      await this.fileStorage.deleteDocument(fileKey);
      if (error instanceof ForbiddenException) throw error;
      this.logger.error("Could not reserve an evaluation job.", error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException({
        message: "No se pudo reservar el intento de evaluación. Inténtalo nuevamente.",
        errors: ["EVALUATION_RESERVATION_UNAVAILABLE"],
      });
    }

    try {
      await this.evaluationQueue.add(
        "process-evaluation",
        { evaluationJobId: reservation.job.id },
        { jobId: reservation.job.id, attempts: 1, removeOnComplete: 1000, removeOnFail: false },
      );
    } catch (error) {
      await this.prisma.evaluationJob.update({
        where: { id: reservation.job.id },
        data: { status: EvaluationJobStatus.FAILED, errorMessage: "No se pudo poner la evaluación en cola.", encryptedApiKey: "" },
      });
      await this.fileStorage.deleteDocument(fileKey);
      this.logger.error("Could not enqueue an evaluation job.", error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException({
        message: "No se pudo iniciar la evaluación en este momento. Inténtalo nuevamente.",
        errors: ["EVALUATION_QUEUE_UNAVAILABLE"],
      });
    }

    return this.toJobDto(reservation.job);
  }

  async getActiveJob(actor: AuthenticatedUser) {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException({ message: "Solo estudiantes pueden consultar sus evaluaciones.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    const job = await this.prisma.evaluationJob.findFirst({
      where: {
        studentId: actor.id,
        status: { in: [EvaluationJobStatus.WAITING, EvaluationJobStatus.PROCESSING] },
      },
      orderBy: { createdAt: "desc" },
      include: { evaluation: { select: { id: true } } },
    });
    return job ? this.toJobDto(job) : null;
  }

  async getJob(id: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException({ message: "Solo estudiantes pueden consultar sus evaluaciones.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    const job = await this.prisma.evaluationJob.findFirst({
      where: { id, studentId: actor.id },
      include: { evaluation: { select: { id: true } } },
    });
    if (!job) throw new NotFoundException({ message: "No se encontró la evaluación en curso.", errors: ["EVALUATION_JOB_NOT_FOUND"] });
    return this.toJobDto(job);
  }

  async cleanupExpiredData() {
    const now = new Date();
    const sourceCutoff = new Date(now.getTime() - DATA_RETENTION.sourceDocumentDays * 24 * 60 * 60 * 1000);
    const reportCutoff = new Date(now);
    const originalDay = reportCutoff.getUTCDate();
    reportCutoff.setUTCDate(1);
    reportCutoff.setUTCMonth(reportCutoff.getUTCMonth() - DATA_RETENTION.evaluationReportMonths);
    const lastDayOfCutoffMonth = new Date(Date.UTC(
      reportCutoff.getUTCFullYear(),
      reportCutoff.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    reportCutoff.setUTCDate(Math.min(originalDay, lastDayOfCutoffMonth));

    const terminalStatuses = [EvaluationJobStatus.SUCCEEDED, EvaluationJobStatus.FAILED];
    const batchSize = 500;
    let documentsDeleted = 0;
    let sourceFailures = 0;
    let sourceCursor = "";

    while (true) {
      const expiredSources = await this.prisma.evaluationJob.findMany({
        where: {
          ...(sourceCursor ? { id: { gt: sourceCursor } } : {}),
          status: { in: terminalStatuses },
          updatedAt: { lte: sourceCutoff },
          OR: [
            { fileKey: { not: "" } },
            { evaluation: { is: { fileKey: { not: "" } } } },
          ],
        },
        include: { evaluation: { select: { fileKey: true } } },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (expiredSources.length === 0) break;

      for (const job of expiredSources) {
        try {
          const keys = new Set([job.fileKey, job.evaluation?.fileKey ?? ""].filter(Boolean));
          for (const key of keys) await this.fileStorage.deleteDocument(key);
          await this.prisma.$transaction([
            this.prisma.evaluation.updateMany({
              where: { jobId: job.id },
              data: { fileKey: "" },
            }),
            this.prisma.evaluationJob.updateMany({
              where: { id: job.id, fileKey: { not: "" } },
              data: { fileKey: "" },
            }),
          ]);
          documentsDeleted += keys.size;
        } catch (error) {
          sourceFailures += 1;
          this.logger.error(
            `Could not apply source-document retention for evaluation job ${job.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      sourceCursor = expiredSources[expiredSources.length - 1]?.id ?? sourceCursor;
      if (expiredSources.length < batchSize) break;
    }

    let reportsDeleted = 0;
    let reportFailures = 0;
    let reportCursor = "";

    while (true) {
      const expiredReports = await this.prisma.evaluation.findMany({
        where: {
          ...(reportCursor ? { id: { gt: reportCursor } } : {}),
          createdAt: { lte: reportCutoff },
          OR: [
            { jobId: null },
            { job: { is: { status: { in: terminalStatuses } } } },
          ],
        },
        include: { job: { select: { id: true, fileKey: true } } },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (expiredReports.length === 0) break;

      for (const evaluation of expiredReports) {
        try {
          const keys = new Set([evaluation.fileKey, evaluation.job?.fileKey ?? ""].filter(Boolean));
          for (const key of keys) await this.fileStorage.deleteDocument(key);
          await this.prisma.$transaction(async (transaction) => {
            if (evaluation.job) {
              await transaction.evaluationJob.deleteMany({
                where: { id: evaluation.job.id, status: { in: terminalStatuses } },
              });
            }
            await transaction.evaluation.deleteMany({
              where: { id: evaluation.id, createdAt: { lte: reportCutoff } },
            });
          });
          reportsDeleted += 1;
        } catch (error) {
          reportFailures += 1;
          this.logger.error(
            `Could not apply report-retention policy for evaluation ${evaluation.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      reportCursor = expiredReports[expiredReports.length - 1]?.id ?? reportCursor;
      if (expiredReports.length < batchSize) break;
    }

    let jobsDeleted = 0;
    let jobFailures = 0;
    let jobCursor = "";

    while (true) {
      const expiredJobsWithoutReport = await this.prisma.evaluationJob.findMany({
        where: {
          ...(jobCursor ? { id: { gt: jobCursor } } : {}),
          status: { in: terminalStatuses },
          createdAt: { lte: reportCutoff },
          evaluation: { is: null },
        },
        select: { id: true, fileKey: true },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (expiredJobsWithoutReport.length === 0) break;

      for (const job of expiredJobsWithoutReport) {
        try {
          if (job.fileKey) await this.fileStorage.deleteDocument(job.fileKey);
          await this.prisma.evaluationJob.deleteMany({
            where: {
              id: job.id,
              status: { in: terminalStatuses },
              createdAt: { lte: reportCutoff },
              evaluation: { is: null },
            },
          });
          jobsDeleted += 1;
        } catch (error) {
          jobFailures += 1;
          this.logger.error(
            `Could not apply metadata-retention policy for evaluation job ${job.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      jobCursor = expiredJobsWithoutReport[expiredJobsWithoutReport.length - 1]?.id ?? jobCursor;
      if (expiredJobsWithoutReport.length < batchSize) break;
    }

    this.logger.log(
      `Retention cleanup finished: ${documentsDeleted} source documents, ${reportsDeleted} reports, ${jobsDeleted} job records deleted; ${sourceFailures + reportFailures + jobFailures} failures.`,
    );
    return {
      sourceDocumentsDeleted: documentsDeleted,
      sourceDocumentFailures: sourceFailures,
      reportsDeleted,
      reportFailures,
      jobsDeleted,
      jobFailures,
    };
  }

  async processJob(jobId: string) {
    const job = await this.prisma.evaluationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ message: "No se encontró el trabajo de evaluación.", errors: ["EVALUATION_JOB_NOT_FOUND"] });

    const existing = await this.prisma.evaluation.findUnique({ where: { jobId } });
    if (existing) {
      await this.prisma.evaluationJob.update({
        where: { id: jobId },
        data: { status: EvaluationJobStatus.SUCCEEDED, encryptedApiKey: "" },
      });
      return;
    }

    await this.prisma.evaluationJob.update({ where: { id: jobId }, data: { status: EvaluationJobStatus.PROCESSING } });
    try {
      const buffer = await this.fileStorage.getDocument(job.fileKey);
      const student = await this.prisma.user.findUnique({
        where: { id: job.studentId },
        select: { email: true },
      });
      if (!student) throw new NotFoundException({ message: "No se encontró al estudiante.", errors: ["STUDENT_NOT_FOUND"] });
      await this.submit(
        {
          fieldname: "file",
          originalname: job.fileName,
          encoding: "7bit",
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          stream: Readable.from(buffer),
          destination: "",
          filename: job.fileName,
          path: "",
          size: buffer.byteLength,
          buffer,
        },
        {
          classroomId: job.classroomId,
          providerId: job.providerId,
          apiKey: this.encryption.decrypt(job.encryptedApiKey),
          modelId: job.modelId,
        },
        { id: job.studentId, email: student.email, role: UserRole.STUDENT, sessionId: "evaluation-worker" },
        job.isByok,
        job.id,
        job.fileKey,
      );
      await this.prisma.evaluationJob.update({
        where: { id: jobId },
        data: { status: EvaluationJobStatus.SUCCEEDED, encryptedApiKey: "" },
      });
    } catch (error) {
      this.logger.error(`Evaluation job ${jobId} failed.`, error instanceof Error ? error.stack : undefined);
      await this.prisma.evaluationJob.update({
        where: { id: jobId },
        data: {
          status: EvaluationJobStatus.FAILED,
          errorMessage: this.getJobErrorMessage(error),
          encryptedApiKey: "",
        },
      });
      throw error;
    }
  }

  private toJobDto(job: {
    id: string;
    status: EvaluationJobStatus;
    fileName: string;
    errorMessage: string;
    createdAt: Date;
    evaluation?: { id: string } | null;
  }) {
    return {
      id: job.id,
      status: job.status,
      fileName: job.fileName,
      errorMessage: job.errorMessage,
      evaluationId: job.evaluation?.id ?? null,
      createdAt: job.createdAt,
    };
  }

  private getJobErrorMessage(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "string") return response;
      if (typeof response === "object" && response !== null && "message" in response) {
        const message = response.message;
        if (typeof message === "string") return message;
        if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
          return message.join(" ");
        }
      }
    }
    return "No se pudo completar la evaluación. Revisa la configuración del aula e inténtalo nuevamente.";
  }

  async preview(file: Express.Multer.File | undefined, fields: EvaluationFields, actor: AuthenticatedUser) {
    const classroomId = fields.classroomId?.trim();
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException({ message: "Solo estudiantes pueden previsualizar documentos de evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    if (!file || !classroomId) {
      throw new BadRequestException({ message: "El archivo y el aula son obligatorios.", errors: ["INVALID_EVALUATION"] });
    }

    const [classroom, student] = await Promise.all([
      this.prisma.classroom.findUnique({ where: { id: classroomId }, select: { id: true, isActive: true, courseId: true } }),
      this.prisma.user.findFirst({
        where: { id: actor.id, role: UserRole.STUDENT, classrooms: { some: { id: classroomId } } },
        select: { id: true },
      }),
    ]);
    if (!classroom || !student) {
      throw new NotFoundException({ message: "No se encontró el aula asignada.", errors: ["CLASSROOM_NOT_FOUND"] });
    }
    if (!classroom.isActive) {
      throw new BadRequestException({ message: "El aula está desactivada y no acepta evaluaciones.", errors: ["CLASSROOM_INACTIVE"] });
    }
    const activeCourse = await this.prisma.course.findFirst({
      where: { id: classroom.courseId, isActive: true },
      select: { id: true },
    });
    if (!activeCourse) {
      throw new BadRequestException({ message: "El curso está desactivado y no acepta evaluaciones.", errors: ["COURSE_INACTIVE"] });
    }

    let text: string;
    try {
      text = await convertDocumentToMarkdown(file.buffer);
    } catch {
      throw new BadRequestException({
        message: "No se pudo leer el documento .docx. Verifica que el archivo no esté dañado.",
        errors: ["INVALID_DOCX"],
      });
    }
    if (!text) {
      throw new BadRequestException({ message: "El documento no contiene texto evaluable.", errors: ["EMPTY_DOCUMENT"] });
    }

    return {
      fileName: file.originalname,
      characterCount: text.length,
      convertedText: text,
    };
  }

  async submit(
    file: Express.Multer.File | undefined,
    fields: EvaluationFields,
    actor: AuthenticatedUser,
    byok = false,
    reservedJobId?: string,
    reservedFileKey?: string,
  ) {
    const classroomId = fields.classroomId?.trim();
    const studentId = actor.id;
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException({ message: "Solo estudiantes pueden enviar documentos para evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    if (!file || !classroomId || !studentId) {
      throw new BadRequestException({
        message: "El archivo, el aula y el estudiante son obligatorios.",
        errors: ["INVALID_EVALUATION"],
      });
    }

    const [classroom, student] = await Promise.all([
      this.prisma.classroom.findUnique({
        where: { id: classroomId },
        include: { config: { include: { provider: true, credential: true } } },
      }),
      this.prisma.user.findFirst({
        where: {
          id: studentId,
          role: UserRole.STUDENT,
          classrooms: { some: { id: classroomId } },
        },
      }),
    ]);
    if (!classroom) throw new NotFoundException({ message: "No se encontró el aula.", errors: ["CLASSROOM_NOT_FOUND"] });
    if (!classroom.isActive) throw new BadRequestException({ message: "El aula está desactivada y no acepta evaluaciones.", errors: ["CLASSROOM_INACTIVE"] });
    const activeCourse = await this.prisma.course.findFirst({
      where: { id: classroom.courseId, isActive: true },
      select: { id: true },
    });
    if (!activeCourse) throw new BadRequestException({ message: "El curso está desactivado y no acepta evaluaciones.", errors: ["COURSE_INACTIVE"] });
    if (!student) throw new BadRequestException({ message: "El estudiante no pertenece al aula.", errors: ["STUDENT_NOT_IN_CLASSROOM"] });
    if (!classroom.config) throw new BadRequestException({ message: "El aula todavía no tiene una configuración de IA.", errors: ["CLASSROOM_CONFIG_MISSING"] });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const usedToday = await this.prisma.evaluation.count({
      where: { classroomId, studentId, createdAt: { gte: startOfDay } },
    });
    if (!byok && !reservedJobId && usedToday >= classroom.config.dailyLimit) {
      throw new ForbiddenException({
        message: "Alcanzaste el límite diario. Continúa con tu propia API key (BYOK).",
        errors: ["DAILY_LIMIT_REACHED"],
      });
    }

    const provider = fields.providerId
      ? await this.prisma.provider.findUnique({ where: { id: fields.providerId } })
      : classroom.config.provider;
    if (!provider) throw new NotFoundException({ message: "No se encontró el proveedor de IA.", errors: ["PROVIDER_NOT_FOUND"] });
    const apiKey = fields.apiKey?.trim() ?? (classroom.config.credential?.encryptedKey
        ? this.encryption.decrypt(classroom.config.credential.encryptedKey)
        : "");
    if (!apiKey) {
      throw new BadRequestException({
        message: byok ? "Se requiere una API key para continuar." : "El docente todavía no configuró una API key.",
        errors: [byok ? "BYOK_REQUIRED" : "PROVIDER_KEY_MISSING"],
      });
    }

    let extractedText: string;
    try {
      extractedText = await convertDocumentToMarkdown(file.buffer);
    } catch {
      throw new BadRequestException({
        message: "No se pudo leer el documento .docx. Verifica que el archivo no esté dañado.",
        errors: ["INVALID_DOCX"],
      });
    }
    if (!extractedText) {
      throw new BadRequestException({ message: "El documento no contiene texto evaluable.", errors: ["EMPTY_DOCUMENT"] });
    }
    const selectedModels = fields.modelId?.trim()
      ? [fields.modelId.trim()]
      : byok
        ? []
      : classroom.config.selectedModels;
    if (!selectedModels.length) {
      throw new BadRequestException({ message: "El aula no tiene modelos habilitados.", errors: ["MODEL_NOT_CONFIGURED"] });
    }
    const configuredModel = reservedJobId || byok
      ? selectedModels[0]
      : selectedModels[usedToday % selectedModels.length];
    if (!configuredModel) {
      throw new BadRequestException({ message: "El proveedor no tiene modelos configurados.", errors: ["MODEL_NOT_CONFIGURED"] });
    }
    const { model, modelId } = this.createModel(provider.protocol, provider.baseUrl, configuredModel, apiKey);
    const allSchemaFields = await this.reportSchema.list();
    const activeSchemaFields = allSchemaFields.filter((field) => field.isActive);
    const configuredFieldKeys = new Set(classroom.config.selectedReportFields);
    const schemaFields = configuredFieldKeys.size
      ? activeSchemaFields.filter((field) => configuredFieldKeys.has(field.key))
      : activeSchemaFields;
    const enabledFieldKeys = new Set(schemaFields.map((field) => field.key));
    const formattedUserPrompt = classroom.config.userPrompt.replace(
      /\{\{field:([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?)\}\}/g,
      (_token, key: string) => {
        const [fieldKey, childKey] = key.split(".");
        const field = allSchemaFields.find((candidate) => candidate.key === fieldKey);
        if (!field) {
          throw new BadRequestException({
            message: "Las instrucciones del docente contienen una referencia de campo no válida.",
            errors: ["INVALID_REPORT_PILL"],
          });
        }
        const child = childKey ? findNestedReportField(field.children, childKey) : undefined;
        if (childKey && !child) {
          throw new BadRequestException({
            message: "Las instrucciones del docente contienen una referencia de propiedad no válida.",
            errors: ["INVALID_REPORT_PILL"],
          });
        }
        const label = child?.label ?? field.label;
        const description = child?.description ?? field.description;
        return field.isActive && enabledFieldKeys.has(field.key)
          ? `campo "${label}" (clave "${key}"; ${description}) de la sección "${field.label}"`
          : `sección "${field.label}" desactivada; no incluyas este campo en el reporte`;
      },
    );
    if (/\{\{field:[^}]*\}\}/.test(formattedUserPrompt)) {
      throw new BadRequestException({
        message: "Las instrucciones del docente contienen una referencia de campo con formato no válido.",
        errors: ["INVALID_REPORT_PILL"],
      });
    }
    const outputSchema = createReportSchema(schemaFields.map((field): ReportSchemaFieldDefinition => ({
      key: field.key,
      type: field.type,
      description: field.description,
      options: field.options,
      children: field.children,
      isRequired: field.isRequired,
    })));
    const activeSystemPrompt = await this.systemPrompts.getActive();
    const reportFieldInstructions = schemaFields.map((field) => {
      const children = Array.isArray(field.children)
        ? field.children.map((child) => {
            if (!child || typeof child !== "object" || Array.isArray(child)) return "";
            const property = child as Prisma.JsonObject;
            const key = property["key"];
            const label = property["label"];
            const description = property["description"];
            if (typeof key !== "string" || typeof label !== "string" || typeof description !== "string") return "";
            return `  - ${key} (${label}): ${description}`;
          }).filter(Boolean)
        : [];
      return `- ${field.key} (${field.label}; ${field.type}; ${field.isRequired ? "obligatorio" : "opcional"}): ${field.description}${children.length ? `\n${children.join("\n")}` : ""}`;
    }).join("\n");
    const result = await generateObject({
      model,
      schema: outputSchema,
      system: [
        `Instrucciones institucionales activas (versión ${activeSystemPrompt.version}):\n${activeSystemPrompt.instructions}`,
        EVALUATOR_SYSTEM_PROMPT,
        REPORT_STRUCTURE_INSTRUCTIONS,
        `Estructura JSON exacta del reporte:\n${reportFieldInstructions}`,
      ].join("\n\n"),
      prompt: [
        `Instrucciones adicionales del docente:\n${formattedUserPrompt || "Aplica la rúbrica con criterio académico."}`,
        `Rúbrica del aula:\n${classroom.config.rubricText || "Evalúa claridad, rigor metodológico, sustento y redacción académica."}`,
        `Documento del estudiante (${file.originalname}):\n${extractedText}`,
      ].join("\n\n"),
    });
    const report = withReviewTimestamp(result.object);

    const fileKey = reservedFileKey ?? await this.fileStorage.saveDocument({
      classroomId,
      studentId,
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });
    const record = await this.prisma.evaluation.create({
      data: {
        classroomId,
        studentId,
        fileName: file.originalname,
        fileKey,
        provider: provider.name,
        model: modelId,
        report: JSON.parse(JSON.stringify(report)) as Prisma.InputJsonValue,
        systemPromptVersionId: activeSystemPrompt.id,
        ...(reservedJobId ? { jobId: reservedJobId } : {}),
      },
      include: {
        student: { select: { name: true } },
        classroom: { select: { name: true, course: { select: { id: true, name: true } } } },
      },
    });
    return this.toDto(record);
  }

  private createModel(protocol: ProviderProtocol, baseUrl: string, configuredModel: string, apiKey: string): { model: LanguageModelV2; modelId: string } {
    if (protocol === ProviderProtocol.OPENAI_COMPATIBLE) {
      return { model: createOpenAI({ apiKey, baseURL: baseUrl })(configuredModel), modelId: configuredModel };
    }
    if (protocol === ProviderProtocol.ANTHROPIC) {
      return { model: createAnthropic({ apiKey, baseURL: baseUrl })(configuredModel), modelId: configuredModel };
    }
    if (protocol === ProviderProtocol.GEMINI) {
      return { model: createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })(configuredModel), modelId: configuredModel };
    }
    throw new BadRequestException({
      message: "El protocolo configurado no es compatible.",
      errors: ["UNSUPPORTED_PROVIDER_PROTOCOL"],
    });
  }

  private parseDateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    if ((dateFrom && !isDateOnly(dateFrom)) || (dateTo && !isDateOnly(dateTo))) {
      throw new BadRequestException({ message: "El rango de fechas no es válido.", errors: ["INVALID_DATE_RANGE"] });
    }

    const parseDate = (value: string) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
        ? date
        : undefined;
    };
    const gte = dateFrom ? parseDate(dateFrom) : undefined;
    const lt = dateTo ? parseDate(dateTo) : undefined;
    if (dateFrom && !gte || dateTo && !lt) {
      throw new BadRequestException({ message: "El rango de fechas no es válido.", errors: ["INVALID_DATE_RANGE"] });
    }
    if (gte && lt && gte > lt) {
      throw new BadRequestException({ message: "La fecha inicial debe ser anterior a la fecha final.", errors: ["INVALID_DATE_RANGE"] });
    }
    if (lt) lt.setUTCDate(lt.getUTCDate() + 1);
    return { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
  }

  private toDto(record: {
    id: string;
    classroomId: string;
    studentId: string;
    fileName: string;
    fileKey: string;
    provider: string;
    model: string;
    report: Prisma.JsonValue;
    createdAt: Date;
    student: { name: string };
    classroom: { name: string; course: { id: string; name: string } };
  }) {
    return {
      id: record.id,
      classroomId: record.classroomId,
      classroomName: record.classroom.name,
      courseId: record.classroom.course.id,
      courseName: record.classroom.course.name,
      studentId: record.studentId,
      studentName: record.student.name,
      fileName: record.fileName,
      fileKey: record.fileKey,
      providerName: record.provider,
      model: record.model,
      createdAt: record.createdAt,
      report: record.report,
    };
  }
}

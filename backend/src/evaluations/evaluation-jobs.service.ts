import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { EvaluationJobStatus, Prisma, UserRole } from "@prisma/client";
import { Readable } from "node:stream";
import type { Express } from "express";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EncryptionService } from "../common/encryption.service";
import { PrismaService } from "../prisma/prisma.service";
import { FileStorageService } from "../storage/storage.service";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";
import { EvaluationStatusPublisher } from "./evaluation-status.publisher";
import { EvaluationsService } from "./evaluations.service";
import type { EvaluationFields } from "./evaluation.types";

@Injectable()
export class EvaluationJobsService {
  private readonly logger = new Logger(EvaluationJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly fileStorage: FileStorageService,
    private readonly evaluations: EvaluationsService,
    private readonly statusPublisher: EvaluationStatusPublisher,
    @InjectQueue(EVALUATION_QUEUE) private readonly evaluationQueue: Queue,
  ) {}

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
        include: {
          course: { select: { isActive: true } },
          config: { include: { provider: true, credential: true } },
        },
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
    if (!classroom.course.isActive) {
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
            SELECT pg_advisory_xact_lock(hashtext(${"evaluation-student:" + actor.id}))
          ) AS reservation_lock
        `);
        const activeJob = await transaction.evaluationJob.findFirst({
          where: {
            studentId: actor.id,
            status: { in: [EvaluationJobStatus.WAITING, EvaluationJobStatus.PROCESSING] },
          },
          select: { id: true },
        });
        if (activeJob) {
          throw new ConflictException({
            message: "Ya tienes una evaluación en proceso. Espera a que termine antes de subir otro documento.",
            errors: ["EVALUATION_JOB_IN_PROGRESS"],
          });
        }
        const [usage] = await transaction.$queryRaw<Array<{ usedToday: bigint }>>(Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)
              FROM "Evaluation"
              WHERE "classroomId" = ${classroomId}
                AND "studentId" = ${actor.id}
                AND "jobId" IS NULL
                AND "createdAt" >= ${startOfDay}
            ) + (
              SELECT COUNT(*)
              FROM "EvaluationJob"
              WHERE "classroomId" = ${classroomId}
                AND "studentId" = ${actor.id}
                AND "createdAt" >= ${startOfDay}
                AND "status" IN (${Prisma.join([
                  EvaluationJobStatus.WAITING,
                  EvaluationJobStatus.PROCESSING,
                  EvaluationJobStatus.SUCCEEDED,
                ])})
            ) AS "usedToday"
        `);
        const usedToday = Number(usage?.usedToday ?? 0n);
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
      if (error instanceof ForbiddenException || error instanceof ConflictException) throw error;
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

    await this.statusPublisher.publish({
      studentId: actor.id,
      ...reservation.job,
      evaluationId: null,
    });
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

  async processJob(jobId: string) {
    const job = await this.prisma.evaluationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ message: "No se encontró el trabajo de evaluación.", errors: ["EVALUATION_JOB_NOT_FOUND"] });

    const existing = await this.prisma.evaluation.findUnique({ where: { jobId } });
    if (existing) {
      const completed = await this.prisma.evaluationJob.update({
        where: { id: jobId },
        data: { status: EvaluationJobStatus.SUCCEEDED, encryptedApiKey: "" },
      });
      await this.statusPublisher.publish({ ...completed, evaluationId: existing.id });
      return;
    }

    const processing = await this.prisma.evaluationJob.update({
      where: { id: jobId },
      data: { status: EvaluationJobStatus.PROCESSING },
    });
    await this.statusPublisher.publish({ ...processing, evaluationId: null });
    try {
      const buffer = await this.fileStorage.getDocument(job.fileKey);
      const student = await this.prisma.user.findUnique({
        where: { id: job.studentId },
        select: { email: true },
      });
      if (!student) throw new NotFoundException({ message: "No se encontró al estudiante.", errors: ["STUDENT_NOT_FOUND"] });
      const evaluation = await this.evaluations.submit(
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
      const completed = await this.prisma.evaluationJob.update({
        where: { id: jobId },
        data: { status: EvaluationJobStatus.SUCCEEDED, encryptedApiKey: "" },
      });
      await this.statusPublisher.publish({ ...completed, evaluationId: evaluation.id });
    } catch (error) {
      this.logger.error(`Evaluation job ${jobId} failed.`, error instanceof Error ? error.stack : undefined);
      const failed = await this.prisma.evaluationJob.update({
        where: { id: jobId },
        data: {
          status: EvaluationJobStatus.FAILED,
          errorMessage: this.getJobErrorMessage(error),
          encryptedApiKey: "",
        },
      });
      await this.statusPublisher.publish({ ...failed, evaluationId: null });
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
}

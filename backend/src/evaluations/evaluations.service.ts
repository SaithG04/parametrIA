import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { Prisma, ProviderProtocol, UserRole } from "@prisma/client";
import type { Express } from "express";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EncryptionService } from "../common/encryption.service";
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
import type { EvaluationFields } from "./evaluation.types";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly fileStorage: FileStorageService,
    private readonly reportSchema: ReportSchemaService,
    private readonly systemPrompts: SystemPromptsService,
  ) {}

  async preview(file: Express.Multer.File | undefined, fields: EvaluationFields, actor: AuthenticatedUser) {
    const classroomId = fields.classroomId?.trim();
    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException({ message: "Solo estudiantes pueden previsualizar documentos de evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    if (!file || !classroomId) {
      throw new BadRequestException({ message: "El archivo y el aula son obligatorios.", errors: ["INVALID_EVALUATION"] });
    }

    const [classroom, student] = await Promise.all([
      this.prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { id: true, isActive: true, course: { select: { isActive: true } } },
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
        include: {
          course: { select: { isActive: true } },
          config: { include: { provider: true, credential: true } },
        },
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
    if (!classroom.course.isActive) throw new BadRequestException({ message: "El curso está desactivado y no acepta evaluaciones.", errors: ["COURSE_INACTIVE"] });
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

  toDto(record: {
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

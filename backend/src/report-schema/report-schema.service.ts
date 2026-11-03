import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ReportSchemaFieldType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportSchemaFieldDefinition } from "../evaluations/evaluation.schema";

interface NestedFieldInput extends ReportSchemaFieldDefinition {
  label: string;
  options?: string[];
  isRequired?: boolean;
}

export interface ReportFieldInput extends NestedFieldInput {
  children?: NestedFieldInput[];
  isActive?: boolean;
  sortOrder?: number;
}

const fieldTypes = new Set<string>(Object.values(ReportSchemaFieldType));
const keyPattern = /^[a-z][a-z0-9_]*$/;
const reservedKeys = new Set([
  "overallScore",
  "summary",
  "sections",
  "recommendations",
  "providerName",
  "model",
  "ficha",
  "tabla_verificacion",
  "resumen_cumplimiento",
  "fortalezas",
  "coherencia_interna",
  "trazabilidad_citas_referencias",
  "observaciones_complementarias",
  "conclusion",
]);

@Injectable()
export class ReportSchemaService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.reportSchemaField.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  listActive() {
    return this.prisma.reportSchemaField.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(input: ReportFieldInput) {
    this.validate(input);
    try {
      return await this.prisma.reportSchemaField.create({ data: this.toData(input) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ message: "Ya existe un campo con esa clave.", errors: ["REPORT_FIELD_KEY_EXISTS"] });
      }
      throw error;
    }
  }

  async update(id: string, input: ReportFieldInput) {
    this.validate(input);
    const existing = await this.prisma.reportSchemaField.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ message: "No se encontró el campo del reporte.", errors: ["REPORT_FIELD_NOT_FOUND"] });
    try {
      return await this.prisma.reportSchemaField.update({ where: { id }, data: this.toData(input) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ message: "Ya existe un campo con esa clave.", errors: ["REPORT_FIELD_KEY_EXISTS"] });
      }
      throw error;
    }
  }

  async setStatus(id: string, isActive: boolean) {
    if (typeof isActive !== "boolean") {
      throw new BadRequestException({ message: "El estado del campo no es válido.", errors: ["INVALID_REPORT_FIELD_STATUS"] });
    }
    const field = await this.prisma.reportSchemaField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException({ message: "No se encontró el campo del reporte.", errors: ["REPORT_FIELD_NOT_FOUND"] });
    if (field.isActive && !isActive) {
      const activeCount = await this.prisma.reportSchemaField.count({ where: { isActive: true } });
      if (activeCount <= 1) {
        throw new BadRequestException({ message: "El reporte debe conservar al menos un campo activo.", errors: ["REPORT_SCHEMA_REQUIRES_FIELD"] });
      }
    }
    return this.prisma.reportSchemaField.update({ where: { id }, data: { isActive } });
  }

  private validate(input: ReportFieldInput) {
    if (
      typeof input.key !== "string" ||
      !keyPattern.test(input.key) ||
      reservedKeys.has(input.key) ||
      typeof input.label !== "string" ||
      !input.label.trim() ||
      typeof input.description !== "string" ||
      !input.description.trim()
    ) {
      throw new BadRequestException({
        message: "La clave debe usar minúsculas, números o guion bajo, y el nombre y la descripción son obligatorios.",
        errors: ["INVALID_REPORT_FIELD"],
      });
    }
    if (typeof input.type !== "string" || !fieldTypes.has(input.type)) {
      throw new BadRequestException({ message: "Selecciona un tipo de dato válido.", errors: ["INVALID_REPORT_FIELD_TYPE"] });
    }
    if (input.type === "ENUM" && (
      !Array.isArray(input.options) ||
      !input.options.length ||
      input.options.some((option) => typeof option !== "string" || !option.trim())
    )) {
      throw new BadRequestException({ message: "Un campo de tipo lista requiere opciones.", errors: ["REPORT_FIELD_OPTIONS_REQUIRED"] });
    }
    const children = Array.isArray(input.children) ? input.children : [];
    const childKeys = children.map((field) => field?.key);
    if ((input.type === "OBJECT" || input.type === "ARRAY_OF_OBJECTS") &&
        (!children.length || children.some((field) => !this.isValidChild(field)) ||
         new Set(childKeys).size !== childKeys.length)) {
      throw new BadRequestException({
        message: "Define propiedades válidas y únicas para el objeto.",
        errors: ["REPORT_FIELD_CHILDREN_REQUIRED"],
      });
    }
    if (input.type !== "OBJECT" && input.type !== "ARRAY_OF_OBJECTS" && children.length) {
      throw new BadRequestException({ message: "Este tipo de campo no admite propiedades internas.", errors: ["REPORT_FIELD_CHILDREN_NOT_ALLOWED"] });
    }
    if (input.isRequired !== undefined && typeof input.isRequired !== "boolean") {
      throw new BadRequestException({ message: "El estado obligatorio del campo no es válido.", errors: ["INVALID_REPORT_FIELD"] });
    }
    if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
      throw new BadRequestException({ message: "El orden del campo debe ser un entero no negativo.", errors: ["INVALID_REPORT_FIELD_ORDER"] });
    }
  }

  private toData(input: ReportFieldInput) {
    const children: Prisma.InputJsonValue | Prisma.NullTypes.DbNull = input.children?.length
      ? input.children.map((field): Prisma.InputJsonObject => ({
          key: field.key,
          label: field.label,
          type: field.type,
          description: field.description,
          isRequired: field.isRequired ?? true,
          ...(field.options?.length ? { options: field.options } : {}),
        }))
      : Prisma.DbNull;
    return {
      key: input.key,
      label: input.label.trim(),
      type: input.type,
      description: input.description.trim(),
      options: input.type === "ENUM" ? [...new Set((input.options ?? []).map((option) => option.trim()))] : [],
      children,
      isRequired: input.isRequired ?? true,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    };
  }

  private isValidChild(field: NestedFieldInput): boolean {
    if (!field || typeof field !== "object" || typeof field.key !== "string" ||
        typeof field.label !== "string" || typeof field.description !== "string" ||
        typeof field.type !== "string") return false;
    const optionsAreValid = Array.isArray(field.options) &&
      field.options.length > 0 &&
      field.options.every((option) => typeof option === "string" && Boolean(option.trim()));
    return keyPattern.test(field.key) &&
      Boolean(field.label.trim()) &&
      Boolean(field.description.trim()) &&
      field.type !== "OBJECT" &&
      field.type !== "ARRAY_OF_OBJECTS" &&
      fieldTypes.has(field.type) &&
      (field.type !== "ENUM" || optionsAreValid);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/encryption.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { UserRole } from "@prisma/client";
import { paginated, parsePagination } from "../common/pagination";
import { randomUUID } from "node:crypto";
import { verifyPassword } from "../auth/password.util";
import { classroomInclude, classroomToDto } from "./classroom.dto";
import { ProvidersService } from "../providers/providers.service";

@Injectable()
export class ClassroomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providers: ProvidersService,
  ) {}

  async listMine(role: string, userId: string, page?: string, pageSize?: string, search?: string) {
    const pagination = parsePagination(page, pageSize);
    const where = {
      ...(role === "STUDENT"
        ? { isActive: true, course: { isActive: true }, students: { some: { id: userId } } }
        : { instructorId: userId }),
      ...(search?.trim() ? {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" as const } },
          { code: { contains: search.trim(), mode: "insensitive" as const } },
          { course: { name: { contains: search.trim(), mode: "insensitive" as const } } },
        ],
      } : {}),
    };
    const [classrooms, total] = await Promise.all([
      this.prisma.classroom.findMany({
        where,
        include: classroomInclude,
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.classroom.count({ where }),
    ]);
    return paginated(
      classrooms.map(classroomToDto),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  async get(id: string, actor: AuthenticatedUser) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: classroomInclude,
    });
    if (!classroom) throw new NotFoundException({ message: "No se encontró el aula.", errors: ["CLASSROOM_NOT_FOUND"] });
    const isInstructor = actor.role === UserRole.INSTRUCTOR && classroom.instructorId === actor.id;
    const isStudent = actor.role === UserRole.STUDENT && classroom.students.some((student) => student.id === actor.id);
    if (actor.role !== UserRole.SUPERADMIN && !isInstructor && !isStudent) {
      throw new ForbiddenException({ message: "No tienes acceso a esta aula.", errors: ["CLASSROOM_ACCESS_DENIED"] });
    }
    if (actor.role === UserRole.STUDENT && (!classroom.isActive || !classroom.course?.isActive)) {
      throw new NotFoundException({ message: "El aula no está disponible.", errors: ["CLASSROOM_INACTIVE"] });
    }
    return classroomToDto(classroom);
  }

  async saveConfig(
    classroomId: string,
    input: {
      providerId: string;
      credentialId: string;
      selectedModels: string[];
      selectedReportFields?: string[];
      userPrompt: string;
      rubricText: string;
      dailyLimit: number;
    },
    actor: AuthenticatedUser,
  ) {
    if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 100) {
      throw new BadRequestException({ message: "El límite diario debe ser un entero entre 1 y 100.", errors: ["INVALID_DAILY_LIMIT"] });
    }
    const [classroom, provider, credential] = await Promise.all([
      this.prisma.classroom.findUnique({ where: { id: classroomId }, include: classroomInclude }),
      this.prisma.provider.findUnique({ where: { id: input.providerId } }),
      this.prisma.instructorCredential.findFirst({
        where: { id: input.credentialId, userId: actor.id, providerId: input.providerId },
      }),
    ]);
    if (!classroom) throw new NotFoundException({ message: "No se encontró el aula.", errors: ["CLASSROOM_NOT_FOUND"] });
    if (actor.role !== UserRole.INSTRUCTOR || classroom.instructorId !== actor.id) {
      throw new ForbiddenException({ message: "Solo el docente asignado puede configurar esta aula.", errors: ["CLASSROOM_ACCESS_DENIED"] });
    }
    if (!classroom.isActive || !classroom.course?.isActive) {
      throw new BadRequestException({ message: "No puedes configurar un aula o curso desactivado.", errors: ["CLASSROOM_INACTIVE"] });
    }
    if (!provider) throw new NotFoundException({ message: "No se encontró el proveedor.", errors: ["PROVIDER_NOT_FOUND"] });
    if (!credential) throw new BadRequestException({ message: "Selecciona una credencial propia para este proveedor.", errors: ["CREDENTIAL_REQUIRED"] });
    if (!Array.isArray(input.selectedModels) || input.selectedModels.some((model) => typeof model !== "string")) {
      throw new BadRequestException({ message: "La selección de modelos no es válida.", errors: ["INVALID_SELECTED_MODELS"] });
    }
    const selectedModels = [...new Set(input.selectedModels.map((model) => model.trim()).filter(Boolean))];
    if (!selectedModels.length) {
      throw new BadRequestException({ message: "Selecciona al menos un modelo válido del proveedor.", errors: ["INVALID_SELECTED_MODELS"] });
    }
    const availableModels = await this.providers.listModelsForInstructor(provider.id, credential.id, actor);
    if (selectedModels.some((model) => !availableModels.includes(model))) {
      throw new BadRequestException({ message: "Uno o más modelos ya no están disponibles para esta credencial.", errors: ["INVALID_SELECTED_MODELS"] });
    }
    if (input.selectedReportFields !== undefined && !Array.isArray(input.selectedReportFields)) {
      throw new BadRequestException({ message: "La selección de campos del reporte no es válida.", errors: ["INVALID_REPORT_FIELDS"] });
    }
    if (input.selectedReportFields?.some((key) => typeof key !== "string")) {
      throw new BadRequestException({ message: "La selección de campos del reporte no es válida.", errors: ["INVALID_REPORT_FIELDS"] });
    }
    const selectedReportFields = [...new Set(input.selectedReportFields ?? [])];
    if (input.selectedReportFields && input.selectedReportFields.length !== selectedReportFields.length) {
      throw new BadRequestException({ message: "La selección de campos del reporte no es válida.", errors: ["INVALID_REPORT_FIELDS"] });
    }
    if (selectedReportFields.length) {
      const activeFields = await this.prisma.reportSchemaField.findMany({
        where: { key: { in: selectedReportFields }, isActive: true },
        select: { key: true },
      });
      if (activeFields.length !== selectedReportFields.length) {
        throw new BadRequestException({ message: "Selecciona únicamente campos activos del reporte.", errors: ["INVALID_REPORT_FIELDS"] });
      }
    }
    const savedConfig = await this.prisma.classroomConfig.upsert({
      where: { classroomId },
      create: {
        classroomId,
        providerId: provider.id,
        credentialId: credential.id,
        selectedModels,
        selectedReportFields,
        userPrompt: input.userPrompt ?? "",
        rubricText: input.rubricText ?? "",
        dailyLimit: input.dailyLimit,
      },
      update: {
        providerId: provider.id,
        credentialId: credential.id,
        selectedModels,
        selectedReportFields,
        userPrompt: input.userPrompt ?? "",
        rubricText: input.rubricText ?? "",
        dailyLimit: input.dailyLimit,
      },
    });
    const configWithCredential = {
      ...savedConfig,
      credential: { name: credential.name },
    };
    return classroomToDto({
      ...classroom,
      config: configWithCredential,
    });
  }

  async listCourses(actor: AuthenticatedUser, page?: string, pageSize?: string, search?: string) {
    this.assertInstructor(actor);
    const pagination = parsePagination(page, pageSize);
    const where = {
      instructorId: actor.id,
      ...(search?.trim() ? { name: { contains: search.trim(), mode: "insensitive" as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: { _count: { select: { classrooms: true } } },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.course.count({ where }),
    ]);
    return paginated(
      items.map(({ _count, ...course }) => ({ ...course, classroomCount: _count.classrooms })),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  async createCourse(input: { name: string; description?: string }, actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException({ message: "El nombre del curso es obligatorio.", errors: ["INVALID_COURSE"] });
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { universityId: true } });
    return this.prisma.course.create({
      data: {
        name,
        description: input.description?.trim() ?? "",
        instructorId: actor.id,
        universityId: user?.universityId,
      },
    });
  }

  async updateCourse(id: string, input: { name: string; description?: string }, actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    if (!input || typeof input !== "object") {
      throw new BadRequestException({ message: "Los datos del curso no son válidos.", errors: ["INVALID_COURSE"] });
    }
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 160 || (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 500))) {
      throw new BadRequestException({ message: "Revisa el nombre y la descripción del curso.", errors: ["INVALID_COURSE"] });
    }
    const course = await this.prisma.course.findFirst({ where: { id, instructorId: actor.id } });
    if (!course) throw new NotFoundException({ message: "No se encontró el curso.", errors: ["COURSE_NOT_FOUND"] });
    return this.prisma.course.update({
      where: { id },
      data: { name, description: input.description?.trim() ?? "" },
    });
  }

  async setCourseStatus(
    id: string,
    input: { isActive: boolean; confirmationName: string; password: string },
    actor: AuthenticatedUser,
  ) {
    this.assertInstructor(actor);
    if (!input || typeof input.isActive !== "boolean") {
      throw new BadRequestException({ message: "El estado del curso no es válido.", errors: ["INVALID_COURSE_STATUS"] });
    }
    const course = await this.prisma.course.findFirst({ where: { id, instructorId: actor.id } });
    if (!course) throw new NotFoundException({ message: "No se encontró el curso.", errors: ["COURSE_NOT_FOUND"] });
    if (!input.isActive) {
      await this.assertDeactivationConfirmation(course.name, input.confirmationName, input.password, actor.id);
      return this.prisma.$transaction(async (transaction) => {
        await transaction.classroom.updateMany({
          where: { courseId: id, isActive: true },
          data: { isActive: false },
        });
        return transaction.course.update({ where: { id }, data: { isActive: false } });
      });
    }
    return this.prisma.course.update({ where: { id }, data: { isActive: true } });
  }

  async createClassroom(courseId: string, input: { name: string }, actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException({ message: "El nombre del aula es obligatorio.", errors: ["INVALID_CLASSROOM"] });
    const course = await this.prisma.course.findFirst({ where: { id: courseId, instructorId: actor.id, isActive: true } });
    if (!course) throw new NotFoundException({ message: "No se encontró el curso.", errors: ["COURSE_NOT_FOUND"] });
    return this.prisma.classroom.create({
      data: {
        name,
        code: randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        instructorId: actor.id,
        universityId: course.universityId,
        courseId: course.id,
      },
      include: classroomInclude,
    }).then(classroomToDto);
  }

  async updateClassroom(
    id: string,
    input: { name: string; courseId: string },
    actor: AuthenticatedUser,
  ) {
    this.assertInstructor(actor);
    if (!input || typeof input !== "object") {
      throw new BadRequestException({ message: "Los datos del aula no son válidos.", errors: ["INVALID_CLASSROOM"] });
    }
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 160 || typeof input.courseId !== "string" || !input.courseId) {
      throw new BadRequestException({ message: "El nombre del aula es obligatorio y no puede superar 160 caracteres.", errors: ["INVALID_CLASSROOM"] });
    }
    const [classroom, course] = await Promise.all([
      this.prisma.classroom.findFirst({ where: { id, instructorId: actor.id } }),
      this.prisma.course.findFirst({ where: { id: input.courseId, instructorId: actor.id, isActive: true } }),
    ]);
    if (!classroom) throw new NotFoundException({ message: "No se encontró el aula.", errors: ["CLASSROOM_NOT_FOUND"] });
    if (!course) throw new NotFoundException({ message: "Selecciona un curso activo de tu propiedad.", errors: ["COURSE_NOT_FOUND"] });
    return this.prisma.classroom.update({
      where: { id },
      data: { name, courseId: course.id, universityId: course.universityId },
      include: classroomInclude,
    }).then(classroomToDto);
  }

  async setClassroomStatus(
    id: string,
    input: { isActive: boolean; confirmationName: string; password: string },
    actor: AuthenticatedUser,
  ) {
    this.assertInstructor(actor);
    if (!input || typeof input.isActive !== "boolean") {
      throw new BadRequestException({ message: "El estado del aula no es válido.", errors: ["INVALID_CLASSROOM_STATUS"] });
    }
    const classroom = await this.prisma.classroom.findFirst({
      where: { id, instructorId: actor.id },
      include: { course: { select: { isActive: true } } },
    });
    if (!classroom) throw new NotFoundException({ message: "No se encontró el aula.", errors: ["CLASSROOM_NOT_FOUND"] });
    if (input.isActive && !classroom.course.isActive) {
      throw new BadRequestException({ message: "Primero reactiva el curso asociado para poder activar esta aula.", errors: ["COURSE_INACTIVE"] });
    }
    if (!input.isActive) await this.assertDeactivationConfirmation(classroom.name, input.confirmationName, input.password, actor.id);
    return this.prisma.classroom.update({ where: { id }, data: { isActive: input.isActive } });
  }

  private async assertDeactivationConfirmation(
    expectedName: string,
    confirmationName: string,
    password: string,
    userId: string,
  ) {
    if (typeof confirmationName !== "string" || confirmationName !== expectedName) {
      throw new BadRequestException({ message: "El nombre ingresado no coincide exactamente.", errors: ["NAME_CONFIRMATION_MISMATCH"] });
    }
    if (typeof password !== "string" || !password.trim()) {
      throw new BadRequestException({ message: "Ingresa tu contraseña para confirmar la desactivación.", errors: ["PASSWORD_REQUIRED"] });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new ForbiddenException({ message: "La contraseña no es correcta.", errors: ["INVALID_PASSWORD"] });
    }
  }

  async listCredentials(actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    const credentials = await this.prisma.instructorCredential.findMany({
      where: { userId: actor.id },
      include: { provider: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: [{ provider: { name: "asc" } }, { name: "asc" }],
    });
    return credentials.map(({ encryptedKey: _secret, ...credential }) => ({
      ...credential,
      hasKey: true,
    }));
  }

  async saveCredential(input: { id?: string; name: string; providerId: string; apiKey: string }, actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    const name = input.name?.trim();
    const apiKey = input.apiKey?.trim();
    if (!name || !apiKey) throw new BadRequestException({ message: "Nombre y API key son obligatorios.", errors: ["INVALID_CREDENTIAL"] });
    const provider = await this.prisma.provider.findUnique({ where: { id: input.providerId } });
    if (!provider) throw new NotFoundException({ message: "No se encontró el proveedor.", errors: ["PROVIDER_NOT_FOUND"] });
    if (input.id) {
      const existing = await this.prisma.instructorCredential.findFirst({ where: { id: input.id, userId: actor.id } });
      if (!existing) throw new NotFoundException({ message: "No se encontró la credencial.", errors: ["CREDENTIAL_NOT_FOUND"] });
      return this.prisma.instructorCredential.update({
        where: { id: existing.id },
        data: { name, providerId: provider.id, encryptedKey: this.encryption.encrypt(apiKey) },
        select: { id: true, name: true, userId: true, providerId: true, createdAt: true, updatedAt: true },
      });
    }
    return this.prisma.instructorCredential.create({
      data: { name, userId: actor.id, providerId: provider.id, encryptedKey: this.encryption.encrypt(apiKey) },
      select: { id: true, name: true, userId: true, providerId: true, createdAt: true, updatedAt: true },
    });
  }

  async deleteCredential(id: string, actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    const credential = await this.prisma.instructorCredential.findFirst({ where: { id, userId: actor.id } });
    if (!credential) throw new NotFoundException({ message: "No se encontró la credencial.", errors: ["CREDENTIAL_NOT_FOUND"] });
    await this.prisma.instructorCredential.delete({ where: { id } });
    return null;
  }

  private assertInstructor(actor: AuthenticatedUser) {
    if (actor.role !== UserRole.INSTRUCTOR) {
      throw new ForbiddenException({ message: "Esta operación está disponible para docentes.", errors: ["INSTRUCTOR_ACCESS_REQUIRED"] });
    }
  }
}

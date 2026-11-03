import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PasswordResetService } from "../auth/password-reset.service";
import { paginated, parsePagination } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";

const userInclude = { university: true } as const;

@Injectable()
export class InstructorStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async createInstructorStudent(
    input: { name: string; email: string; classroomIds: string[] },
    actor: AuthenticatedUser,
  ) {
    this.assertInstructor(actor);
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const classroomIds = [...new Set(input.classroomIds ?? [])];
    if (!name || !email || !email.includes("@") || !classroomIds.length) {
      throw new BadRequestException({
        message: "Nombre, correo válido y al menos un aula son obligatorios.",
        errors: ["INVALID_STUDENT"],
      });
    }
    const [existing, classrooms, instructor] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.classroom.findMany({
        where: { id: { in: classroomIds }, instructorId: actor.id, isActive: true, course: { isActive: true } },
        select: { id: true },
      }),
      this.prisma.user.findUnique({ where: { id: actor.id }, select: { universityId: true } }),
    ]);
    if (existing) throw new ConflictException({ message: "Ya existe una cuenta con ese correo.", errors: ["EMAIL_ALREADY_REGISTERED"] });
    if (classrooms.length !== classroomIds.length) {
      throw new BadRequestException({ message: "Solo puedes asignar aulas que estén a tu cargo.", errors: ["INVALID_CLASSROOM_ASSIGNMENT"] });
    }
    const created = await this.prisma.user.create({
      data: {
        name,
        email,
        role: UserRole.STUDENT,
        universityId: instructor?.universityId,
        passwordHash: null,
        mustSetPassword: true,
        classrooms: { connect: classroomIds.map((id) => ({ id })) },
      },
      include: userInclude,
    });
    try {
      await this.passwordReset.sendForUser(created.id);
    } catch (error) {
      await this.prisma.user.delete({ where: { id: created.id } });
      throw error;
    }
    return this.toUser(created);
  }

  async listInstructorStudents(
    actor: AuthenticatedUser,
    page?: string,
    pageSize?: string,
    search?: string,
    classroomId?: string,
  ) {
    this.assertInstructor(actor);
    const pagination = parsePagination(page, pageSize);
    if (classroomId) {
      const owned = await this.prisma.classroom.count({ where: { id: classroomId, instructorId: actor.id } });
      if (!owned) throw new NotFoundException({ message: "No se encontró el aula.", errors: ["CLASSROOM_NOT_FOUND"] });
    }
    const where: Prisma.UserWhereInput = {
      role: UserRole.STUDENT,
      isActive: true,
      classrooms: {
        some: {
          instructorId: actor.id,
          isActive: true,
          course: { isActive: true },
          ...(classroomId ? { id: classroomId } : {}),
        },
      },
      ...(search?.trim() ? { OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ] } : {}),
    };
    const [students, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          ...userInclude,
          classrooms: {
            where: { instructorId: actor.id, isActive: true, course: { isActive: true } },
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(students.map((student) => ({
      ...this.toUser(student),
      classrooms: student.classrooms,
    })), pagination.page, pagination.pageSize, total);
  }

  async importInstructorStudents(
    rows: Array<{ rowNumber: number; name: string; email: string; classroomCodes: string[] }>,
    actor: AuthenticatedUser,
  ) {
    this.assertInstructor(actor);
    const results: Array<{ rowNumber: number; email: string; success: boolean; message: string }> = [];
    for (const row of rows) {
      try {
        const classroomCodes = [...new Set(row.classroomCodes.map((code) => code.toUpperCase()))];
        const classrooms = await this.prisma.classroom.findMany({
          where: { instructorId: actor.id, code: { in: classroomCodes } },
          select: { id: true, code: true },
        });
        if (classrooms.length !== classroomCodes.length) {
          throw new BadRequestException({ message: "Uno o más códigos de aula no existen o no están a tu cargo.", errors: ["INVALID_CLASSROOM_ASSIGNMENT"] });
        }
        await this.createInstructorStudent({
          name: row.name,
          email: row.email,
          classroomIds: classrooms.map((classroom) => classroom.id),
        }, actor);
        results.push({ rowNumber: row.rowNumber, email: row.email, success: true, message: "Cuenta creada; enlace de configuración enviado." });
      } catch (error) {
        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          success: false,
          message: error instanceof Error ? error.message : "No se pudo crear el estudiante.",
        });
      }
    }
    return {
      total: results.length,
      created: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  }

  async assignStudentClassrooms(id: string, classroomIds: string[], actor: AuthenticatedUser) {
    this.assertInstructor(actor);
    if (!Array.isArray(classroomIds)) {
      throw new BadRequestException({ message: "Debes indicar la lista de aulas.", errors: ["INVALID_CLASSROOM_ASSIGNMENT"] });
    }
    const ids = [...new Set(classroomIds)];
    const [student, ownedClassrooms, classrooms] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id,
          role: UserRole.STUDENT,
          isActive: true,
          classrooms: { some: { instructorId: actor.id } },
        },
      }),
      this.prisma.classroom.findMany({ where: { instructorId: actor.id }, select: { id: true } }),
      this.prisma.classroom.findMany({ where: { id: { in: ids }, instructorId: actor.id }, select: { id: true } }),
    ]);
    if (!student) throw new NotFoundException({ message: "No se encontró un estudiante activo.", errors: ["STUDENT_NOT_FOUND"] });
    if (classrooms.length !== ids.length) {
      throw new BadRequestException({ message: "Solo puedes asignar aulas que estén a tu cargo.", errors: ["INVALID_CLASSROOM_ASSIGNMENT"] });
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        classrooms: {
          disconnect: ownedClassrooms.map((classroom) => ({ id: classroom.id })),
          connect: ids.map((classroomId) => ({ id: classroomId })),
        },
      },
    });
    return { studentId: id, classroomIds: ids };
  }

  private assertInstructor(actor: AuthenticatedUser) {
    if (actor.role !== UserRole.INSTRUCTOR) {
      throw new BadRequestException({ message: "Esta operación está disponible solo para docentes.", errors: ["INSTRUCTOR_ACCESS_REQUIRED"] });
    }
  }

  private toUser(user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    universityId: string | null;
    isActive: boolean;
    university: { name: string; logoUrl: string; primaryColor: string; accentColor: string } | null;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      universityId: user.role === UserRole.SUPERADMIN ? "" : user.universityId ?? "",
      universityName: user.role === UserRole.SUPERADMIN ? "" : user.university?.name ?? "",
      ...(user.role !== UserRole.SUPERADMIN && user.university ? {
        universityLogoUrl: user.university.logoUrl,
        universityPrimaryColor: user.university.primaryColor,
        universityAccentColor: user.university.accentColor,
      } : {}),
      isActive: user.isActive,
    };
  }
}

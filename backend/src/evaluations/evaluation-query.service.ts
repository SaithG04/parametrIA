import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { paginated, parsePagination } from "../common/pagination";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EvaluationsService } from "./evaluations.service";

@Injectable()
export class EvaluationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluations: EvaluationsService,
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
      records.map((record) => this.evaluations.toDto(record)),
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
        classroom: {
          select: {
            instructorId: true,
            name: true,
            course: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!record) throw new NotFoundException({ message: "No se encontró la evaluación.", errors: ["EVALUATION_NOT_FOUND"] });
    if (actor.role === UserRole.STUDENT && record.studentId !== actor.id) {
      throw new ForbiddenException({ message: "No tienes acceso a esta evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    if (actor.role === UserRole.INSTRUCTOR && record.classroom.instructorId !== actor.id) {
      throw new ForbiddenException({ message: "No tienes acceso a esta evaluación.", errors: ["EVALUATION_ACCESS_DENIED"] });
    }
    return this.evaluations.toDto(record);
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
      throw new BadRequestException({ message: "La fecha inicial debe ser anterior a la final.", errors: ["INVALID_DATE_RANGE"] });
    }
    if (lt) lt.setUTCDate(lt.getUTCDate() + 1);
    return { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
  }
}

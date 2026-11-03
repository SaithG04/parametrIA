import { Injectable } from "@nestjs/common";
import { EvaluationJobStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuperadminStats() {
    const [providerCount, universityCount, userCount, evaluationCount] = await Promise.all([
      this.prisma.provider.count(),
      this.prisma.university.count(),
      this.prisma.user.count(),
      this.prisma.evaluation.count(),
    ]);
    return { providerCount, universityCount, userCount, evaluationCount };
  }

  async getInstructorStats(instructorId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const [courseCount, classroomCount, configuredClassroomCount, studentCount, evaluationCount, recentEvaluationCount, activeJobCount] =
      await Promise.all([
        this.prisma.course.count({ where: { instructorId } }),
        this.prisma.classroom.count({ where: { instructorId } }),
        this.prisma.classroom.count({ where: { instructorId, isActive: true, config: { isNot: null } } }),
        this.prisma.user.count({
          where: {
            role: UserRole.STUDENT,
            classrooms: { some: { instructorId } },
          },
        }),
        this.prisma.evaluation.count({ where: { classroom: { instructorId } } }),
        this.prisma.evaluation.count({
          where: { classroom: { instructorId }, createdAt: { gte: weekStart } },
        }),
        this.prisma.evaluationJob.count({
          where: {
            classroom: { instructorId },
            status: { in: [EvaluationJobStatus.WAITING, EvaluationJobStatus.PROCESSING] },
          },
        }),
      ]);
    return {
      courseCount,
      classroomCount,
      configuredClassroomCount,
      studentCount,
      evaluationCount,
      recentEvaluationCount,
      activeJobCount,
    };
  }

  async getStudentStats(studentId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [classroomCount, evaluationCount, monthEvaluationCount, activeJobCount] = await Promise.all([
      this.prisma.classroom.count({
        where: {
          isActive: true,
          course: { isActive: true },
          students: { some: { id: studentId } },
        },
      }),
      this.prisma.evaluation.count({ where: { studentId } }),
      this.prisma.evaluation.count({ where: { studentId, createdAt: { gte: monthStart } } }),
      this.prisma.evaluationJob.count({
        where: {
          studentId,
          status: { in: [EvaluationJobStatus.WAITING, EvaluationJobStatus.PROCESSING] },
        },
      }),
    ]);
    return { classroomCount, evaluationCount, monthEvaluationCount, activeJobCount };
  }
}

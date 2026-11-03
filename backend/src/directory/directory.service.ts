import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";
import { paginated, parsePagination } from "../common/pagination";
import { PasswordResetService } from "../auth/password-reset.service";

const userInclude = { university: true } as const;

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async listUniversities(page?: string, pageSize?: string, search?: string) {
    const pagination = parsePagination(page, pageSize);
    const where: Prisma.UniversityWhereInput = search?.trim() ? {
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { domain: { contains: search.trim(), mode: "insensitive" } },
      ],
    } : {};
    const [items, total] = await Promise.all([
      this.prisma.university.findMany({
        where,
        include: { _count: { select: { users: true } } },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.university.count({ where }),
    ]);
    return paginated(
      items.map(({ _count, ...item }) => ({ ...item, userCount: _count.users })),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  createUniversity(input: { name: string; domain?: string; logoUrl?: string; primaryColor?: string; accentColor?: string }) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException({ message: "El nombre es obligatorio.", errors: ["INVALID_UNIVERSITY"] });
    const data = this.universityBrandData(input);
    return this.prisma.university.create({ data: { name, ...data } })
      .then((item) => ({ ...item, userCount: 0 }));
  }

  async updateUniversity(id: string, input: { name?: string; domain?: string; logoUrl?: string; primaryColor?: string; accentColor?: string }) {
    await this.requireUniversity(id);
    const brandData = this.universityBrandData(input);
    return this.prisma.university.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...brandData,
      },
      include: { _count: { select: { users: true } } },
    }).then(({ _count, ...item }) => ({ ...item, userCount: _count.users }));
  }

  async deleteUniversity(id: string) {
    await this.requireUniversity(id);
    await this.prisma.university.delete({ where: { id } });
    return null;
  }

  async listUsers(
    page?: string,
    pageSize?: string,
    filters: { search?: string; role?: string; universityId?: string; isActive?: string } = {},
  ) {
    const pagination = parsePagination(page, pageSize);
    const role = filters.role && Object.values(UserRole).includes(filters.role as UserRole)
      ? filters.role as UserRole
      : undefined;
    if (filters.role && !role) {
      throw new BadRequestException({ message: "El rol no es válido.", errors: ["INVALID_ROLE"] });
    }
    if (filters.isActive !== undefined && !["true", "false"].includes(filters.isActive)) {
      throw new BadRequestException({ message: "El filtro de estado debe ser true o false.", errors: ["INVALID_ACTIVE_FILTER"] });
    }
    const term = filters.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(term ? { OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ] } : {}),
      ...(role ? { role } : {}),
      ...(filters.universityId ? { universityId: filters.universityId } : {}),
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive === "true" }),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { ...userInclude, classrooms: { select: { id: true }, take: 1 } },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items.map((item) => ({
      ...this.toUser(item),
      classroomId: item.classrooms[0]?.id,
    })), pagination.page, pagination.pageSize, total);
  }

  async createUser(input: { name: string; email: string; role: string; universityId?: string | null }) {
    this.passwordReset.ensureEmailConfigured();
    const data = this.userData(input);
    const created = await this.prisma.user.create({
      data: { ...data, passwordHash: null, mustSetPassword: true },
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

  async updateUser(
    id: string,
    input: { name?: string; email?: string; password?: string; role?: string; universityId?: string | null },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!existing) throw new NotFoundException({ message: "No se encontró el usuario.", errors: ["USER_NOT_FOUND"] });
    if (input.password !== undefined && input.password.length < 8) {
      throw new BadRequestException({ message: "La contraseña debe tener al menos 8 caracteres.", errors: ["INVALID_PASSWORD"] });
    }
    const role = input.role === undefined ? existing.role : this.parseRole(input.role);
    const data = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.email === undefined ? {} : { email: input.email.trim().toLowerCase() }),
      ...(input.role === undefined ? {} : { role }),
      ...(input.password === undefined ? {} : { passwordHash: await hashPassword(input.password) }),
      ...(input.password === undefined ? {} : { mustSetPassword: false }),
      ...(role === UserRole.SUPERADMIN
        ? { university: { disconnect: true } }
        : input.universityId === undefined
          ? {}
          : { university: input.universityId ? { connect: { id: input.universityId } } : { disconnect: true } }),
    };
    const updated = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id },
        data,
        include: userInclude,
      });
      if (input.password !== undefined || input.role !== undefined) {
        await transaction.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
    return this.toUser(updated);
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ message: "No se encontró el usuario.", errors: ["USER_NOT_FOUND"] });
    await this.setUserStatus(id, false);
    return null;
  }

  async setUserStatus(id: string, isActive: boolean) {
    if (typeof isActive !== "boolean") {
      throw new BadRequestException({ message: "El estado debe ser activo o inactivo.", errors: ["INVALID_USER_STATUS"] });
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ message: "No se encontró el usuario.", errors: ["USER_NOT_FOUND"] });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive } }),
      ...(isActive ? [] : [
        this.prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
        this.prisma.passwordResetToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } }),
      ]),
    ]);
    return { id, isActive };
  }

  async sendPasswordReset(id: string) {
    await this.passwordReset.sendForUser(id);
    return null;
  }

  private userData(input: { name: string; email: string; role: string; universityId?: string | null }) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || !email || !email.includes("@")) {
      throw new BadRequestException({ message: "Nombre y correo electrónico válido son obligatorios.", errors: ["INVALID_USER"] });
    }
    const role = this.parseRole(input.role);
    return {
      name,
      email,
      role,
      ...(role !== UserRole.SUPERADMIN && input.universityId ? { university: { connect: { id: input.universityId } } } : {}),
    };
  }

  private universityBrandData(input: {
    domain?: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  }) {
    const color = (value: string | undefined, field: string) => {
      if (value === undefined) return undefined;
      if (!/^#[\da-f]{6}$/i.test(value)) {
        throw new BadRequestException({ message: `${field} debe ser un color hexadecimal válido.`, errors: ["INVALID_UNIVERSITY_BRANDING"] });
      }
      return value.toLowerCase();
    };
    const primaryColor = color(input.primaryColor, "El color principal");
    const accentColor = color(input.accentColor, "El color de acento");
    return {
      ...(input.domain === undefined ? {} : { domain: input.domain.trim() }),
      ...(input.logoUrl === undefined ? {} : { logoUrl: input.logoUrl.trim() }),
      ...(primaryColor === undefined ? {} : { primaryColor }),
      ...(accentColor === undefined ? {} : { accentColor }),
    };
  }

  private parseRole(roleName: string): UserRole {
    if (!Object.values(UserRole).includes(roleName as UserRole)) {
      throw new BadRequestException({ message: "Rol no válido.", errors: ["INVALID_ROLE"] });
    }
    return roleName as UserRole;
  }

  private async requireUniversity(id: string) {
    const university = await this.prisma.university.findUnique({ where: { id } });
    if (!university) throw new NotFoundException({ message: "No se encontró la universidad.", errors: ["UNIVERSITY_NOT_FOUND"] });
    return university;
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
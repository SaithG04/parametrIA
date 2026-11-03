import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { EmailService } from "./email.service";
import { hashPassword } from "./password.util";
import { PrismaService } from "../prisma/prisma.service";
import { getRuntimeConfig } from "../config/runtime-config";

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  ensureEmailConfigured() {
    this.email.assertConfigured();
  }

  async requestForEmail(email: string) {
    this.ensureEmailConfigured();
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user) await this.sendForUser(user.id);
  }

  async sendForUser(userId: string) {
    this.ensureEmailConfigured();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ message: "No se encontró el usuario.", errors: ["USER_NOT_FOUND"] });

    const token = randomBytes(32).toString("base64url");
    const ttlSeconds = getRuntimeConfig().passwordResetTtlSeconds;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await transaction.passwordResetToken.create({
        data: { userId, tokenHash: digest(token), expiresAt },
      });
    });
    try {
      await this.email.sendPasswordSetup(user.id, token, digest(token), ttlSeconds);
    } catch (error) {
      await this.prisma.passwordResetToken.updateMany({
        where: { tokenHash: digest(token), usedAt: null },
        data: { usedAt: new Date() },
      });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({
        message: "No se pudo enviar el correo. Verifica la configuración SMTP e inténtalo de nuevo.",
        errors: ["EMAIL_DELIVERY_FAILED"],
      });
    }
  }

  async complete(token: string, newPassword: string) {
    if (!token || token.length > 256) {
      throw new UnauthorizedException({ message: "El enlace expiró o no es válido.", errors: ["PASSWORD_RESET_INVALID"] });
    }
    const tokenHash = digest(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new UnauthorizedException({ message: "El enlace expiró o ya fue utilizado.", errors: ["PASSWORD_RESET_INVALID"] });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException({ message: "El enlace expiró o ya fue utilizado.", errors: ["PASSWORD_RESET_INVALID"] });
      }
      await transaction.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustSetPassword: false },
      });
      await transaction.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });
  }
}

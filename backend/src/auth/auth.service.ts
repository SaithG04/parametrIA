import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { getRuntimeConfig } from "../config/runtime-config";
import { PrismaService } from "../prisma/prisma.service";
import { verifyPassword } from "./password.util";
import { PasswordResetService } from "./password-reset.service";
import type { AuthResponse } from "./auth.types";

interface RefreshClaims {
  sub: string;
  sid: string;
  jti: string;
  tokenUse: "refresh";
}

function tokenDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async login(
    email: string,
    password: string,
    request: Request,
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { university: true },
    });
    const valid = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException({
        message: "Correo o contraseña incorrectos.",
        errors: ["INVALID_CREDENTIALS"],
      });
    }
    if (user.mustSetPassword) {
      throw new UnauthorizedException({
        message: "Debes configurar una nueva contraseña usando el enlace enviado a tu correo.",
        errors: ["PASSWORD_SETUP_REQUIRED"],
      });
    }

    const { session, jti } = await this.createSession(user.id, request);
    const tokens = await this.signTokens(user.id, user.role, session.id, jti);
    return {
      auth: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          universityId: user.role === "SUPERADMIN" ? null : user.universityId,
          universityName: user.role === "SUPERADMIN" ? null : (user.university?.name ?? null),
          ...(user.role !== "SUPERADMIN" && user.university ? {
            universityLogoUrl: user.university.logoUrl,
            universityPrimaryColor: user.university.primaryColor,
            universityAccentColor: user.university.accentColor,
          } : {}),
        },
        accessToken: tokens.accessToken,
        expiresIn: getRuntimeConfig().accessTtlSeconds,
      },
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string | undefined, request: Request) {
    if (!refreshToken) {
      throw new UnauthorizedException({ message: "La sesión de renovación no está disponible.", errors: ["REFRESH_TOKEN_REQUIRED"] });
    }
    const config = getRuntimeConfig();
    let claims: RefreshClaims;
    try {
      const verified = await jwtVerify(refreshToken, config.refreshSecret, {
        algorithms: ["HS256"],
        issuer: config.issuer,
        audience: config.audience,
      });
      if (
        verified.payload["tokenUse"] !== "refresh" ||
        typeof verified.payload.sub !== "string" ||
        typeof verified.payload["sid"] !== "string" ||
        typeof verified.payload.jti !== "string"
      ) {
        throw new Error("Invalid refresh token claims.");
      }
      claims = {
        sub: verified.payload.sub,
        sid: verified.payload["sid"],
        jti: verified.payload.jti,
        tokenUse: "refresh",
      };
    } catch {
      throw new UnauthorizedException({ message: "La sesión de renovación expiró o no es válida.", errors: ["REFRESH_TOKEN_INVALID"] });
    }

    const existing = await this.prisma.authSession.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        refreshTokenHash: tokenDigest(claims.jti),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { university: true } } },
    });
    if (!existing) {
      throw new UnauthorizedException({ message: "La sesión de renovación fue revocada o ya se utilizó.", errors: ["REFRESH_TOKEN_REUSED"] });
    }
    if (!existing.user.isActive) {
      await this.prisma.authSession.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ message: "La cuenta está desactivada.", errors: ["ACCOUNT_DISABLED"] });
    }

    const newJti = randomUUID();
    const expiresAt = new Date(Date.now() + config.refreshTtlSeconds * 1000);
    const nextSession = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.authSession.updateMany({
        where: { id: existing.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException({ message: "La sesión de renovación ya fue utilizada.", errors: ["REFRESH_TOKEN_REUSED"] });
      }
      const created = await transaction.authSession.create({
        data: {
          userId: existing.userId,
          refreshTokenHash: tokenDigest(newJti),
          expiresAt,
          userAgent: request.get("user-agent")?.slice(0, 512),
          ipAddress: request.ip,
        },
      });
      await transaction.authSession.update({
        where: { id: existing.id },
        data: { replacedById: created.id },
      });
      return created;
    });
    const tokens = await this.signTokens(existing.userId, existing.user.role, nextSession.id, newJti);
    return {
      auth: {
        user: {
          id: existing.user.id,
          name: existing.user.name,
          email: existing.user.email,
          role: existing.user.role,
          universityId: existing.user.role === "SUPERADMIN" ? null : existing.user.universityId,
          universityName: existing.user.role === "SUPERADMIN" ? null : (existing.user.university?.name ?? null),
          ...(existing.user.role !== "SUPERADMIN" && existing.user.university ? {
            universityLogoUrl: existing.user.university.logoUrl,
            universityPrimaryColor: existing.user.university.primaryColor,
            universityAccentColor: existing.user.university.accentColor,
          } : {}),
        },
        accessToken: tokens.accessToken,
        expiresIn: config.accessTtlSeconds,
      },
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  async requestPasswordReset(email: string) {
    await this.passwordReset.requestForEmail(email);
  }

  async sendPasswordSetup(userId: string) {
    await this.passwordReset.sendForUser(userId);
  }

  async completePasswordReset(token: string, password: string) {
    await this.passwordReset.complete(token, password);
  }

  private async createSession(userId: string, request: Request) {
    const config = getRuntimeConfig();
    const jti = randomUUID();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: tokenDigest(jti),
        expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000),
        userAgent: request.get("user-agent")?.slice(0, 512),
        ipAddress: request.ip,
      },
    });
    return { session, jti };
  }

  private async signTokens(userId: string, role: string, sessionId: string, refreshJti = randomUUID()) {
    const config = getRuntimeConfig();
    const now = Math.floor(Date.now() / 1000);
    const base = (tokenUse: "access" | "refresh", jti: string) => new SignJWT({
      tokenUse,
      sid: sessionId,
      ...(tokenUse === "access" ? { role } : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject(userId)
      .setJti(jti)
      .setIssuedAt(now);
    const [accessToken, refreshToken] = await Promise.all([
      base("access", randomUUID()).setExpirationTime(now + config.accessTtlSeconds).sign(config.accessSecret),
      base("refresh", refreshJti).setExpirationTime(now + config.refreshTtlSeconds).sign(config.refreshSecret),
    ]);
    return { accessToken, refreshToken };
  }
}

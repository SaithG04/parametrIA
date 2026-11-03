import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { jwtVerify } from "jose";
import { getRuntimeConfig } from "../config/runtime-config";
import { PrismaService } from "../prisma/prisma.service";
import { PRIVACY_VERSION, TERMS_VERSION } from "../legal/legal-documents";
import type { AuthenticatedUser } from "./auth.types";

interface TokenClaims {
  sub: string;
  sid: string;
}

@Injectable()
export class AccessTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(token: string, requireLegalAcceptance = true): Promise<AuthenticatedUser> {
    const config = getRuntimeConfig();
    let claims: TokenClaims;
    try {
      const verified = await jwtVerify(token, config.accessSecret, {
        algorithms: ["HS256"],
        issuer: config.issuer,
        audience: config.audience,
      });
      if (
        verified.payload["tokenUse"] !== "access" ||
        typeof verified.payload.sub !== "string" ||
        typeof verified.payload["sid"] !== "string"
      ) {
        throw new Error("Invalid access token claims.");
      }
      claims = { sub: verified.payload.sub, sid: verified.payload["sid"] };
    } catch {
      throw new UnauthorizedException({
        message: "El token de acceso no es válido o ha expirado.",
        errors: ["ACCESS_TOKEN_INVALID"],
      });
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            acceptedTermsVersion: true,
            acceptedPrivacyVersion: true,
          },
        },
      },
    });
    if (!session || !session.user.isActive) {
      throw new UnauthorizedException({
        message: "La sesión expiró, fue revocada o la cuenta está desactivada.",
        errors: ["SESSION_REVOKED"],
      });
    }
    if (requireLegalAcceptance && (
      session.user.acceptedTermsVersion !== TERMS_VERSION ||
      session.user.acceptedPrivacyVersion !== PRIVACY_VERSION
    )) {
      throw new ForbiddenException({
        message: "Acepta los términos de uso y la política de privacidad vigentes para continuar.",
        errors: ["LEGAL_ACCEPTANCE_REQUIRED"],
      });
    }
    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    };
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { jwtVerify } from "jose";
import { PrismaService } from "../prisma/prisma.service";
import { getRuntimeConfig } from "../config/runtime-config";
import { IS_PUBLIC, LEGAL_ACCEPTANCE_EXEMPT } from "./auth.decorators";
import type { AuthenticatedUser } from "./auth.types";
import { PRIVACY_VERSION, TERMS_VERSION } from "../legal/legal-documents";

interface TokenClaims {
  sub: string;
  sid: string;
  tokenUse: "access";
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = Reflect.getMetadata(IS_PUBLIC, context.getHandler()) ??
      Reflect.getMetadata(IS_PUBLIC, context.getClass());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const header = request.headers.authorization;
    const accessToken = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!accessToken) throw new UnauthorizedException({ message: "Se requiere un token de acceso.", errors: ["ACCESS_TOKEN_REQUIRED"] });

    const config = getRuntimeConfig();
    let claims: TokenClaims;
    try {
      const verified = await jwtVerify(accessToken, config.accessSecret, {
        algorithms: ["HS256"],
        issuer: config.issuer,
        audience: config.audience,
      });
      if (verified.payload["tokenUse"] !== "access" || typeof verified.payload.sub !== "string" || typeof verified.payload["sid"] !== "string") {
        throw new Error("Invalid access token claims.");
      }
      claims = {
        sub: verified.payload.sub,
        sid: verified.payload["sid"],
        tokenUse: "access",
      };
    } catch {
      throw new UnauthorizedException({ message: "El token de acceso no es válido o ha expirado.", errors: ["ACCESS_TOKEN_INVALID"] });
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session || !session.user.isActive) throw new UnauthorizedException({ message: "La sesión expiró, fue revocada o la cuenta está desactivada.", errors: ["SESSION_REVOKED"] });
    const legalExempt = this.reflector.getAllAndOverride<boolean>(LEGAL_ACCEPTANCE_EXEMPT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!legalExempt && (
      session.user.acceptedTermsVersion !== TERMS_VERSION ||
      session.user.acceptedPrivacyVersion !== PRIVACY_VERSION
    )) {
      throw new ForbiddenException({
        message: "Acepta los términos de uso y la política de privacidad vigentes para continuar.",
        errors: ["LEGAL_ACCEPTANCE_REQUIRED"],
      });
    }
    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    };
    return true;
  }
}

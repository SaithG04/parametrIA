import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC, LEGAL_ACCEPTANCE_EXEMPT } from "./auth.decorators";
import type { AuthenticatedUser } from "./auth.types";
import { AccessTokenService } from "./access-token.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
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

    const legalExempt = this.reflector.getAllAndOverride<boolean>(LEGAL_ACCEPTANCE_EXEMPT, [
      context.getHandler(),
      context.getClass(),
    ]);
    request.user = await this.accessTokens.authenticate(accessToken, !legalExempt);
    return true;
  }
}

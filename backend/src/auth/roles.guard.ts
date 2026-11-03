import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { REQUIRED_ROLES } from "./auth.decorators";
import type { AuthenticatedUser } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const roles = Reflect.getMetadata(REQUIRED_ROLES, context.getHandler()) ??
      Reflect.getMetadata(REQUIRED_ROLES, context.getClass());
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user || !roles.includes(request.user.role)) {
      throw new ForbiddenException({ message: "No tienes permisos para esta operación.", errors: ["INSUFFICIENT_ROLE"] });
    }
    return true;
  }
}

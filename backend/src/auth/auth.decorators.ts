import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "./auth.types";

export const IS_PUBLIC = "auth:is-public";
export const REQUIRED_ROLES = "auth:required-roles";
export const LEGAL_ACCEPTANCE_EXEMPT = "auth:legal-acceptance-exempt";

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles);
export const AllowPendingLegal = () => SetMetadata(LEGAL_ACCEPTANCE_EXEMPT, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);

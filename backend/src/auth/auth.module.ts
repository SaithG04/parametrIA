import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import { PasswordResetService } from "./password-reset.service";
import { RolesGuard } from "./roles.guard";

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    PasswordResetService,
    AuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [AuthService, PasswordResetService],
})
export class AuthModule {}

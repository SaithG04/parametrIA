import { BullModule } from "@nestjs/bullmq";
import { Global, Module, type Provider } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AccessTokenService } from "./access-token.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EmailProcessor } from "./email.processor";
import { EMAIL_QUEUE } from "./email-queue.constants";
import { EmailService } from "./email.service";
import { PasswordResetService } from "./password-reset.service";
import { RolesGuard } from "./roles.guard";

const providers: Provider[] = [
  AuthService,
  AccessTokenService,
  EmailService,
  EmailDeliveryService,
  PasswordResetService,
  AuthGuard,
  RolesGuard,
  { provide: APP_GUARD, useExisting: AuthGuard },
  { provide: APP_GUARD, useExisting: RolesGuard },
];
if (process.env.RUN_EVALUATION_WORKER !== "false") providers.push(EmailProcessor);

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  controllers: [AuthController],
  providers,
  exports: [AuthService, AccessTokenService, PasswordResetService],
})
export class AuthModule {}

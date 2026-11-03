import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyService } from "./idempotency.service";
import { TransformInterceptor } from "./transform.interceptor";
import { EncryptionService } from "./encryption.service";

@Global()
@Module({
  providers: [
    TransformInterceptor,
    AllExceptionsFilter,
    IdempotencyService,
    IdempotencyInterceptor,
    EncryptionService,
    { provide: APP_INTERCEPTOR, useExisting: TransformInterceptor },
    { provide: APP_FILTER, useExisting: AllExceptionsFilter },
  ],
  exports: [TransformInterceptor, AllExceptionsFilter, IdempotencyService, IdempotencyInterceptor, EncryptionService],
})
export class CommonModule {}

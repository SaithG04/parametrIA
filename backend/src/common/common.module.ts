import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyService } from "./idempotency.service";
import { TransformInterceptor } from "./transform.interceptor";

@Global()
@Module({
  providers: [
    TransformInterceptor,
    AllExceptionsFilter,
    IdempotencyService,
    IdempotencyInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: TransformInterceptor },
    { provide: APP_FILTER, useExisting: AllExceptionsFilter },
  ],
  exports: [TransformInterceptor, AllExceptionsFilter, IdempotencyService, IdempotencyInterceptor],
})
export class CommonModule {}

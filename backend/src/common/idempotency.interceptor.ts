import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { from, map, type Observable } from "rxjs";
import { IdempotencyService } from "./idempotency.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { Request, Response } from "express";

type IdempotentRequest = Request & {
  user?: AuthenticatedUser;
  file?: { buffer: Buffer };
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<IdempotentRequest>();
    const response = http.getResponse<Response>();
    const user = request.user;
    const keyHeader = request.header("idempotency-key");
    const key = keyHeader?.trim();
    if (!user) {
      throw new ConflictException({ message: "La operación requiere una sesión autenticada.", errors: ["AUTH_REQUIRED"] });
    }
    if (!key || key.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(key)) {
      throw new BadRequestException({
        message: "Envía un Idempotency-Key único de hasta 128 caracteres.",
        errors: ["IDEMPOTENCY_KEY_REQUIRED"],
      });
    }

    const fileHash = request.file
      ? createHash("sha256").update(request.file.buffer).digest("hex")
      : null;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({
        method: request.method,
        path: request.originalUrl,
        body: request.body ?? null,
        fileHash,
      }))
      .digest("hex");

    return from(this.idempotency.execute(
      user.id,
      key,
      request.method,
      request.path,
      requestHash,
      () => new Promise<unknown>((resolve, reject) => {
        next.handle().subscribe({ next: resolve, error: reject });
      }),
    )).pipe(
      map(({ result, replayed }) => {
        if (replayed) response.setHeader("Idempotency-Replayed", "true");
        return result;
      }),
    );
  }
}

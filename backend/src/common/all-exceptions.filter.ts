import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ExceptionPayload {
  message?: string | string[];
  errors?: string[];
}
interface RequestWithTrace extends Request {
  traceId?: string;
}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithTrace>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException
      ? exception.getResponse() as string | ExceptionPayload
      : null;
    const objectPayload = typeof payload === "object" && payload !== null ? payload : null;
    const safeForClient = status < HttpStatus.INTERNAL_SERVER_ERROR;
    const payloadMessage = objectPayload?.message;
    const message = typeof payload === "string"
      ? payload
      : safeForClient && typeof payloadMessage === "string"
        ? payloadMessage
        : safeForClient && Array.isArray(payloadMessage)
          ? payloadMessage.join(" ")
          : status === HttpStatus.INTERNAL_SERVER_ERROR
            ? "Error interno del servidor."
            : "La solicitud no pudo completarse.";
    const errors = Array.isArray(objectPayload?.errors)
      ? objectPayload.errors
      : status === HttpStatus.INTERNAL_SERVER_ERROR
        ? ["INTERNAL_SERVER_ERROR"]
        : [String(status)];

    if (!safeForClient) {
      this.logger.error(
        `Unhandled exception for ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      errors,
      path: request.path,
    });
  }
}

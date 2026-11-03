import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Logger } from "@nestjs/common";

interface TracedRequest extends Request {
  traceId?: string;
  startedAt?: number;
}

const logger = new Logger("HttpTrace");

export function traceMiddleware(request: TracedRequest, response: Response, next: NextFunction) {
  const provided = request.header("x-request-id");
  const traceId = provided && /^[a-zA-Z0-9._:-]{1,128}$/.test(provided)
    ? provided
    : randomUUID();
  request.traceId = traceId;
  request.startedAt = Date.now();
  response.setHeader("X-Request-ID", traceId);
  response.on("finish", () => {
    logger.log(JSON.stringify({
      traceId,
      method: request.method,
      path: request.originalUrl,
      status: response.statusCode,
      durationMs: Date.now() - (request.startedAt ?? Date.now()),
      ip: request.ip,
    }));
  });
  next();
}

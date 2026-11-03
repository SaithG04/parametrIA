import Redis from "ioredis";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { EvaluationJobStatus } from "@prisma/client";
import { EVALUATION_STATUS_CHANNEL, type EvaluationStatusEvent } from "./evaluation-status.events";

@Injectable()
export class EvaluationStatusPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(EvaluationStatusPublisher.name);
  private readonly redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:16379", {
    maxRetriesPerRequest: null,
  });

  constructor() {
    this.redis.on("error", (error: Error) => {
      this.logger.error("Redis evaluation-status publisher connection failed.", error.stack);
    });
  }

  async publish(input: {
    studentId: string;
    id: string;
    status: EvaluationJobStatus;
    fileName: string;
    errorMessage: string;
    evaluationId: string | null;
    createdAt: Date;
  }) {
    const event: EvaluationStatusEvent = {
      studentId: input.studentId,
      job: {
        id: input.id,
        status: input.status,
        fileName: input.fileName,
        errorMessage: input.errorMessage,
        evaluationId: input.evaluationId,
        createdAt: input.createdAt.toISOString(),
      },
    };
    try {
      await this.redis.publish(EVALUATION_STATUS_CHANNEL, JSON.stringify(event));
    } catch (error) {
      this.logger.error(
        `Could not publish evaluation status for job ${input.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

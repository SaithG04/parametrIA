import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";

const RETENTION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class EvaluationRetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(EvaluationRetentionScheduler.name);

  constructor(@InjectQueue(EVALUATION_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      "evaluation-retention-cleanup",
      { every: RETENTION_CLEANUP_INTERVAL_MS },
      {
        name: "cleanup-retention",
        data: {},
        opts: { removeOnComplete: 20, removeOnFail: 100 },
      },
    );
    this.logger.log("Scheduled recurring evaluation data-retention cleanup.");
  }
}

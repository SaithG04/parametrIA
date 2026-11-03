import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";
import { EvaluationJobsService } from "./evaluation-jobs.service";
import { EvaluationRetentionService } from "./evaluation-retention.service";

@Processor(EVALUATION_QUEUE, { concurrency: 2 })
export class EvaluationProcessor extends WorkerHost {
  constructor(
    private readonly jobs: EvaluationJobsService,
    private readonly retention: EvaluationRetentionService,
  ) {
    super();
  }

  process(job: Job<{ evaluationJobId?: string }>) {
    if (job.name === "cleanup-retention") {
      return this.retention.cleanupExpiredData();
    }
    if (!job.data.evaluationJobId) {
      throw new Error(`Evaluation job ${job.id ?? "(unknown)"} is missing its evaluation ID.`);
    }
    return this.jobs.processJob(job.data.evaluationJobId);
  }
}

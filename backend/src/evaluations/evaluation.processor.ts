import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";
import { EvaluationsService } from "./evaluations.service";

@Processor(EVALUATION_QUEUE, { concurrency: 2 })
export class EvaluationProcessor extends WorkerHost {
  constructor(private readonly evaluations: EvaluationsService) {
    super();
  }

  process(job: Job<{ evaluationJobId?: string }>) {
    if (job.name === "cleanup-retention") {
      return this.evaluations.cleanupExpiredData();
    }
    if (!job.data.evaluationJobId) {
      throw new Error(`Evaluation job ${job.id ?? "(unknown)"} is missing its evaluation ID.`);
    }
    return this.evaluations.processJob(job.data.evaluationJobId);
  }
}

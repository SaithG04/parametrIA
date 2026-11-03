import { Module, type Provider } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EvaluationsController } from "./evaluations.controller";
import { EvaluationProcessor } from "./evaluation.processor";
import { EvaluationGateway } from "./evaluation.gateway";
import { EvaluationJobsService } from "./evaluation-jobs.service";
import { EvaluationQueryService } from "./evaluation-query.service";
import { EvaluationRetentionService } from "./evaluation-retention.service";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";
import { EvaluationStatusPublisher } from "./evaluation-status.publisher";
import { EvaluationsService } from "./evaluations.service";
import { EvaluationRetentionScheduler } from "./evaluation-retention.scheduler";
import { ReportSchemaModule } from "../report-schema/report-schema.module";
import { SystemPromptsModule } from "../system-prompts/system-prompts.module";

const providers: Provider[] = [
  EvaluationsService,
  EvaluationJobsService,
  EvaluationQueryService,
  EvaluationRetentionService,
  EvaluationStatusPublisher,
];
if (process.env.RUN_EVALUATION_WORKER !== "false") {
  providers.push(EvaluationProcessor, EvaluationRetentionScheduler);
}
if (process.env.RUN_EVALUATION_WORKER !== "true") providers.push(EvaluationGateway);

@Module({
  imports: [
    BullModule.registerQueue({ name: EVALUATION_QUEUE }),
    ReportSchemaModule,
    SystemPromptsModule,
  ],
  controllers: [EvaluationsController],
  providers,
})
export class EvaluationsModule {}

import { BullModule } from "@nestjs/bullmq";
import { Module, type Provider } from "@nestjs/common";
import type { ConnectionOptions } from "bullmq";
import { EncryptionService } from "../common/encryption.service";
import { EvaluationsController } from "./evaluations.controller";
import { EvaluationProcessor } from "./evaluation.processor";
import { EVALUATION_QUEUE } from "./evaluation-queue.constants";
import { EvaluationsService } from "./evaluations.service";
import { EvaluationRetentionScheduler } from "./evaluation-retention.scheduler";
import { ReportSchemaModule } from "../report-schema/report-schema.module";
import { SystemPromptsModule } from "../system-prompts/system-prompts.module";

function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:16379");
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

const providers: Provider[] = [EvaluationsService, EncryptionService];
if (process.env.RUN_EVALUATION_WORKER !== "false") {
  providers.push(EvaluationProcessor, EvaluationRetentionScheduler);
}

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: EVALUATION_QUEUE }),
    ReportSchemaModule,
    SystemPromptsModule,
  ],
  controllers: [EvaluationsController],
  providers,
})
export class EvaluationsModule {}

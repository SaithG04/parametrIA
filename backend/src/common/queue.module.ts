import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import type { ConnectionOptions } from "bullmq";

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

@Global()
@Module({
  imports: [BullModule.forRoot({ connection: redisConnection() })],
  exports: [BullModule],
})
export class QueueModule {}

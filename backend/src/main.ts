import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { getRuntimeConfig } from "./config/runtime-config";
import { traceMiddleware } from "./common/trace.middleware";

async function bootstrap() {
  const config = getRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set("trust proxy", config.trustProxy);
  app.setGlobalPrefix(config.apiPrefix);
  app.use(cookieParser());
  app.use(traceMiddleware);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Idempotency-Key"],
    exposedHeaders: ["X-Request-ID", "Idempotency-Replayed"],
    maxAge: 600,
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  const port = config.port;
  await app.listen(port, "0.0.0.0");
  console.info(`ParametrIA API listening on port ${port}.`);
}

void bootstrap();

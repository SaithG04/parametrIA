import Redis from "ioredis";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger, UnauthorizedException } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { AccessTokenService } from "../auth/access-token.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { getRuntimeConfig } from "../config/runtime-config";
import {
  EVALUATION_STATUS_CHANNEL,
  EVALUATION_STATUS_EVENT,
  evaluationStatusEventSchema,
} from "./evaluation-status.events";

function redisError(error: Error) {
  return error.stack;
}

@WebSocketGateway({
  path: "/socket.io",
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("WebSocket origin is not allowed."));
    },
    credentials: true,
  },
})
export class EvaluationGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(EvaluationGateway.name);
  private readonly subscriber = new Redis(process.env.REDIS_URL ?? "redis://localhost:16379", {
    maxRetriesPerRequest: null,
  });

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly accessTokens: AccessTokenService) {
    this.subscriber.on("error", (error: Error) => {
      this.logger.error("Redis evaluation-status subscriber connection failed.", redisError(error));
    });
    this.subscriber.on("message", (channel, rawEvent) => {
      if (channel !== EVALUATION_STATUS_CHANNEL) return;
      let payload: unknown;
      try {
        payload = JSON.parse(rawEvent);
      } catch {
        this.logger.error("Redis delivered malformed evaluation-status JSON.");
        return;
      }
      const parsed = evaluationStatusEventSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.error("Redis delivered an invalid evaluation-status event.");
        return;
      }
      const { studentId, job } = parsed.data;
      this.server.to(this.studentRoom(studentId)).emit(EVALUATION_STATUS_EVENT, job);
    });
  }

  afterInit() {
    void this.subscriber.subscribe(EVALUATION_STATUS_CHANNEL).catch((error: unknown) => {
      this.logger.error(
        "Could not subscribe to evaluation-status events.",
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async handleConnection(client: Socket) {
    const origin = client.handshake.headers.origin;
    if (origin && !getRuntimeConfig().corsOrigins.includes(origin)) {
      client.disconnect(true);
      return;
    }
    const token = client.handshake.auth?.["token"];
    if (typeof token !== "string" || !token) {
      client.disconnect(true);
      return;
    }
    try {
      const user: AuthenticatedUser = await this.accessTokens.authenticate(token);
      if (user.role !== "STUDENT") {
        client.disconnect(true);
        return;
      }
      await client.join(this.studentRoom(user.id));
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        this.logger.error("Could not authenticate an evaluation WebSocket connection.", error instanceof Error ? error.stack : undefined);
      }
      client.disconnect(true);
    }
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }

  private studentRoom(studentId: string) {
    return `student:${studentId}`;
  }
}

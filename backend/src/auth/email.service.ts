import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";
import { EncryptionService } from "../common/encryption.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EMAIL_QUEUE } from "./email-queue.constants";
import type { PasswordSetupEmailJob } from "./email-queue.types";

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<PasswordSetupEmailJob>,
    private readonly delivery: EmailDeliveryService,
    private readonly encryption: EncryptionService,
  ) {}

  assertConfigured() {
    this.delivery.assertConfigured();
  }

  async sendPasswordSetup(
    userId: string,
    token: string,
    tokenHash: string,
    expiresInSeconds: number,
  ) {
    this.assertConfigured();
    await this.queue.add(
      "send-password-setup",
      {
        userId,
        encryptedToken: this.encryption.encrypt(token),
        tokenHash,
        expiresInSeconds,
      },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: { age: 3600, count: 100 },
      },
    );
  }
}

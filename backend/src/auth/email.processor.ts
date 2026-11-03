import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/encryption.service";
import { EmailDeliveryService } from "./email-delivery.service";
import { EMAIL_QUEUE } from "./email-queue.constants";
import type { PasswordSetupEmailJob } from "./email-queue.types";

@Injectable()
@Processor(EMAIL_QUEUE, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly delivery: EmailDeliveryService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<PasswordSetupEmailJob>) {
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: job.data.userId,
        tokenHash: job.data.tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!token) {
      this.logger.log(`Skipped stale password-reset email job ${job.id ?? "(unknown)"}.`);
      return;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: job.data.userId },
      select: { email: true, name: true },
    });
    if (!user) {
      this.logger.log(`Skipped password-reset email for deleted user in job ${job.id ?? "(unknown)"}.`);
      return;
    }

    try {
      await this.delivery.sendPasswordSetup(
        user.email,
        user.name,
        this.encryption.decrypt(job.data.encryptedToken),
        job.data.expiresInSeconds,
      );
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts) {
        await this.prisma.passwordResetToken.updateMany({
          where: { tokenHash: job.data.tokenHash, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      this.logger.error(
        `Email delivery job ${job.id ?? "(unknown)"} failed.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
    await this.prisma.$transaction(async (transaction) => {
      const stillCurrent = await transaction.passwordResetToken.findFirst({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { userId: true },
      });
      if (!stillCurrent) return;
      await transaction.user.update({
        where: { id: job.data.userId },
        data: { mustSetPassword: true },
      });
      await transaction.authSession.updateMany({
        where: { userId: job.data.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}

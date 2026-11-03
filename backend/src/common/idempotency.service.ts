import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { getRuntimeConfig } from "../config/runtime-config";

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    userId: string,
    key: string,
    method: string,
    path: string,
    requestHash: string,
    handler: () => Promise<T>,
  ): Promise<{ result: T; replayed: boolean }> {
    const now = new Date();
    await this.prisma.idempotencyRecord.deleteMany({
      where: { userId, expiresAt: { lte: now } },
    });

    let record;
    try {
      record = await this.prisma.idempotencyRecord.create({
        data: {
          userId,
          key,
          method,
          path,
          requestHash,
          status: "PROCESSING",
          expiresAt: new Date(now.getTime() + getRuntimeConfig().idempotencyRetentionHours * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { userId_key: { userId, key } },
      });
      if (!existing) throw error;
      if (existing.requestHash !== requestHash || existing.method !== method || existing.path !== path) {
        throw new ConflictException({
          message: "La clave de idempotencia ya se utilizó con una solicitud diferente.",
          errors: ["IDEMPOTENCY_KEY_REUSED"],
        });
      }
      if (existing.status !== "COMPLETED" || existing.response === null) {
        throw new ConflictException({
          message: "La operación con esta clave todavía está en curso.",
          errors: ["IDEMPOTENCY_REQUEST_IN_PROGRESS"],
        });
      }
      return {
        result: JSON.parse(JSON.stringify(existing.response)) as T,
        replayed: true,
      };
    }

    try {
      const result = await handler();
      await this.prisma.idempotencyRecord.update({
        where: { id: record.id },
        data: {
          status: "COMPLETED",
          response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        },
      });
      return { result, replayed: false };
    } catch (error) {
      await this.prisma.idempotencyRecord.delete({ where: { id: record.id } });
      throw error;
    }
  }
}

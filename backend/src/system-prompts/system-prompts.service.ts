import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface SystemPromptInput {
  title: string;
  instructions: string;
}

@Injectable()
export class SystemPromptsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.systemPromptVersion.findMany({
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        title: true,
        instructions: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getActive() {
    const active = await this.prisma.systemPromptVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });
    if (!active) {
      throw new ServiceUnavailableException({
        message: "No hay una versión activa de las instrucciones del sistema.",
        errors: ["SYSTEM_PROMPT_NOT_CONFIGURED"],
      });
    }
    return active;
  }

  async createVersion(input: SystemPromptInput, createdById: string) {
    this.validate(input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.systemPromptVersion.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        const latest = await transaction.systemPromptVersion.findFirst({
          orderBy: { version: "desc" },
          select: { version: true },
        });
        return transaction.systemPromptVersion.create({
          data: {
            version: (latest?.version ?? 0) + 1,
            title: input.title.trim(),
            instructions: input.instructions.trim(),
            isActive: true,
            createdById,
          },
          select: {
            id: true,
            version: true,
            title: true,
            instructions: true,
            isActive: true,
            createdAt: true,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")) {
        throw new ConflictException({
          message: "Otra versión se guardó al mismo tiempo. Actualiza el historial e inténtalo de nuevo.",
          errors: ["SYSTEM_PROMPT_VERSION_CONFLICT"],
        });
      }
      throw error;
    }
  }

  async activate(id: string) {
    const prompt = await this.prisma.systemPromptVersion.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException({
        message: "No se encontró la versión de instrucciones.",
        errors: ["SYSTEM_PROMPT_VERSION_NOT_FOUND"],
      });
    }
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.systemPromptVersion.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        await transaction.systemPromptVersion.update({
          where: { id },
          data: { isActive: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")) {
        throw new ConflictException({
          message: "Otra versión se activó al mismo tiempo. Actualiza el historial e inténtalo de nuevo.",
          errors: ["SYSTEM_PROMPT_ACTIVATION_CONFLICT"],
        });
      }
      throw error;
    }
    return this.prisma.systemPromptVersion.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        version: true,
        title: true,
        instructions: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  private validate(input: SystemPromptInput) {
    if (!input || typeof input.title !== "string" || !input.title.trim() ||
        input.title.trim().length > 100 ||
        typeof input.instructions !== "string" || !input.instructions.trim() ||
        input.instructions.trim().length > 30_000) {
      throw new BadRequestException({
        message: "Indica un título y unas instrucciones de hasta 30 000 caracteres.",
        errors: ["INVALID_SYSTEM_PROMPT"],
      });
    }
  }
}

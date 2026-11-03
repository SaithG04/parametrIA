import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser, Public, Roles } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ApiMessage } from "../common/api-message.decorator";
import { ProvidersService } from "./providers.service";
import { IdempotencyInterceptor } from "../common/idempotency.interceptor";
import { FileStorageService } from "../storage/storage.service";
import type { Express } from "express";

interface ProviderBody {
  name: string;
  logoUrl?: string;
  baseUrl: string;
  protocol: "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GEMINI";
}

@Controller("providers")
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly storage: FileStorageService,
  ) {}

  @Get()
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
  ) {
    return this.providers.list(page, pageSize, search);
  }

  @Post(":id/models")
  @Roles(UserRole.INSTRUCTOR)
  listModels(
    @Param("id") id: string,
    @Body() body: { credentialId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.providers.listModelsForInstructor(id, body.credentialId, user);
  }

  @Post(":id/models/byok")
  @Roles(UserRole.STUDENT)
  listModelsWithKey(
    @Param("id") id: string,
    @Body() body: { apiKey: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.providers.listModelsWithKey(id, body.apiKey, user);
  }

  @Post("logo")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  @ApiMessage("Logo cargado.")
  async uploadLogo(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException({ message: "Sube un logo en formato JPG, PNG o WebP (máximo 2 MB).", errors: ["INVALID_PROVIDER_LOGO"] });
    }
    const key = await this.storage.saveProviderLogo({
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });
    return { logoUrl: `/api/providers/logo?key=${encodeURIComponent(key)}` };
  }

  @Get("logo")
  @Public()
  async getLogo(@Query("key") key: string, @Res() response: Response) {
    if (!key?.startsWith("provider-logos/") || key.includes("..")) {
      throw new BadRequestException({ message: "La ruta del logo no es válida.", errors: ["INVALID_PROVIDER_LOGO"] });
    }
    const object = await this.storage.getProviderLogo(key);
    response.setHeader("Content-Type", object.ContentType ?? "application/octet-stream");
    response.setHeader("Cache-Control", "public, max-age=86400, immutable");
    response.send(Buffer.from(await object.Body!.transformToByteArray()));
  }

  @Post()
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Proveedor de IA registrado.")
  create(@Body() body: ProviderBody) {
    return this.providers.create(body);
  }

  @Put(":id")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Proveedor actualizado.")
  update(@Param("id") id: string, @Body() body: ProviderBody) {
    return this.providers.update(id, body);
  }

  @Delete(":id")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Proveedor eliminado.")
  remove(@Param("id") id: string) {
    return this.providers.remove(id);
  }
}

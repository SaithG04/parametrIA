import { Body, Controller, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ApiMessage } from "../common/api-message.decorator";
import { IdempotencyInterceptor } from "../common/idempotency.interceptor";
import { SystemPromptsService, type SystemPromptInput } from "./system-prompts.service";

@Controller("system-prompts")
@Roles(UserRole.SUPERADMIN)
export class SystemPromptsController {
  constructor(private readonly systemPrompts: SystemPromptsService) {}

  @Get()
  list() {
    return this.systemPrompts.list();
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Nueva versión de instrucciones creada y activada.")
  create(@Body() body: SystemPromptInput, @CurrentUser() user: AuthenticatedUser) {
    return this.systemPrompts.createVersion(body, user.id);
  }

  @Put(":id/activate")
  @ApiMessage("Versión de instrucciones activada.")
  activate(@Param("id") id: string) {
    return this.systemPrompts.activate(id);
  }
}

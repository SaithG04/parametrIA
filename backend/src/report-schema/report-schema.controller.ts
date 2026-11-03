import { Body, Controller, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { ApiMessage } from "../common/api-message.decorator";
import { IdempotencyInterceptor } from "../common/idempotency.interceptor";
import { ReportSchemaService, type ReportFieldInput } from "./report-schema.service";

@Controller("report-schema-fields")
@Roles(UserRole.SUPERADMIN)
export class ReportSchemaController {
  constructor(private readonly reportSchema: ReportSchemaService) {}

  @Get()
  list() {
    return this.reportSchema.list();
  }

  @Get("active")
  @Roles(UserRole.SUPERADMIN, UserRole.INSTRUCTOR)
  listActive() {
    return this.reportSchema.listActive();
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Campo de reporte creado.")
  create(@Body() body: ReportFieldInput) {
    return this.reportSchema.create(body);
  }

  @Put(":id")
  @ApiMessage("Campo de reporte actualizado.")
  update(@Param("id") id: string, @Body() body: ReportFieldInput) {
    return this.reportSchema.update(id, body);
  }

  @Put(":id/status")
  @ApiMessage("Estado del campo actualizado.")
  setStatus(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.reportSchema.setStatus(id, body.isActive);
  }
}

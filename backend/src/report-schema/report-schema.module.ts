import { Module } from "@nestjs/common";
import { ReportSchemaController } from "./report-schema.controller";
import { ReportSchemaService } from "./report-schema.service";

@Module({
  controllers: [ReportSchemaController],
  providers: [ReportSchemaService],
  exports: [ReportSchemaService],
})
export class ReportSchemaModule {}

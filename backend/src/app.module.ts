import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ClassroomsModule } from "./classrooms/classrooms.module";
import { CommonModule } from "./common/common.module";
import { QueueModule } from "./common/queue.module";
import { DirectoryModule } from "./directory/directory.module";
import { EvaluationsModule } from "./evaluations/evaluations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProvidersModule } from "./providers/providers.module";
import { ReportSchemaModule } from "./report-schema/report-schema.module";
import { StorageModule } from "./storage/storage.module";
import { StatsModule } from "./stats/stats.module";
import { SystemPromptsModule } from "./system-prompts/system-prompts.module";
import { LegalModule } from "./legal/legal.module";

@Module({
  imports: [
    CommonModule,
    QueueModule,
    PrismaModule,
    AuthModule,
    ProvidersModule,
    ReportSchemaModule,
    StorageModule,
    DirectoryModule,
    ClassroomsModule,
    EvaluationsModule,
    StatsModule,
    SystemPromptsModule,
    LegalModule,
  ],
})
export class AppModule {}

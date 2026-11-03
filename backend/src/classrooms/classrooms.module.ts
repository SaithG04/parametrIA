import { Module } from "@nestjs/common";
import { EncryptionService } from "../common/encryption.service";
import { ClassroomsController, InstructorResourcesController } from "./classrooms.controller";
import { ClassroomsService } from "./classrooms.service";
import { ProvidersModule } from "../providers/providers.module";

@Module({
  imports: [ProvidersModule],
  controllers: [ClassroomsController, InstructorResourcesController],
  providers: [ClassroomsService, EncryptionService],
})
export class ClassroomsModule {}

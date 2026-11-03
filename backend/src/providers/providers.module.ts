import { Module } from "@nestjs/common";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";
import { EncryptionService } from "../common/encryption.service";

@Module({
  controllers: [ProvidersController],
  providers: [ProvidersService, EncryptionService],
  exports: [ProvidersService],
})
export class ProvidersModule {}

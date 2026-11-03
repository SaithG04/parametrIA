import { Global, Module } from "@nestjs/common";
import { FileStorageService } from "./storage.service";

@Global()
@Module({ providers: [FileStorageService], exports: [FileStorageService] })
export class StorageModule {}

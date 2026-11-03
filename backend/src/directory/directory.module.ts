import { Module } from "@nestjs/common";
import { DirectoryController } from "./directory.controller";
import { DirectoryService } from "./directory.service";
import { InstructorStudentsService } from "./instructor-students.service";

@Module({ controllers: [DirectoryController], providers: [DirectoryService, InstructorStudentsService] })
export class DirectoryModule {}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ApiMessage } from "../common/api-message.decorator";
import { EvaluationsService } from "./evaluations.service";
import { IdempotencyInterceptor } from "../common/idempotency.interceptor";

interface EvaluationFields {
  classroomId: string;
  providerId?: string;
  apiKey?: string;
  modelId?: string;
}

const DocxFileInterceptor = FileInterceptor("file", {
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".docx")) {
      callback(new BadRequestException({
        message: "Solo se aceptan documentos Word .docx.",
        errors: ["INVALID_FILE_TYPE"],
      }), false);
      return;
    }
    callback(null, true);
  },
});

@Controller("evaluations")
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("classroomId") classroomId?: string,
    @Query("courseId") courseId?: string,
    @Query("studentId") studentId?: string,
    @Query("studentName") studentName?: string,
    @Query("search") search?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.evaluations.list(
      { classroomId, courseId, studentId, studentName, search, dateFrom, dateTo },
      user,
      page,
      pageSize,
    );
  }

  @Post("preview")
  @ApiMessage("Documento convertido para previsualización. No se consumió un intento.")
  @UseInterceptors(DocxFileInterceptor)
  preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: EvaluationFields,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluations.preview(file, fields, user);
  }

  @Get("jobs/active")
  getActiveJob(@CurrentUser() user: AuthenticatedUser) {
    return this.evaluations.getActiveJob(user);
  }

  @Get("jobs/:id")
  getJob(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evaluations.getJob(id, user);
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evaluations.get(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiMessage("Evaluación recibida y puesta en cola.")
  @UseInterceptors(DocxFileInterceptor, IdempotencyInterceptor)
  enqueue(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: EvaluationFields,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluations.enqueue(file, fields, user);
  }

  @Post("byok")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiMessage("Evaluación recibida y puesta en cola.")
  @UseInterceptors(DocxFileInterceptor, IdempotencyInterceptor)
  enqueueByok(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: EvaluationFields,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluations.enqueue(file, fields, user, true);
  }
}

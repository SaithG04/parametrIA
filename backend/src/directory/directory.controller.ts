import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { memoryStorage } from "multer";
import type { Response } from "express";
import type { Express } from "express";
import { CurrentUser, Public, Roles } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ApiMessage } from "../common/api-message.decorator";
import { DirectoryService } from "./directory.service";
import { InstructorStudentsService } from "./instructor-students.service";
import { IdempotencyInterceptor } from "../common/idempotency.interceptor";
import { createStudentTemplate, readStudentWorkbook } from "./student-spreadsheet";
import { FileStorageService } from "../storage/storage.service";

const spreadsheetMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

@Controller()
export class DirectoryController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly studentDirectory: InstructorStudentsService,
    private readonly storage: FileStorageService,
  ) {}

  @Get("instructor/students/template")
  @Roles(UserRole.INSTRUCTOR)
  async studentTemplate(@Res() response: Response) {
    const buffer = await createStudentTemplate();
    response.setHeader("Content-Type", spreadsheetMimeType);
    response.setHeader("Content-Disposition", 'attachment; filename="parametria-estudiantes.xlsx"');
    response.send(buffer);
  }

  @Post("instructor/students")
  @Roles(UserRole.INSTRUCTOR)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Estudiante creado y matriculado.")
  createInstructorStudent(
    @Body() body: { name: string; email: string; classroomIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentDirectory.createInstructorStudent(body, user);
  }

  @Get("instructor/students")
  @Roles(UserRole.INSTRUCTOR)
  instructorStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("classroomId") classroomId?: string,
  ) {
    return this.studentDirectory.listInstructorStudents(user, page, pageSize, search, classroomId);
  }

  @Post("instructor/students/import")
  @Roles(UserRole.INSTRUCTOR)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiMessage("Importación procesada.")
  async importInstructorStudents(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file || !file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new BadRequestException({ message: "Sube una plantilla Excel .xlsx.", errors: ["INVALID_STUDENT_IMPORT"] });
    }
    let rows: unknown[][];
    try {
      rows = await readStudentWorkbook(file.buffer);
    } catch {
      throw new BadRequestException({ message: "No se pudo leer el archivo Excel.", errors: ["INVALID_STUDENT_IMPORT"] });
    }
    const headers = rows[0]?.map((value) => String(value).trim().toLowerCase());
    if (!headers || !["nombre", "correo", "aulas"].every((header) => headers.includes(header))) {
      throw new BadRequestException({ message: "La hoja debe incluir las columnas nombre, correo y aulas.", errors: ["INVALID_STUDENT_TEMPLATE"] });
    }
    const indexOf = (header: string) => headers.indexOf(header);
    const parsedRows = rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      name: String(row[indexOf("nombre")] ?? "").trim(),
      email: String(row[indexOf("correo")] ?? "").trim(),
      classroomCodes: String(row[indexOf("aulas")] ?? "").split(",").map((code) => code.trim()).filter(Boolean),
    })).filter((row) => row.name || row.email || row.classroomCodes.length);
    if (!parsedRows.length || parsedRows.length > 500) {
      throw new BadRequestException({ message: "El archivo debe tener entre 1 y 500 filas de estudiantes.", errors: ["INVALID_STUDENT_IMPORT_SIZE"] });
    }
    return this.studentDirectory.importInstructorStudents(parsedRows, user);
  }

  @Put("instructor/students/:id/classrooms")
  @Roles(UserRole.INSTRUCTOR)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Aulas del estudiante actualizadas.")
  assignStudentClassrooms(
    @Param("id") id: string,
    @Body() body: { classroomIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentDirectory.assignStudentClassrooms(id, body.classroomIds, user);
  }

  @Get("universities")
  @Roles(UserRole.SUPERADMIN)
  universities(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
  ) {
    return this.directory.listUniversities(page, pageSize, search);
  }

  @Post("universities/logo")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  @ApiMessage("Logo institucional cargado.")
  async uploadUniversityLogo(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException({ message: "Sube un logo en formato JPG, PNG o WebP (máximo 2 MB).", errors: ["INVALID_UNIVERSITY_LOGO"] });
    }
    const key = await this.storage.saveUniversityLogo({
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });
    return { logoUrl: `/api/universities/logo?key=${encodeURIComponent(key)}` };
  }

  @Get("universities/logo")
  @Public()
  async getUniversityLogo(@Query("key") key: string, @Res() response: Response) {
    if (!key?.startsWith("university-logos/") || key.includes("..")) {
      throw new BadRequestException({ message: "La ruta del logo institucional no es válida.", errors: ["INVALID_UNIVERSITY_LOGO"] });
    }
    const object = await this.storage.getUniversityLogo(key);
    response.setHeader("Content-Type", object.ContentType ?? "application/octet-stream");
    response.setHeader("Cache-Control", "public, max-age=86400, immutable");
    response.send(Buffer.from(await object.Body!.transformToByteArray()));
  }

  @Post("universities")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Universidad registrada.")
  createUniversity(@Body() body: { name: string; domain?: string; logoUrl?: string; primaryColor?: string; accentColor?: string }) {
    return this.directory.createUniversity(body);
  }

  @Put("universities/:id")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Universidad actualizada.")
  updateUniversity(@Param("id") id: string, @Body() body: { name?: string; domain?: string; logoUrl?: string; primaryColor?: string; accentColor?: string }) {
    return this.directory.updateUniversity(id, body);
  }

  @Delete("universities/:id")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Universidad eliminada.")
  deleteUniversity(@Param("id") id: string) {
    return this.directory.deleteUniversity(id);
  }

  @Get("users")
  @Roles(UserRole.SUPERADMIN)
  users(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
    @Query("role") role?: string,
    @Query("universityId") universityId?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.directory.listUsers(page, pageSize, { search, role, universityId, isActive });
  }

  @Post("users")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Usuario creado.")
  createUser(@Body() body: { name: string; email: string; role: string; universityId?: string | null }) {
    return this.directory.createUser(body);
  }

  @Post("users/:id/password-reset")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Enlace de restablecimiento enviado.")
  async sendPasswordReset(@Param("id") id: string) {
    await this.directory.sendPasswordReset(id);
    return null;
  }

  @Put("users/:id")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Usuario actualizado.")
  updateUser(
    @Param("id") id: string,
    @Body() body: { name?: string; email?: string; password?: string; role?: string; universityId?: string | null },
  ) {
    return this.directory.updateUser(id, body);
  }

  @Put("users/:id/status")
  @Roles(UserRole.SUPERADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Estado del usuario actualizado.")
  setUserStatus(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.directory.setUserStatus(id, body.isActive);
  }
}

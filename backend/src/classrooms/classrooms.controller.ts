import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ApiMessage } from "../common/api-message.decorator";
import { ClassroomsService } from "./classrooms.service";
import { IdempotencyInterceptor } from "../common/idempotency.interceptor";

@Controller("classrooms")
export class ClassroomsController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
  ) {
    if (user.role !== UserRole.INSTRUCTOR && user.role !== UserRole.STUDENT) {
      throw new BadRequestException({ message: "Se requiere un rol de docente o estudiante y su usuario.", errors: ["INVALID_CLASSROOM_QUERY"] });
    }
    return this.classrooms.listMine(user.role, user.id, page, pageSize, search);
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classrooms.get(id, user);
  }

  @Put(":id/config")
  @ApiMessage("Configuración de IA guardada.")
  @UseInterceptors(IdempotencyInterceptor)
  saveConfig(
    @Param("id") id: string,
    @Body() body: {
      providerId: string;
      credentialId: string;
      selectedModels: string[];
      selectedReportFields?: string[];
      userPrompt: string;
      rubricText: string;
      dailyLimit: number;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.saveConfig(id, body, user);
  }
}

@Controller()
export class InstructorResourcesController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Get("courses")
  courses(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string,
  ) {
    return this.classrooms.listCourses(user, page, pageSize, search);
  }

  @Post("courses")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Curso creado.")
  createCourse(@Body() body: { name: string; description?: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.classrooms.createCourse(body, user);
  }

  @Put("courses/:id")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Curso actualizado.")
  updateCourse(
    @Param("id") id: string,
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.updateCourse(id, body, user);
  }

  @Put("courses/:id/status")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Estado del curso actualizado.")
  setCourseStatus(
    @Param("id") id: string,
    @Body() body: { isActive: boolean; confirmationName: string; password: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.setCourseStatus(id, body, user);
  }

  @Post("courses/:courseId/classrooms")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Aula creada.")
  createClassroom(
    @Param("courseId") courseId: string,
    @Body() body: { name: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.createClassroom(courseId, body, user);
  }

  @Put("instructor/classrooms/:id")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Aula actualizada.")
  updateClassroom(
    @Param("id") id: string,
    @Body() body: { name: string; courseId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.updateClassroom(id, body, user);
  }

  @Put("instructor/classrooms/:id/status")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Estado del aula actualizado.")
  setClassroomStatus(
    @Param("id") id: string,
    @Body() body: { isActive: boolean; confirmationName: string; password: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.setClassroomStatus(id, body, user);
  }

  @Get("instructor/credentials")
  credentials(@CurrentUser() user: AuthenticatedUser) {
    return this.classrooms.listCredentials(user);
  }

  @Post("instructor/credentials")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Credencial guardada.")
  saveCredential(
    @Body() body: { id?: string; name: string; providerId: string; apiKey: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classrooms.saveCredential(body, user);
  }

  @Delete("instructor/credentials/:id")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiMessage("Credencial eliminada.")
  deleteCredential(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classrooms.deleteCredential(id, user);
  }
}

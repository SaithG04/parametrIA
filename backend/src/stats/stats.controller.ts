import { Controller, Get } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get("superadmin")
  @Roles(UserRole.SUPERADMIN)
  getSuperadminStats() {
    return this.stats.getSuperadminStats();
  }

  @Get("instructor")
  @Roles(UserRole.INSTRUCTOR)
  getInstructorStats(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.getInstructorStats(user.id);
  }

  @Get("student")
  @Roles(UserRole.STUDENT)
  getStudentStats(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.getStudentStats(user.id);
  }
}

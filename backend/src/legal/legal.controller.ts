import { Controller, Get, Post } from "@nestjs/common";
import { ApiMessage } from "../common/api-message.decorator";
import { AllowPendingLegal, CurrentUser, Public } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { LegalService } from "./legal.service";

@Controller("legal")
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Get("documents")
  @Public()
  @ApiMessage("Documentos legales vigentes.")
  documents() {
    return this.legal.documents();
  }

  @Get("status")
  @AllowPendingLegal()
  @ApiMessage("Estado de aceptación legal.")
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.legal.status(user);
  }

  @Post("accept")
  @AllowPendingLegal()
  @ApiMessage("Aceptación registrada.")
  accept(@CurrentUser() user: AuthenticatedUser) {
    return this.legal.accept(user);
  }
}

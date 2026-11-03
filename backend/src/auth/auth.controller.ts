import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import type { Request, Response } from "express";
import { ApiMessage } from "../common/api-message.decorator";
import { getRuntimeConfig } from "../config/runtime-config";
import { AllowPendingLegal, CurrentUser, Public } from "./auth.decorators";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./auth.types";

class LoginRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Public()
  @HttpCode(200)
  @ApiMessage("Sesión iniciada.")
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertAllowedOrigin(request);
    const result = await this.auth.login(body.email, body.password, request);
    this.setRefreshCookie(response, result.refreshToken);
    return result.auth;
  }

  @Post("refresh")
  @Public()
  @HttpCode(200)
  @ApiMessage("Sesión renovada.")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertAllowedOrigin(request);
    const config = getRuntimeConfig();
    const result = await this.auth.refresh(request.cookies?.[config.refreshCookieName], request);
    this.setRefreshCookie(response, result.refreshToken);
    return result.auth;
  }

  @Post("logout")
  @AllowPendingLegal()
  @HttpCode(200)
  @ApiMessage("Sesión cerrada.")
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertAllowedOrigin(request);
    await this.auth.logout(user.id, user.sessionId);
    const config = getRuntimeConfig();
    response.clearCookie(config.refreshCookieName, this.cookieOptions());
    return null;
  }

  @Post("password/forgot")
  @Public()
  @HttpCode(200)
  @ApiMessage("Si la cuenta existe, recibirás un enlace para configurar la contraseña.")
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(body.email);
    return null;
  }

  @Post("password/reset")
  @Public()
  @HttpCode(200)
  @ApiMessage("Contraseña configurada. Inicia sesión con tu nueva clave.")
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.auth.completePasswordReset(body.token, body.password);
    return null;
  }

  private setRefreshCookie(response: Response, token: string) {
    const config = getRuntimeConfig();
    response.cookie(config.refreshCookieName, token, {
      ...this.cookieOptions(),
      httpOnly: true,
      maxAge: config.refreshTtlSeconds * 1000,
    });
  }

  private assertAllowedOrigin(request: Request) {
    const origin = request.get("origin");
    const allowedOrigins = getRuntimeConfig().corsOrigins;
    if (origin && !allowedOrigins.includes(origin)) {
      throw new ForbiddenException({
        message: "El origen no está autorizado para autenticación.",
        errors: ["AUTH_ORIGIN_DENIED"],
      });
    }
  }

  private cookieOptions() {
    const config = getRuntimeConfig();
    return {
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      path: `/${config.apiPrefix}/auth`,
      ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
    };
  }
}

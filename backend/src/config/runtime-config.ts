import { randomUUID } from "node:crypto";
import { InternalServerErrorException } from "@nestjs/common";

function required(name: string, value: string | undefined, minimumLength = 1): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length < minimumLength) {
    throw new InternalServerErrorException(
      `Invalid runtime configuration: ${name} must contain at least ${minimumLength} characters.`,
    );
  }
  return normalized;
}

function positiveInteger(name: string, value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InternalServerErrorException(`Invalid runtime configuration: ${name} must be a positive integer.`);
  }
  return parsed;
}

export interface RuntimeConfig {
  environment: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  accessSecret: Uint8Array;
  refreshSecret: Uint8Array;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  passwordResetTtlSeconds: number;
  refreshCookieName: string;
  cookieSecure: boolean;
  cookieSameSite: "strict" | "lax" | "none";
  cookieDomain?: string;
  issuer: string;
  audience: string;
  idempotencyRetentionHours: number;
  trustProxy: boolean | number;
}

let cached: RuntimeConfig | undefined;

export function getRuntimeConfig(): RuntimeConfig {
  if (cached) return cached;

  const environment = process.env["NODE_ENV"]?.trim() || "development";
  const accessSecret = required("ACCESS_TOKEN_SECRET", process.env["ACCESS_TOKEN_SECRET"], 32);
  const refreshSecret = required("REFRESH_TOKEN_SECRET", process.env["REFRESH_TOKEN_SECRET"], 32);
  if (accessSecret === refreshSecret) {
    throw new InternalServerErrorException("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different.");
  }
  const cookieSameSite = (process.env["COOKIE_SAME_SITE"]?.toLowerCase() || "lax") as RuntimeConfig["cookieSameSite"];
  if (!["strict", "lax", "none"].includes(cookieSameSite)) {
    throw new InternalServerErrorException("COOKIE_SAME_SITE must be strict, lax, or none.");
  }
  const cookieSecureValue = process.env["COOKIE_SECURE"] ?? "false";
  if (!["true", "false"].includes(cookieSecureValue)) {
    throw new InternalServerErrorException("COOKIE_SECURE must be true or false.");
  }
  const cookieSecure = cookieSecureValue === "true";
  if (cookieSameSite === "none" && !cookieSecure) {
    throw new InternalServerErrorException("COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.");
  }
  const origins = required("FRONTEND_ORIGINS", process.env["FRONTEND_ORIGINS"])
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || (environment === "production" && parsed.protocol !== "https:")) {
        throw new Error("Origin must be an origin URL without a path and use HTTPS in production.");
      }
    } catch (error) {
      throw new InternalServerErrorException(`Invalid FRONTEND_ORIGINS value "${origin}": ${String(error)}`);
    }
  }

  const trustProxyValue = process.env["TRUST_PROXY"] ?? "false";
  if (trustProxyValue !== "true" && trustProxyValue !== "false" && !/^\d+$/.test(trustProxyValue)) {
    throw new InternalServerErrorException("TRUST_PROXY must be true, false, or a numeric proxy hop count.");
  }

  cached = {
    environment,
    port: positiveInteger("PORT", process.env["PORT"], 3000),
    apiPrefix: (process.env["API_PREFIX"] || "api").replace(/^\/+|\/+$/g, ""),
    corsOrigins: origins,
    accessSecret: new TextEncoder().encode(accessSecret),
    refreshSecret: new TextEncoder().encode(refreshSecret),
    accessTtlSeconds: positiveInteger("ACCESS_TOKEN_TTL_SECONDS", process.env["ACCESS_TOKEN_TTL_SECONDS"], 900),
    refreshTtlSeconds: positiveInteger("REFRESH_TOKEN_TTL_SECONDS", process.env["REFRESH_TOKEN_TTL_SECONDS"], 604800),
    passwordResetTtlSeconds: positiveInteger(
      "PASSWORD_RESET_TTL_SECONDS",
      process.env["PASSWORD_RESET_TTL_SECONDS"],
      1800,
    ),
    refreshCookieName: required("REFRESH_COOKIE_NAME", process.env["REFRESH_COOKIE_NAME"] || "parametria_refresh"),
    cookieSecure,
    cookieSameSite,
    ...(process.env["COOKIE_DOMAIN"]?.trim() ? { cookieDomain: process.env["COOKIE_DOMAIN"].trim() } : {}),
    issuer: process.env["JWT_ISSUER"]?.trim() || "parametria-api",
    audience: process.env["JWT_AUDIENCE"]?.trim() || "parametria-web",
    idempotencyRetentionHours: positiveInteger(
      "IDEMPOTENCY_RETENTION_HOURS",
      process.env["IDEMPOTENCY_RETENTION_HOURS"],
      24,
    ),
    trustProxy: trustProxyValue === "true"
      ? true
      : trustProxyValue === "false" ? false : Number(trustProxyValue),
  };
  return cached;
}

export function traceId(): string {
  return randomUUID();
}

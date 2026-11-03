import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, ProviderProtocol, UserRole } from "@prisma/client";
import type { Provider } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/encryption.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { paginated, parsePagination } from "../common/pagination";

interface ProviderInput {
  name: string;
  logoUrl?: string;
  baseUrl: string;
  protocol: ProviderProtocol;
}

function isPrivateOrLocalHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 192 && second === 168) return true;
  if (first === 172 && second !== undefined && second >= 16 && second <= 31) return true;
  return false;
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 0 || first === 169 && second === 254 || first !== undefined && first >= 224;
}

function validateProvider(input: ProviderInput) {
  const name = input.name?.trim();
  if (!name || !Object.values(ProviderProtocol).includes(input.protocol)) {
    throw new BadRequestException({
      message: "El nombre y un protocolo válido son obligatorios.",
      errors: ["INVALID_PROVIDER"],
    });
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(input.baseUrl);
  } catch {
    throw new BadRequestException({ message: "La Base URL no es válida.", errors: ["INVALID_PROVIDER_URL"] });
  }
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.pathname.endsWith("/models") ||
    baseUrl.pathname.endsWith("/chat/completions")
  ) {
    throw new BadRequestException({ message: "La Base URL debe ser un endpoint HTTP(S) válido sin credenciales ni parámetros.", errors: ["INVALID_PROVIDER_URL"] });
  }
  if (isBlockedHostname(baseUrl.hostname)) {
    throw new BadRequestException({ message: "La Base URL apunta a un rango de red reservado.", errors: ["INVALID_PROVIDER_URL"] });
  }
  if (baseUrl.protocol === "http:" && !isPrivateOrLocalHostname(baseUrl.hostname)) {
    throw new BadRequestException({ message: "Las URLs HTTP solo se permiten para servicios locales o privados.", errors: ["INSECURE_PROVIDER_URL"] });
  }
  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "");
  const logoUrl = input.logoUrl?.trim() ?? "";
  let logoObjectKey = "";
  try {
    const parsed = new URL(logoUrl, "http://parametria.local");
    if (parsed.pathname === "/api/providers/logo") {
      const key = parsed.searchParams.get("key") ?? "";
      if (key.startsWith("provider-logos/") && !key.includes("..")) logoObjectKey = key;
    }
  } catch {
    throw new BadRequestException({ message: "La URL del logo no es válida.", errors: ["INVALID_PROVIDER_LOGO"] });
  }
  return { name, logoUrl, logoObjectKey, baseUrl: baseUrl.toString().replace(/\/$/, ""), protocol: input.protocol };
}

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async list(page?: string, pageSize?: string, search?: string) {
    const pagination = parsePagination(page, pageSize);
    const where: Prisma.ProviderWhereInput = search?.trim()
      ? { name: { contains: search.trim(), mode: "insensitive" } }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.provider.count({ where }),
    ]);
    return paginated(items, pagination.page, pagination.pageSize, total);
  }

  create(input: ProviderInput) {
    return this.prisma.provider.create({ data: validateProvider(input) });
  }

  async update(id: string, input: ProviderInput) {
    await this.requireProvider(id);
    return this.prisma.provider.update({ where: { id }, data: validateProvider(input) });
  }

  async remove(id: string) {
    await this.requireProvider(id);
    await this.prisma.provider.delete({ where: { id } });
    return null;
  }

  async listModelsForInstructor(providerId: string, credentialId: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.INSTRUCTOR) {
      throw new BadRequestException({ message: "Solo el docente puede consultar modelos con sus credenciales.", errors: ["INVALID_PROVIDER_MODEL_REQUEST"] });
    }
    const [provider, credential] = await Promise.all([
      this.requireProvider(providerId),
      this.prisma.instructorCredential.findFirst({
        where: { id: credentialId, userId: actor.id, providerId },
      }),
    ]);
    if (!credential) {
      throw new NotFoundException({ message: "No se encontró una credencial propia para este proveedor.", errors: ["CREDENTIAL_NOT_FOUND"] });
    }
    return this.discoverModels(provider, this.encryption.decrypt(credential.encryptedKey));
  }

  async listModelsWithKey(providerId: string, apiKey: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.STUDENT) {
      throw new BadRequestException({ message: "Solo un estudiante puede consultar modelos con una clave temporal.", errors: ["INVALID_PROVIDER_MODEL_REQUEST"] });
    }
    if (typeof apiKey !== "string" || apiKey.trim().length < 12 || apiKey.length > 4096) {
      throw new BadRequestException({ message: "La API key temporal no es válida.", errors: ["INVALID_PROVIDER_KEY"] });
    }
    return this.discoverModels(await this.requireProvider(providerId), apiKey.trim());
  }

  async requireProvider(id: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException({ message: "No se encontró el proveedor.", errors: ["PROVIDER_NOT_FOUND"] });
    }
    return provider;
  }

  private async discoverModels(provider: Provider, apiKey: string) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (provider.protocol === ProviderProtocol.ANTHROPIC) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
      if (provider.protocol === ProviderProtocol.GEMINI) {
        delete headers.Authorization;
        headers["x-goog-api-key"] = apiKey;
      }
    }

    let response: Response;
    try {
      response = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/models`, {
        method: "GET",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        message: "No se pudo conectar con el proveedor para cargar sus modelos.",
        errors: ["PROVIDER_UNREACHABLE"],
      });
    }
    if (!response.ok) {
      throw new BadGatewayException({
        message: "El proveedor rechazó la consulta de modelos. Verifica la API key y el endpoint.",
        errors: ["PROVIDER_MODEL_LIST_FAILED"],
      });
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException({
        message: "El proveedor devolvió una respuesta de modelos no válida.",
        errors: ["INVALID_PROVIDER_MODEL_RESPONSE"],
      });
    }
    if (!payload || typeof payload !== "object") {
      throw new BadGatewayException({
        message: "El proveedor devolvió una respuesta de modelos no válida.",
        errors: ["INVALID_PROVIDER_MODEL_RESPONSE"],
      });
    }
    const modelList = provider.protocol === ProviderProtocol.GEMINI
      ? (payload as { models?: unknown }).models
      : (payload as { data?: unknown }).data;
    if (!Array.isArray(modelList)) {
      throw new BadGatewayException({
        message: "La respuesta del proveedor no contiene una lista de modelos compatible.",
        errors: ["INVALID_PROVIDER_MODEL_RESPONSE"],
      });
    }
    const modelIds = modelList.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const record = item as { id?: unknown; name?: unknown; supportedGenerationMethods?: unknown };
      if (
        provider.protocol === ProviderProtocol.GEMINI &&
        Array.isArray(record.supportedGenerationMethods) &&
        !record.supportedGenerationMethods.includes("generateContent")
      ) return [];
      const id = typeof record.id === "string"
        ? record.id
        : typeof record.name === "string"
          ? record.name.replace(/^models\//, "")
          : "";
      return id ? [id] : [];
    });
    return [...new Set(modelIds)].sort((left, right) => left.localeCompare(right));
  }
}

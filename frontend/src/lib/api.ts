import axios, { type AxiosResponse } from "axios";
import { toast } from "sonner";
import { getAccessToken, loginSession, logoutSession } from "@/hooks/use-session";
import type { AuthSession } from "@/services/types";

/**
 * Standardized API envelope used by every backend endpoint:
 * { success: boolean, message: string, data: any, errors: array | null }
 */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: string[] | null;
  path?: string;
}

export class ApiError extends Error {
  code?: string;
  errors?: string[];

  constructor(message: string, errors?: string[] | null) {
    super(message);
    this.name = "ApiError";
    if (errors?.length) {
      this.errors = errors;
      const code = errors[0];
      if (code) this.code = code;
    }
  }
}

export function getUserFacingError(error: unknown, fallback = "No se pudo completar la solicitud. Inténtalo nuevamente.") {
  if (error instanceof ApiError) return error.message;
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiEnvelope<unknown>> | undefined;
    if (body?.success === false && typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (!error.response) return "No se pudo conectar con el servicio. Verifica tu conexión e inténtalo nuevamente.";
    if (error.response.status === 401) return "Tu sesión ya no está disponible. Inicia sesión nuevamente.";
    return fallback;
  }
  return fallback;
}

export const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  withCredentials: true,
});

let refreshRequest: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(undefined, async (error: unknown) => {
  const axiosError = error as {
    config?: AxiosResponse["config"] & { _retried?: boolean };
    response?: { status?: number; data?: ApiEnvelope<unknown> };
  };
  const config = axiosError.config;
  if (axiosError.response?.status !== 401 || !config || config._retried || config.url?.includes("/auth/")) {
    return Promise.reject(error);
  }
  config._retried = true;
  if (!refreshRequest) {
    refreshRequest = axios.post<ApiEnvelope<AuthSession>>("/api/auth/refresh", {}, { withCredentials: true })
      .then(({ data }) => {
        if (!data.success || !data.data?.accessToken) {
          logoutSession();
          return null;
        }
        loginSession(data.data);
        return data.data.accessToken;
      })
      .catch(() => {
        logoutSession();
        return null;
      })
      .finally(() => { refreshRequest = null; });
  }
  const token = await refreshRequest;
  if (!token) return Promise.reject(error);
  config.headers.Authorization = `Bearer ${token}`;
  return api.request(config);
});

/** Extracts `data` when success is true; converts business errors to ApiError. */
export async function unwrap<T>(request: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> {
  try {
    const res = await request;
    const envelope = res.data;
    if (!envelope || typeof envelope.success !== "boolean") {
      throw new ApiError("La respuesta del servidor no tiene el formato esperado.");
    }
    if (!envelope.success) {
      throw new ApiError(envelope.message || "Ocurrió un error inesperado.", envelope.errors);
    }
    return envelope.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const data = (err as { response?: { data?: ApiEnvelope<unknown> } })?.response?.data;
    if (data && data.success === false) {
      throw new ApiError(data.message || "Ocurrió un error inesperado.", data.errors);
    }
    throw err instanceof Error ? err : new Error("Error de red. Intenta de nuevo.");
  }
}

/** Shows the standardized error message as a toast (skips toastable codes). */
export function toastApiError(err: unknown, ...options: unknown[]) {
  const skipCodes = options.flatMap((option) =>
    Array.isArray(option) ? option.filter((code): code is string => typeof code === "string") : [],
  );
  if (err instanceof ApiError) {
    if (err.code && skipCodes.includes(err.code)) return;
  }
  toast.error(getUserFacingError(err));
}

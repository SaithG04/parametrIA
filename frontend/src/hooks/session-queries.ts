import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastApiError } from "@/lib/api";
import { authApi, legalApi } from "@/services/endpoints";
import type { LegalStatus } from "@/services/types";
import { queryKeys } from "./query-keys";

export function useLogin() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => authApi.login(credentials),
  });
}

export function useLegalDocuments() {
  return useQuery({
    queryKey: queryKeys.legalDocuments,
    queryFn: legalApi.documents,
    staleTime: 60 * 60 * 1000,
  });
}

export function useLegalStatus(userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalStatus(userId),
    queryFn: legalApi.status,
    enabled: Boolean(userId) && enabled,
    staleTime: 0,
  });
}

export function useAcceptLegal(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: legalApi.accept,
    onSuccess: (status: LegalStatus) => {
      client.setQueryData(queryKeys.legalStatus(userId), status);
      toast.success("Aceptación registrada.");
    },
    onError: toastApiError,
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: authApi.requestPasswordReset,
    onError: toastApiError,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: authApi.resetPassword,
    onError: toastApiError,
  });
}

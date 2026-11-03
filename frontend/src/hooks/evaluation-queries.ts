import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, toastApiError } from "@/lib/api";
import { evaluationsApi, type EvaluationFilters } from "@/services/endpoints";
import type { EvaluationJob } from "@/services/types";
import { queryKeys } from "./query-keys";
import { invalidate } from "./query-utils";

export function useEvaluations(
  filters: EvaluationFilters = {},
  page = 1,
  pageSize = 10,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.evaluations({ ...filters, page: String(page), pageSize: String(pageSize) }),
    queryFn: () => evaluationsApi.list(filters, page, pageSize),
    enabled,
  });
}

export function useEvaluation(id: string, enabled = true) {
  return useQuery({
    queryKey: ["evaluations", "item", id],
    queryFn: () => evaluationsApi.get(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useSubmitEvaluation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, onUploadProgress }: {
      input: Parameters<typeof evaluationsApi.submit>[0];
      onUploadProgress?: (progress: number) => void;
    }) => evaluationsApi.submit(input, onUploadProgress),
    onSuccess: () => invalidate(client, [queryKeys.activeJob]),
    onError: (error) => toastApiError(error, ["DAILY_LIMIT_REACHED"]),
  });
}

export function useSubmitByok() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, onUploadProgress }: {
      input: Parameters<typeof evaluationsApi.submitByok>[0];
      onUploadProgress?: (progress: number) => void;
    }) => evaluationsApi.submitByok(input, onUploadProgress),
    onSuccess: () => invalidate(client, [queryKeys.activeJob]),
    onError: toastApiError,
  });
}

export function usePreviewEvaluation() {
  return useMutation({
    mutationFn: ({ classroomId, file }: { classroomId: string; file: File }) => evaluationsApi.preview(classroomId, file),
    onError: toastApiError,
  });
}

export function useActiveEvaluationJob(enabled = true) {
  return useQuery({
    queryKey: queryKeys.activeJob,
    queryFn: evaluationsApi.activeJob,
    enabled,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "WAITING" || status === "PROCESSING" ? 15_000 : false;
    },
  });
}

export function useEvaluationJob(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.job(id),
    queryFn: () => evaluationsApi.job(id),
    enabled: Boolean(id) && enabled,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "WAITING" || status === "PROCESSING" ? 15_000 : false;
    },
  });
}

export function isDailyLimitError(error: unknown) {
  return error instanceof ApiError && error.code === "DAILY_LIMIT_REACHED";
}

export type { EvaluationJob };

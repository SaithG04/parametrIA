import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { queryKeys } from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import type { EvaluationJob } from "@/services/types";

function isEvaluationJob(value: unknown): value is EvaluationJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<EvaluationJob>;
  return typeof job.id === "string" &&
    ["WAITING", "PROCESSING", "SUCCEEDED", "FAILED"].includes(job.status ?? "") &&
    typeof job.fileName === "string" &&
    typeof job.errorMessage === "string" &&
    (typeof job.evaluationId === "string" || job.evaluationId === null) &&
    typeof job.createdAt === "string";
}

export function useEvaluationJobEvents(enabled = true) {
  const queryClient = useQueryClient();
  const { user, accessToken } = useSession();
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [lastJob, setLastJob] = useState<EvaluationJob | null>(null);

  useEffect(() => {
    if (!enabled || !user?.id || !accessToken) {
      setConnected(false);
      setConnectionError(false);
      setLastJob(null);
      return;
    }

    const socket = io({
      path: "/socket.io",
      auth: { token: accessToken },
      reconnection: true,
    });
    const onConnect = () => {
      setConnected(true);
      setConnectionError(false);
    };
    const onConnectError = () => {
      setConnected(false);
      setConnectionError(true);
    };
    const onStatus = (payload: unknown) => {
      if (!isEvaluationJob(payload)) return;
      setLastJob(payload);
      queryClient.setQueryData(queryKeys.job(payload.id), payload);
      queryClient.setQueryData<EvaluationJob | null>(
        queryKeys.activeJob,
        payload.status === "WAITING" || payload.status === "PROCESSING" ? payload : null,
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", onConnectError);
    socket.on("evaluation:status", onStatus);
    return () => {
      socket.disconnect();
    };
  }, [accessToken, enabled, queryClient, user?.id]);

  return { connected, connectionError, lastJob };
}

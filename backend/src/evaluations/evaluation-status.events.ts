import { z } from "zod";

export const EVALUATION_STATUS_CHANNEL = "evaluation-status";
export const EVALUATION_STATUS_EVENT = "evaluation:status";

export const evaluationStatusEventSchema = z.object({
  studentId: z.string().min(1),
  job: z.object({
    id: z.string().min(1),
    status: z.enum(["WAITING", "PROCESSING", "SUCCEEDED", "FAILED"]),
    fileName: z.string(),
    errorMessage: z.string(),
    evaluationId: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export type EvaluationStatusEvent = z.infer<typeof evaluationStatusEventSchema>;

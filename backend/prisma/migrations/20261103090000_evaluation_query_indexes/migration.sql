CREATE INDEX "Evaluation_classroomId_studentId_jobId_createdAt_idx"
ON "Evaluation"("classroomId", "studentId", "jobId", "createdAt");

DROP INDEX "EvaluationJob_classroomId_studentId_createdAt_idx";
CREATE INDEX "EvaluationJob_classroomId_studentId_createdAt_status_idx"
ON "EvaluationJob"("classroomId", "studentId", "createdAt", "status");

CREATE INDEX "EvaluationJob_status_updatedAt_id_idx"
ON "EvaluationJob"("status", "updatedAt", "id");

CREATE INDEX "EvaluationJob_status_createdAt_id_idx"
ON "EvaluationJob"("status", "createdAt", "id");

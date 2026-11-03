CREATE TYPE "EvaluationJobStatus" AS ENUM ('WAITING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "EvaluationJob" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "EvaluationJobStatus" NOT NULL DEFAULT 'WAITING',
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "isByok" BOOLEAN NOT NULL DEFAULT false,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Evaluation" ADD COLUMN "jobId" TEXT;

CREATE UNIQUE INDEX "Evaluation_jobId_key" ON "Evaluation"("jobId");
CREATE INDEX "EvaluationJob_studentId_status_createdAt_idx" ON "EvaluationJob"("studentId", "status", "createdAt");
CREATE INDEX "EvaluationJob_classroomId_studentId_createdAt_idx" ON "EvaluationJob"("classroomId", "studentId", "createdAt");

ALTER TABLE "EvaluationJob" ADD CONSTRAINT "EvaluationJob_classroomId_fkey"
FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvaluationJob" ADD CONSTRAINT "EvaluationJob_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "EvaluationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

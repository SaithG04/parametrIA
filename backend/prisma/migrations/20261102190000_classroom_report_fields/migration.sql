ALTER TABLE "ClassroomConfig"
ADD COLUMN "selectedReportFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "SystemPromptVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemPromptVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SystemPromptVersion" ("id", "version", "title", "instructions", "isActive")
VALUES (
    'system-prompt-v1',
    1,
    'Instrucciones generales',
    'Evalúa con criterios académicos claros, imparciales y constructivos. Sustenta cada observación con evidencia del documento y distingue los aspectos logrados de aquellos que requieren mejora.',
    true
);

CREATE UNIQUE INDEX "SystemPromptVersion_version_key" ON "SystemPromptVersion"("version");
CREATE INDEX "SystemPromptVersion_isActive_version_idx" ON "SystemPromptVersion"("isActive", "version");
CREATE UNIQUE INDEX "SystemPromptVersion_one_active_idx" ON "SystemPromptVersion"("isActive") WHERE "isActive" = true;

ALTER TABLE "Evaluation" ADD COLUMN "systemPromptVersionId" TEXT NOT NULL DEFAULT 'system-prompt-v1';
ALTER TABLE "Evaluation" ALTER COLUMN "systemPromptVersionId" DROP DEFAULT;

CREATE INDEX "Evaluation_systemPromptVersionId_idx" ON "Evaluation"("systemPromptVersionId");

ALTER TABLE "SystemPromptVersion"
ADD CONSTRAINT "SystemPromptVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Evaluation"
ADD CONSTRAINT "Evaluation_systemPromptVersionId_fkey"
FOREIGN KEY ("systemPromptVersionId") REFERENCES "SystemPromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

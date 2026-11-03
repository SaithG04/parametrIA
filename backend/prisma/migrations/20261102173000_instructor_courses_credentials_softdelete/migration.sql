ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Provider"
ADD COLUMN "logoObjectKey" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instructorId" TEXT NOT NULL,
    "universityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorCredential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstructorCredential_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Classroom"
ADD COLUMN "courseId" TEXT;

ALTER TABLE "ClassroomConfig"
ADD COLUMN "credentialId" TEXT,
ADD COLUMN "selectedModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

INSERT INTO "InstructorCredential" ("id", "name", "userId", "providerId", "encryptedKey", "createdAt", "updatedAt")
SELECT
    'legacy-' || md5(legacy."userId" || ':' || legacy."providerId" || ':' || legacy."apiKey"),
    'Credencial migrada ' || substr(md5(legacy."apiKey"), 1, 8),
    legacy."userId",
    legacy."providerId",
    legacy."apiKey",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT classroom."instructorId" AS "userId", config."providerId", config."apiKey"
    FROM "ClassroomConfig" config
    JOIN "Classroom" classroom ON classroom."id" = config."classroomId"
    WHERE config."apiKey" <> ''
) AS legacy;

UPDATE "ClassroomConfig" config
SET "credentialId" = 'legacy-' || md5(classroom."instructorId" || ':' || config."providerId" || ':' || config."apiKey")
FROM "Classroom" classroom
WHERE classroom."id" = config."classroomId"
  AND config."apiKey" <> '';

UPDATE "ClassroomConfig" config
SET "selectedModels" = ARRAY[provider."models"[1]]
FROM "Provider" provider
WHERE provider."id" = config."providerId"
  AND cardinality(provider."models") > 0;

ALTER TABLE "ClassroomConfig"
DROP COLUMN "apiKey";

CREATE INDEX "Course_instructorId_name_idx" ON "Course"("instructorId", "name");
CREATE UNIQUE INDEX "InstructorCredential_userId_providerId_name_key" ON "InstructorCredential"("userId", "providerId", "name");
CREATE INDEX "InstructorCredential_userId_providerId_idx" ON "InstructorCredential"("userId", "providerId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_universityId_fkey"
FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorCredential"
ADD CONSTRAINT "InstructorCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorCredential"
ADD CONSTRAINT "InstructorCredential_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Classroom"
ADD CONSTRAINT "Classroom_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClassroomConfig"
ADD CONSTRAINT "ClassroomConfig_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "InstructorCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

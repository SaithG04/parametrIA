INSERT INTO "Course" ("id", "name", "description", "instructorId", "universityId", "createdAt", "updatedAt")
SELECT
    'legacy-classroom-' || classroom."id",
    classroom."name",
    'Curso creado al migrar un aula existente',
    classroom."instructorId",
    classroom."universityId",
    classroom."createdAt",
    classroom."updatedAt"
FROM "Classroom" classroom
WHERE classroom."courseId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "Classroom" classroom
SET "courseId" = 'legacy-classroom-' || classroom."id"
WHERE classroom."courseId" IS NULL;

ALTER TABLE "Classroom" ALTER COLUMN "courseId" SET NOT NULL;
ALTER TABLE "Classroom" DROP CONSTRAINT IF EXISTS "Classroom_courseId_fkey";
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

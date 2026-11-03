ALTER TABLE "Course"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Classroom"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "ReportSchemaFieldType" AS ENUM (
    'STRING',
    'NUMBER',
    'BOOLEAN',
    'ENUM',
    'ARRAY_OF_STRINGS',
    'OBJECT',
    'ARRAY_OF_OBJECTS'
);

CREATE TABLE "ReportSchemaField" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ReportSchemaFieldType" NOT NULL,
    "description" TEXT NOT NULL,
    "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "children" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportSchemaField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportSchemaField_key_key" ON "ReportSchemaField"("key");
CREATE INDEX "ReportSchemaField_isActive_sortOrder_idx" ON "ReportSchemaField"("isActive", "sortOrder");

INSERT INTO "ReportSchemaField" ("id", "key", "label", "type", "description", "children", "sortOrder", "updatedAt")
VALUES
(
    'report-field-ficha',
    'ficha',
    'Ficha del documento',
    'OBJECT',
    'Identifica los datos básicos del documento a partir de la evidencia disponible.',
    '[{"key":"titulo","label":"Título","type":"STRING","description":"Título del documento."},{"key":"autor","label":"Autor","type":"STRING","description":"Autor identificado en el documento."},{"key":"objetivo_general","label":"Objetivo general","type":"STRING","description":"Objetivo general declarado por el documento."}]'::jsonb,
    0,
    CURRENT_TIMESTAMP
),
(
    'report-field-tabla-verificacion',
    'tabla_verificacion',
    'Verificación de criterios',
    'ARRAY_OF_OBJECTS',
    'Evalúa cada criterio de la rúbrica y justifica el resultado con evidencia del documento.',
    '[{"key":"criterio","label":"Criterio","type":"STRING","description":"Criterio de la rúbrica evaluado."},{"key":"cumple","label":"Cumple","type":"BOOLEAN","description":"Indica si el criterio se cumple."},{"key":"justificacion","label":"Justificación","type":"STRING","description":"Evidencia y explicación del resultado."}]'::jsonb,
    1,
    CURRENT_TIMESTAMP
),
(
    'report-field-fortalezas',
    'fortalezas',
    'Fortalezas',
    'ARRAY_OF_STRINGS',
    'Enumera las fortalezas del documento que estén respaldadas por evidencia.',
    NULL,
    2,
    CURRENT_TIMESTAMP
),
(
    'report-field-estado-final',
    'estado_final',
    'Estado final',
    'STRING',
    'Presenta una conclusión breve sobre el estado del documento según la rúbrica.',
    NULL,
    3,
    CURRENT_TIMESTAMP
);

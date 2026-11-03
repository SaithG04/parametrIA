CREATE TYPE "ProviderProtocol" AS ENUM ('OPENAI_COMPATIBLE', 'ANTHROPIC', 'GEMINI');

ALTER TABLE "Provider"
ADD COLUMN "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
ADD COLUMN "protocol" "ProviderProtocol" NOT NULL DEFAULT 'OPENAI_COMPATIBLE';

UPDATE "Provider"
SET "baseUrl" = 'https://api.anthropic.com/v1',
    "protocol" = 'ANTHROPIC'
WHERE lower("name") = 'anthropic';

UPDATE "ClassroomConfig"
SET "selectedModels" = array_replace(
  array_replace(
    array_replace(
      array_replace("selectedModels", 'GPT-4o', 'gpt-4o'),
      'GPT-4o mini',
      'gpt-4o-mini'
    ),
    'Claude 3.5 Sonnet',
    'claude-3-5-sonnet-20241022'
  ),
  'Claude 3 Haiku',
  'claude-3-haiku-20240307'
);

ALTER TABLE "Provider" DROP COLUMN "models";

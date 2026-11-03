CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS', 'PRIVACY');

ALTER TABLE "User"
ADD COLUMN "acceptedTermsVersion" TEXT,
ADD COLUMN "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN "acceptedPrivacyVersion" TEXT,
ADD COLUMN "acceptedPrivacyAt" TIMESTAMP(3);

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "LegalDocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalAcceptance_userId_documentType_version_key"
ON "LegalAcceptance"("userId", "documentType", "version");
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx"
ON "LegalAcceptance"("userId", "acceptedAt");

ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

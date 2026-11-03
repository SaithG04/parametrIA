import { Injectable, NotFoundException } from "@nestjs/common";
import { LegalDocumentType } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  DATA_RETENTION,
  PRIVACY_CONTACT,
  PRIVACY_POLICY,
  PRIVACY_VERSION,
  TERMS_OF_SERVICE,
  TERMS_VERSION,
} from "./legal-documents";

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  documents() {
    return {
      terms: {
        version: TERMS_VERSION,
        title: "Términos de uso",
        content: TERMS_OF_SERVICE,
      },
      privacy: {
        version: PRIVACY_VERSION,
        title: "Política de privacidad",
        content: PRIVACY_POLICY,
      },
      privacyContact: PRIVACY_CONTACT,
      retention: DATA_RETENTION,
    };
  }

  async status(actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        acceptedTermsVersion: true,
        acceptedTermsAt: true,
        acceptedPrivacyVersion: true,
        acceptedPrivacyAt: true,
      },
    });
    if (!user) throw new NotFoundException({ message: "No se encontró la cuenta.", errors: ["USER_NOT_FOUND"] });
    return {
      terms: {
        version: TERMS_VERSION,
        accepted: user.acceptedTermsVersion === TERMS_VERSION,
        acceptedAt: user.acceptedTermsVersion === TERMS_VERSION ? user.acceptedTermsAt : null,
      },
      privacy: {
        version: PRIVACY_VERSION,
        accepted: user.acceptedPrivacyVersion === PRIVACY_VERSION,
        acceptedAt: user.acceptedPrivacyVersion === PRIVACY_VERSION ? user.acceptedPrivacyAt : null,
      },
    };
  }

  async accept(actor: AuthenticatedUser) {
    const userExists = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true },
    });
    if (!userExists) throw new NotFoundException({ message: "No se encontró la cuenta.", errors: ["USER_NOT_FOUND"] });

    const acceptedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.legalAcceptance.createMany({
        data: [
          { userId: actor.id, documentType: LegalDocumentType.TERMS, version: TERMS_VERSION, acceptedAt },
          { userId: actor.id, documentType: LegalDocumentType.PRIVACY, version: PRIVACY_VERSION, acceptedAt },
        ],
        skipDuplicates: true,
      }),
      this.prisma.user.update({
        where: { id: actor.id },
        data: {
          acceptedTermsVersion: TERMS_VERSION,
          acceptedTermsAt: acceptedAt,
          acceptedPrivacyVersion: PRIVACY_VERSION,
          acceptedPrivacyAt: acceptedAt,
        },
      }),
    ]);
    return this.status(actor);
  }
}

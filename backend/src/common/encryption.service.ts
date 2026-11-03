import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class EncryptionService {
  private key(): Buffer {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
      throw new InternalServerErrorException({
        message: "Falta configurar ENCRYPTION_KEY para guardar credenciales.",
        errors: ["ENCRYPTION_KEY_MISSING"],
      });
    }
    const key = /^[\da-f]{64}$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new InternalServerErrorException({
        message: "ENCRYPTION_KEY debe representar exactamente 32 bytes.",
        errors: ["ENCRYPTION_KEY_INVALID"],
      });
    }
    return key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
  }

  decrypt(value: string): string {
    const [version, ivText, tagText, ciphertextText] = value.split(":");
    if (version !== "v1" || !ivText || !tagText || !ciphertextText) {
      throw new UnauthorizedException("La credencial guardada no tiene un formato válido.");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(ivText, "base64"));
      decipher.setAuthTag(Buffer.from(tagText, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new UnauthorizedException("No se pudo descifrar la credencial del proveedor.");
    }
  }
}

export interface PasswordSetupEmailJob {
  userId: string;
  encryptedToken: string;
  tokenHash: string;
  expiresInSeconds: number;
}

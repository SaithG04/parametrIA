import type { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    universityId: string | null;
    universityName: string | null;
    universityLogoUrl?: string;
    universityPrimaryColor?: string;
    universityAccentColor?: string;
  };
  accessToken: string;
  expiresIn: number;
}

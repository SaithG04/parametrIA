import type { Role } from "@/services/types";

export const queryKeys = {
  providers: ["providers"] as const,
  universities: ["universities"] as const,
  users: ["users"] as const,
  classrooms: (role: Role, userId: string) => ["classrooms", role, userId] as const,
  classroom: (id: string) => ["classroom", id] as const,
  courses: ["courses"] as const,
  credentials: ["credentials"] as const,
  students: ["instructor-students"] as const,
  evaluations: (filters: Record<string, string | undefined>) => ["evaluations", filters] as const,
  activeJob: ["evaluations", "active-job"] as const,
  job: (id: string) => ["evaluations", "job", id] as const,
  reportFields: ["report-schema-fields", "active"] as const,
  reportSchemaFields: ["report-schema-fields", "admin"] as const,
  systemPrompts: ["system-prompts"] as const,
  stats: ["stats", "superadmin"] as const,
  legalStatus: (userId: string) => ["legal-status", userId] as const,
  legalDocuments: ["legal-documents"] as const,
  instructorStats: ["stats", "instructor"] as const,
  studentStats: ["stats", "student"] as const,
};

export type Role = "SUPERADMIN" | "INSTRUCTOR" | "STUDENT";
export type ProviderProtocol = "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GEMINI";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  universityId: string | null;
  universityName: string | null;
  universityLogoUrl?: string;
  universityPrimaryColor?: string;
  universityAccentColor?: string;
}

export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  expiresIn: number;
}

export interface LegalDocument {
  version: string;
  title: string;
  content: string;
}

export interface LegalDocuments {
  terms: LegalDocument;
  privacy: LegalDocument;
  privacyContact: string;
  retention: {
    sourceDocumentDays: number;
    evaluationReportMonths: number;
  };
}

export interface LegalStatus {
  terms: { version: string; accepted: boolean; acceptedAt: string | null };
  privacy: { version: string; accepted: boolean; acceptedAt: string | null };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface AiProvider {
  id: string;
  name: string;
  logoUrl: string;
  baseUrl: string;
  protocol: ProviderProtocol;
  models?: string[];
}

export interface ProviderInput {
  name: string;
  logoUrl: string;
  baseUrl: string;
  protocol: ProviderProtocol;
}

export interface University {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  userCount: number;
}

export interface ClassroomMembership {
  id: string;
  name: string;
  code: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  universityId: string | null;
  universityName: string | null;
  isActive: boolean;
  classrooms?: ClassroomMembership[];
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  universityId?: string | null;
  password?: string;
}

export interface AiConfigInput {
  providerId: string;
  credentialId: string;
  selectedModels: string[];
  selectedReportFields: string[];
  userPrompt: string;
  rubricText: string;
  dailyLimit: number;
}

export interface Classroom {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  courseId: string;
  courseName: string;
  courseIsActive: boolean;
  universityId: string;
  instructorId: string;
  studentIds: string[];
  config: AiConfigInput & { credentialName: string };
}

export interface Course {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  classroomCount: number;
}

export interface InstructorCredential {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  provider: Pick<AiProvider, "id" | "name" | "logoUrl">;
}

export interface InstructorStudent extends UserRecord {
  classrooms: ClassroomMembership[];
}

export type ReportFieldType =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "ENUM"
  | "ARRAY_OF_STRINGS"
  | "OBJECT"
  | "ARRAY_OF_OBJECTS";

export interface ReportSchemaChildDefinition {
  id?: string;
  key: string;
  label: string;
  type: ReportFieldType;
  description: string;
  options?: string[];
  isRequired?: boolean;
}

export interface ReportSchemaFieldDefinition extends ReportSchemaChildDefinition {
  id: string;
  isRequired: boolean;
  children?: ReportSchemaChildDefinition[];
}

export interface ReportSchemaField extends ReportSchemaFieldDefinition {
  isActive: boolean;
  sortOrder: number;
}

export interface SystemPromptVersion {
  id: string;
  version: number;
  title: string;
  instructions: string;
  isActive: boolean;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  classroomId: string;
  classroomName: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  fileName: string;
  providerName: string;
  model: string;
  createdAt: string;
  report: Record<string, unknown> & { providerName?: string; model?: string };
}

export interface EvaluationJob {
  id: string;
  status: "WAITING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  fileName: string;
  errorMessage: string;
  evaluationId: string | null;
  createdAt: string;
}

export interface Report {
  overallScore?: number;
  summary?: string;
  sections?: Array<{
    name: string;
    score: number;
    maxScore: number;
    comments: string[];
  }>;
  recommendations?: string[];
  providerName?: string;
  model?: string;
  [key: string]: unknown;
}

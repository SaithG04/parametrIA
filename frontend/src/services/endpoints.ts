import { api, unwrap } from "@/lib/api";
import type { AxiosProgressEvent } from "axios";
import type {
  AiConfigInput,
  AiProvider,
  AuthSession,
  Classroom,
  Course,
  Evaluation,
  EvaluationJob,
  InstructorCredential,
  InstructorStudent,
  LegalDocuments,
  LegalStatus,
  PageResult,
  ProviderInput,
  ReportSchemaFieldDefinition,
  ReportSchemaField,
  Role,
  SystemPromptVersion,
  University,
  UserInput,
  UserRecord,
} from "@/services/types";

export interface EvaluationSubmission {
  classroomId: string;
  studentId?: string;
  file: File;
}

export interface UserFilters {
  search?: string;
  role?: Role;
  universityId?: string;
  isActive?: boolean;
}

export interface StudentFilters {
  page: number;
  pageSize: number;
  search?: string;
  classroomId?: string;
}

export interface EvaluationFilters {
  classroomId?: string;
  courseId?: string;
  studentId?: string;
  studentName?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportSchemaFieldInput {
  key: string;
  label: string;
  type: ReportSchemaFieldDefinition["type"];
  description: string;
  options?: string[];
  children?: Array<Omit<ReportSchemaFieldDefinition, "id" | "children" | "isRequired"> & { isRequired?: boolean }>;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface SystemPromptInput {
  title: string;
  instructions: string;
}

function multipart(fields: Record<string, string>, file: File) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  data.append("file", file);
  return data;
}

const requestConfig = () => ({ headers: { "Idempotency-Key": crypto.randomUUID() } });

export const authApi = {
  login: (input: { email: string; password: string }) =>
    unwrap<AuthSession>(api.post("/auth/login", input)),
  refresh: () => unwrap<AuthSession>(api.post("/auth/refresh")),
  logout: () => unwrap<null>(api.post("/auth/logout")),
  requestPasswordReset: (email: string) => unwrap<null>(api.post("/auth/password/forgot", { email })),
  resetPassword: (input: { token: string; password: string }) =>
    unwrap<null>(api.post("/auth/password/reset", input)),
};

export const legalApi = {
  documents: () => unwrap<LegalDocuments>(api.get("/legal/documents")),
  status: () => unwrap<LegalStatus>(api.get("/legal/status")),
  accept: () => unwrap<LegalStatus>(api.post("/legal/accept")),
};

export const providersApi = {
  list: (page = 1, pageSize = 100, search = "") =>
    unwrap<PageResult<AiProvider>>(api.get("/providers", { params: { page, pageSize, ...(search ? { search } : {}) } })),
  create: (input: ProviderInput) => unwrap<AiProvider>(api.post("/providers", input, requestConfig())),
  update: (id: string, input: ProviderInput) => unwrap<AiProvider>(api.put(`/providers/${id}`, input, requestConfig())),
  remove: (id: string) => unwrap<null>(api.delete(`/providers/${id}`, requestConfig())),
  models: (id: string, credentialId: string) =>
    unwrap<string[]>(api.post(`/providers/${id}/models`, { credentialId })),
  uploadLogo: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ logoUrl: string }>(api.post("/providers/logo", data));
  },
};

export const universitiesApi = {
  list: (page = 1, pageSize = 100, search = "") =>
    unwrap<PageResult<University>>(api.get("/universities", { params: { page, pageSize, ...(search ? { search } : {}) } })),
  create: (input: Partial<University>) => unwrap<University>(api.post("/universities", input, requestConfig())),
  update: (id: string, input: Partial<University>) => unwrap<University>(api.put(`/universities/${id}`, input, requestConfig())),
  remove: (id: string) => unwrap<null>(api.delete(`/universities/${id}`, requestConfig())),
  uploadLogo: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ logoUrl: string }>(api.post("/universities/logo", data));
  },
};

export const usersApi = {
  list: (filters: UserFilters = {}, page = 1, pageSize = 100) =>
    unwrap<PageResult<UserRecord>>(api.get("/users", { params: { page, pageSize, ...filters } })),
  create: (input: UserInput) => unwrap<UserRecord>(api.post("/users", input, requestConfig())),
  update: (id: string, input: Partial<UserInput>) => unwrap<UserRecord>(api.put(`/users/${id}`, input, requestConfig())),
  setStatus: (id: string, isActive: boolean) => unwrap<UserRecord>(api.put(`/users/${id}/status`, { isActive }, requestConfig())),
  sendPasswordReset: (id: string) => unwrap<null>(api.post(`/users/${id}/password-reset`, {}, requestConfig())),
};

export const classroomsApi = {
  listMine: (_role?: Role, _userId?: string, page = 1, pageSize = 100, search = "") =>
    unwrap<PageResult<Classroom>>(api.get("/classrooms", { params: { page, pageSize, ...(search ? { search } : {}) } })),
  get: (id: string) => unwrap<Classroom>(api.get(`/classrooms/${id}`)),
  saveAiConfig: (id: string, input: AiConfigInput) => unwrap<Classroom>(api.put(`/classrooms/${id}/config`, input, requestConfig())),
  courses: (page = 1, pageSize = 100, search = "") =>
    unwrap<PageResult<Course>>(api.get("/courses", { params: { page, pageSize, ...(search ? { search } : {}) } })),
  createCourse: (input: { name: string; description?: string }) => unwrap<Course>(api.post("/courses", input, requestConfig())),
  updateCourse: (id: string, input: { name: string; description?: string }) => unwrap<Course>(api.put(`/courses/${id}`, input, requestConfig())),
  setCourseStatus: (id: string, input: { isActive: boolean; confirmationName: string; password: string }) =>
    unwrap<Course>(api.put(`/courses/${id}/status`, input, requestConfig())),
  createClassroom: (courseId: string, name: string) =>
    unwrap<Classroom>(api.post(`/courses/${courseId}/classrooms`, { name }, requestConfig())),
  updateClassroom: (id: string, input: { name: string; courseId: string }) =>
    unwrap<Classroom>(api.put(`/instructor/classrooms/${id}`, input, requestConfig())),
  setClassroomStatus: (id: string, input: { isActive: boolean; confirmationName: string; password: string }) =>
    unwrap<Classroom>(api.put(`/instructor/classrooms/${id}/status`, input, requestConfig())),
  credentials: () => unwrap<InstructorCredential[]>(api.get("/instructor/credentials")),
  saveCredential: (input: { id?: string; name: string; providerId: string; apiKey: string }) =>
    unwrap<InstructorCredential>(api.post("/instructor/credentials", input, requestConfig())),
  deleteCredential: (id: string) => unwrap<null>(api.delete(`/instructor/credentials/${id}`, requestConfig())),
};

export const instructorApi = {
  listStudents: (filters: StudentFilters) =>
    unwrap<PageResult<InstructorStudent>>(api.get("/instructor/students", { params: filters })),
  createStudent: (input: { name: string; email: string; classroomIds: string[] }) =>
    unwrap<InstructorStudent>(api.post("/instructor/students", input, requestConfig())),
  assignStudentClassrooms: (id: string, classroomIds: string[]) =>
    unwrap<InstructorStudent>(api.put(`/instructor/students/${id}/classrooms`, { classroomIds }, requestConfig())),
  importStudents: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return unwrap<{ created: number; failed: number; results: Array<{ rowNumber: number; email: string; success: boolean; message: string }> }>(
      api.post("/instructor/students/import", data, requestConfig()),
    );
  },
  downloadStudentTemplate: async () => {
    const response = await api.get("/instructor/students/template", { responseType: "blob" });
    return response.data as Blob;
  },
};

export const reportSchemaApi = {
  list: () => unwrap<ReportSchemaField[]>(api.get("/report-schema-fields")),
  active: () => unwrap<ReportSchemaFieldDefinition[]>(api.get("/report-schema-fields/active")),
  create: (input: ReportSchemaFieldInput) =>
    unwrap<ReportSchemaField>(api.post("/report-schema-fields", input, requestConfig())),
  update: (id: string, input: ReportSchemaFieldInput) =>
    unwrap<ReportSchemaField>(api.put(`/report-schema-fields/${id}`, input, requestConfig())),
  setStatus: (id: string, isActive: boolean) =>
    unwrap<ReportSchemaField>(api.put(`/report-schema-fields/${id}/status`, { isActive }, requestConfig())),
};

export const systemPromptsApi = {
  list: () => unwrap<SystemPromptVersion[]>(api.get("/system-prompts")),
  createVersion: (input: SystemPromptInput) =>
    unwrap<SystemPromptVersion>(api.post("/system-prompts", input, requestConfig())),
  activate: (id: string) =>
    unwrap<SystemPromptVersion>(api.put(`/system-prompts/${id}/activate`, {}, requestConfig())),
};

export const evaluationsApi = {
  list: (filters: EvaluationFilters = {}, page = 1, pageSize = 10) =>
    unwrap<PageResult<Evaluation>>(api.get("/evaluations", { params: { page, pageSize, ...filters } })),
  get: (id: string) => unwrap<Evaluation>(api.get(`/evaluations/${id}`)),
  preview: (classroomId: string, file: File) =>
    unwrap<{ fileName: string; characterCount: number; convertedText: string }>(
      api.post("/evaluations/preview", multipart({ classroomId }, file), { timeout: 120_000 }),
    ),
  submit: (input: EvaluationSubmission, onUploadProgress?: (progress: number) => void) =>
    unwrap<EvaluationJob>(api.post(
      "/evaluations",
      multipart({ classroomId: input.classroomId }, input.file),
      {
        ...requestConfig(),
        onUploadProgress: (event: AxiosProgressEvent) => reportUploadProgress(event, onUploadProgress),
      },
    )),
  submitByok: (
    input: EvaluationSubmission & { providerId: string; apiKey: string },
    onUploadProgress?: (progress: number) => void,
  ) =>
    unwrap<EvaluationJob>(api.post("/evaluations/byok", multipart({
      classroomId: input.classroomId,
      providerId: input.providerId,
      apiKey: input.apiKey,
    }, input.file), {
      ...requestConfig(),
      onUploadProgress: (event: AxiosProgressEvent) => reportUploadProgress(event, onUploadProgress),
    })),
  activeJob: () => unwrap<EvaluationJob | null>(api.get("/evaluations/jobs/active")),
  job: (id: string) => unwrap<EvaluationJob>(api.get(`/evaluations/jobs/${id}`)),
};

function reportUploadProgress(event: AxiosProgressEvent, onProgress?: (progress: number) => void) {
  if (!event.total || !onProgress) return;
  onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
}

export const statsApi = {
  superadmin: () =>
    unwrap<{ providerCount: number; universityCount: number; userCount: number; evaluationCount: number }>(
      api.get("/stats/superadmin"),
    ),
  instructor: () =>
    unwrap<{
      courseCount: number;
      classroomCount: number;
      configuredClassroomCount: number;
      studentCount: number;
      evaluationCount: number;
      recentEvaluationCount: number;
      activeJobCount: number;
    }>(api.get("/stats/instructor")),
  student: () =>
    unwrap<{
      classroomCount: number;
      evaluationCount: number;
      monthEvaluationCount: number;
      activeJobCount: number;
    }>(api.get("/stats/student")),
};

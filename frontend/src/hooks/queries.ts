import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastApiError } from "@/lib/api";
import {
  classroomsApi,
  instructorApi,
  providersApi,
  reportSchemaApi,
  statsApi,
  systemPromptsApi,
  universitiesApi,
  usersApi,
  type StudentFilters,
  type ReportSchemaFieldInput,
  type UserFilters,
} from "@/services/endpoints";
import type {
  AiConfigInput,
  PageResult,
  ProviderInput,
  SessionUser,
  University,
  UserInput,
} from "@/services/types";
import { queryKeys } from "./query-keys";
import { invalidate } from "./query-utils";

export { queryKeys } from "./query-keys";
export * from "./evaluation-queries";
export * from "./session-queries";

export function useProviders(page = 1, pageSize = 100, search = "", enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.providers, page, pageSize, search],
    queryFn: () => providersApi.list(page, pageSize, search),
    enabled,
  });
}

export function useSaveProvider(id?: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderInput) => id ? providersApi.update(id, input) : providersApi.create(input),
    onSuccess: () => {
      invalidate(client, [queryKeys.providers]);
      toast.success(id ? "Proveedor actualizado." : "Proveedor registrado.");
    },
    onError: toastApiError,
  });
}

export function useDeleteProvider() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: providersApi.remove,
    onSuccess: () => { invalidate(client, [queryKeys.providers]); toast.success("Proveedor eliminado."); },
    onError: toastApiError,
  });
}

export function useUploadProviderLogo() {
  return useMutation({ mutationFn: providersApi.uploadLogo, onError: toastApiError });
}

export function useUniversities(page = 1, pageSize = 100, search = "", enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.universities, page, pageSize, search],
    queryFn: () => universitiesApi.list(page, pageSize, search),
    enabled,
  });
}

export function useSaveUniversity(id?: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<University>) => id ? universitiesApi.update(id, input) : universitiesApi.create(input),
    onSuccess: () => {
      invalidate(client, [queryKeys.universities, queryKeys.users]);
      toast.success(id ? "Universidad actualizada." : "Universidad registrada.");
    },
    onError: toastApiError,
  });
}

export function useUploadUniversityLogo() {
  return useMutation({ mutationFn: universitiesApi.uploadLogo, onError: toastApiError });
}

export function useDeleteUniversity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: universitiesApi.remove,
    onSuccess: () => { invalidate(client, [queryKeys.universities, queryKeys.users]); toast.success("Universidad eliminada."); },
    onError: toastApiError,
  });
}

export function useUsers(filters: UserFilters & { page?: number; pageSize?: number } = {}, enabled = true) {
  const { page = 1, pageSize = 100, ...userFilters } = filters;
  return useQuery({
    queryKey: [...queryKeys.users, page, pageSize, userFilters],
    queryFn: () => usersApi.list(userFilters, page, pageSize),
    enabled,
  });
}

export function useSaveUser(id?: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UserInput) => id ? usersApi.update(id, input) : usersApi.create(input),
    onSuccess: () => { invalidate(client, [queryKeys.users]); toast.success(id ? "Usuario actualizado." : "Usuario creado."); },
    onError: toastApiError,
  });
}

export function useSetUserStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.setStatus(id, isActive),
    onSuccess: () => { invalidate(client, [queryKeys.users]); toast.success("Estado de usuario actualizado."); },
    onError: toastApiError,
  });
}

export function useSendPasswordReset() {
  return useMutation({
    mutationFn: usersApi.sendPasswordReset,
    onSuccess: () => toast.success("Se envió el enlace para configurar la contraseña."),
    onError: toastApiError,
  });
}

export function useClassrooms(
  session: SessionUser,
  page = 1,
  pageSize = 100,
  search = "",
  enabled = true,
) {
  return useQuery({
    queryKey: [...queryKeys.classrooms(session.role, session.id), page, pageSize, search],
    queryFn: () => classroomsApi.listMine(session.role, session.id, page, pageSize, search),
    enabled: Boolean(session?.id) && enabled,
  });
}

export function useClassroom(id: string) {
  return useQuery({ queryKey: queryKeys.classroom(id), queryFn: () => classroomsApi.get(id), enabled: Boolean(id) });
}

export function useSaveAiConfig(classroomId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AiConfigInput) => classroomsApi.saveAiConfig(classroomId, input),
    onSuccess: () => {
      invalidate(client, [queryKeys.classroom(classroomId), queryKeys.classrooms("INSTRUCTOR", "")]);
      toast.success("Configuración de IA guardada.");
    },
    onError: toastApiError,
  });
}

export function useCourses(filters: { page?: number; pageSize?: number; search?: string } = {}, enabled = true) {
  const { page = 1, pageSize = 100, search = "" } = filters;
  return useQuery({
    queryKey: [...queryKeys.courses, page, pageSize, search],
    queryFn: () => classroomsApi.courses(page, pageSize, search),
    enabled,
  });
}

export function useCreateCourse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: classroomsApi.createCourse,
    onSuccess: () => { invalidate(client, [queryKeys.courses]); toast.success("Curso creado."); },
    onError: toastApiError,
  });
}

export function useSaveCourse(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) => classroomsApi.updateCourse(id, input),
    onSuccess: () => {
      invalidate(client, [queryKeys.courses]);
      toast.success("Curso actualizado.");
    },
    onError: toastApiError,
  });
}

export function useSetCourseStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; isActive: boolean; confirmationName: string; password: string }) =>
      classroomsApi.setCourseStatus(id, input),
    onSuccess: () => {
      invalidate(client, [queryKeys.courses, ["classrooms"]]);
      toast.success("Estado del curso actualizado.");
    },
    onError: toastApiError,
  });
}

export function useCreateClassroom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, name }: { courseId: string; name: string }) => classroomsApi.createClassroom(courseId, name),
    onSuccess: () => {
      invalidate(client, [queryKeys.courses, ["classrooms"]]);
      toast.success("Aula creada.");
    },
    onError: toastApiError,
  });
}

export function useSaveClassroom(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; courseId: string }) => classroomsApi.updateClassroom(id, input),
    onSuccess: () => {
      invalidate(client, [queryKeys.courses, ["classrooms"], queryKeys.classroom(id)]);
      toast.success("Aula actualizada.");
    },
    onError: toastApiError,
  });
}

export function useSetClassroomStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; isActive: boolean; confirmationName: string; password: string }) =>
      classroomsApi.setClassroomStatus(id, input),
    onSuccess: () => {
      invalidate(client, [queryKeys.courses, ["classrooms"]]);
      toast.success("Estado del aula actualizado.");
    },
    onError: toastApiError,
  });
}

export function useInstructorCredentials(enabled = true) {
  return useQuery({ queryKey: queryKeys.credentials, queryFn: classroomsApi.credentials, enabled });
}

export function useSaveInstructorCredential() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: classroomsApi.saveCredential,
    onSuccess: () => { invalidate(client, [queryKeys.credentials]); toast.success("Credencial guardada."); },
    onError: toastApiError,
  });
}

export function useDeleteInstructorCredential() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: classroomsApi.deleteCredential,
    onSuccess: () => { invalidate(client, [queryKeys.credentials]); toast.success("Credencial eliminada."); },
    onError: toastApiError,
  });
}

export function useProviderModels(providerId: string, credentialId: string, enabled = true) {
  return useQuery({
    queryKey: ["provider-models", providerId, credentialId],
    queryFn: () => providersApi.models(providerId, credentialId),
    enabled: enabled && Boolean(providerId) && Boolean(credentialId),
    retry: false,
  });
}

export function useActiveReportSchemaFields(enabled = true) {
  return useQuery({ queryKey: queryKeys.reportFields, queryFn: reportSchemaApi.active, enabled });
}

export function useReportSchemaFields() {
  return useQuery({ queryKey: queryKeys.reportSchemaFields, queryFn: reportSchemaApi.list });
}

export function useSaveReportSchemaField(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportSchemaFieldInput) =>
      id ? reportSchemaApi.update(id, input) : reportSchemaApi.create(input),
    onSuccess: () => {
      invalidate(client, [queryKeys.reportSchemaFields, queryKeys.reportFields]);
      toast.success(id ? "Campo actualizado." : "Campo agregado.");
    },
    onError: toastApiError,
  });
}

export function useSetReportSchemaFieldStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => reportSchemaApi.setStatus(id, isActive),
    onSuccess: () => {
      invalidate(client, [queryKeys.reportSchemaFields, queryKeys.reportFields]);
      toast.success("Estado del campo actualizado.");
    },
    onError: toastApiError,
  });
}

export function useSystemPromptVersions() {
  return useQuery({
    queryKey: queryKeys.systemPrompts,
    queryFn: systemPromptsApi.list,
  });
}

export function useCreateSystemPromptVersion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: systemPromptsApi.createVersion,
    onSuccess: () => {
      invalidate(client, [queryKeys.systemPrompts]);
      toast.success("Nueva versión guardada y activada.");
    },
    onError: toastApiError,
  });
}

export function useActivateSystemPromptVersion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: systemPromptsApi.activate,
    onSuccess: () => {
      invalidate(client, [queryKeys.systemPrompts]);
      toast.success("Versión anterior reactivada.");
    },
    onError: toastApiError,
  });
}

export function useInstructorStudents(filters: StudentFilters, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.students, filters],
    queryFn: () => instructorApi.listStudents(filters),
    enabled,
  });
}

export function useCreateInstructorStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: instructorApi.createStudent,
    onSuccess: () => { invalidate(client, [queryKeys.students]); toast.success("Estudiante creado y matriculado."); },
    onError: toastApiError,
  });
}

export function useAssignStudentClassrooms() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, classroomIds }: { id: string; classroomIds: string[] }) => instructorApi.assignStudentClassrooms(id, classroomIds),
    onSuccess: () => { invalidate(client, [queryKeys.students]); toast.success("Aulas del estudiante actualizadas."); },
    onError: toastApiError,
  });
}

export function useImportInstructorStudents() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: instructorApi.importStudents,
    onSuccess: () => invalidate(client, [queryKeys.students]),
    onError: toastApiError,
  });
}

export function useSuperadminStats() {
  return useQuery({ queryKey: queryKeys.stats, queryFn: statsApi.superadmin });
}

export function useInstructorStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.instructorStats,
    queryFn: statsApi.instructor,
    enabled,
  });
}

export function useStudentStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.studentStats,
    queryFn: statsApi.student,
    enabled,
  });
}

export type { PageResult };

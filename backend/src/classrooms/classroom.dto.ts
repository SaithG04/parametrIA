export const classroomInclude = {
  config: { include: { credential: true } },
  students: { select: { id: true } },
  course: { select: { id: true, name: true, isActive: true } },
} as const;

export function classroomToDto(classroom: {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  universityId: string | null;
  instructorId: string;
  course: { id: string; name: string; isActive: boolean } | null;
  students: Array<{ id: string }>;
  config: {
    providerId: string;
    credentialId: string | null;
    credential: { name: string } | null;
    selectedModels: string[];
    selectedReportFields: string[];
    userPrompt: string;
    rubricText: string;
    dailyLimit: number;
  } | null;
}) {
  return {
    id: classroom.id,
    name: classroom.name,
    code: classroom.code,
    isActive: classroom.isActive,
    courseId: classroom.course?.id ?? "",
    courseName: classroom.course?.name ?? "",
    courseIsActive: classroom.course?.isActive ?? false,
    universityId: classroom.universityId ?? "",
    instructorId: classroom.instructorId,
    studentIds: classroom.students.map((student) => student.id),
    config: classroom.config ? {
      providerId: classroom.config.providerId,
      credentialId: classroom.config.credentialId ?? "",
      credentialName: classroom.config.credential?.name ?? "",
      selectedModels: classroom.config.selectedModels,
      selectedReportFields: classroom.config.selectedReportFields,
      userPrompt: classroom.config.userPrompt,
      rubricText: classroom.config.rubricText,
      dailyLimit: classroom.config.dailyLimit,
    } : {
      providerId: "",
      credentialId: "",
      credentialName: "",
      selectedModels: [],
      selectedReportFields: [],
      userPrompt: "",
      rubricText: "",
      dailyLimit: 2,
    },
  };
}

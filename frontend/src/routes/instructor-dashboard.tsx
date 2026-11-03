import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, BookOpen, Building2, CheckCircle2, Clock3, FileCheck2, FileText, KeyRound, Mail, Pencil, Plus, Search, Settings2, Trash2, Users, UserRoundX, UserRoundCheck, GraduationCap, ShieldCheck, Upload, Download } from "lucide-react";
import { useActiveEvaluationJob, useAssignStudentClassrooms, useClassroom, useClassrooms, useCreateClassroom, useCreateCourse, useCreateInstructorStudent, useCourses, useDeleteInstructorCredential, useDeleteProvider, useDeleteUniversity, useEvaluationJob, useImportInstructorStudents, useInstructorCredentials, useInstructorStudents, usePreviewEvaluation, useProviders, useSaveInstructorCredential, useSaveProvider, useSendPasswordReset, useSetUserStatus, useSubmitByok, useSubmitEvaluation, useSuperadminStats, useUniversities, useUploadProviderLogo, useUsers, isDailyLimitError } from "@/hooks/queries";
import { useSession, logoutSession } from "@/hooks/use-session";
import { DropZone } from "@/components/dropzone";
import { ByokModal } from "@/components/byok-modal";
import { ProviderLogo } from "@/components/provider-logo";
import { PaginationControls } from "@/components/pagination-controls";
import { ClassroomMultiSelect } from "@/components/classroom-multi-select";
import { BrandLoader } from "@/components/brand-loader";
import { UserDialog, UniversityDialog } from "@/components/admin-record-dialogs";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AiProvider, ProviderProtocol, University, UserRecord } from "@/services/types";
import { instructorApi } from "@/services/endpoints";
import type { EvaluationSubmission } from "@/services/endpoints";
import { ApiError, getUserFacingError } from "@/lib/api";
import { ReportSchemaManager } from "@/routes/report-schema-manager";
import { ClassroomManagementActions, CourseManagementCard } from "@/routes/instructor-academic-actions";
import { RefreshButton } from "@/routes/dashboard-shared";
import { FormSelect } from "@/components/ui/form-select";
import { DashboardBanner, DashboardSkeleton, EmptyState, PageHeading, SkeletonTableRows, StatCard, roleLabel } from "@/routes/dashboard-shared";

export function InstructorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const { confirm } = useConfirmation();
  const tab = location.pathname.endsWith("/credentials")
    ? "credentials"
    : location.pathname.endsWith("/students")
      ? "students"
      : location.pathname.endsWith("/classrooms")
        ? "classrooms"
      : "courses";
  const setTab = (next: "courses" | "classrooms" | "credentials" | "students") => {
    navigate(`/app/instructor/${next}`);
  };
  const [classroomsPage, setClassroomsPage] = useState(1);
  const [classroomsPageSize, setClassroomsPageSize] = useState(100);
  const [classroomSearch, setClassroomSearch] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("");
  const [classroomsSearched, setClassroomsSearched] = useState(false);
  const [studentsSearched, setStudentsSearched] = useState(false);
  const { data: classroomsResult, isLoading, isFetching: classroomsFetching, isError: classroomsError, refetch: refetchClassrooms } = useClassrooms(
    user!,
    classroomsPage,
    classroomsPageSize,
    classroomFilter,
    classroomsSearched || (tab === "students" && studentsSearched),
  );
  const classrooms = classroomsResult?.items ?? [];
  const [selectedId, setSelectedId] = useState("");
  const classroomId = selectedId || "";
  const { data: classroom } = useClassroom(classroomId);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [coursesSearched, setCoursesSearched] = useState(false);
  const { data: coursesResult, isLoading: coursesLoading, isFetching: coursesFetching, isError: coursesError, refetch: refetchCourses } = useCourses(
    { page: 1, pageSize: 100, search: courseFilter },
    coursesSearched || tab === "classrooms" || (tab === "students" && studentsSearched),
  );
  const courses = coursesResult?.items ?? [];
  const createCourse = useCreateCourse();
  const createClassroom = useCreateClassroom();
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newClassroomName, setNewClassroomName] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [classroomDialogOpen, setClassroomDialogOpen] = useState(false);
  const { data: providerResult, isError: providersError, refetch: refetchInstructorProviders } = useProviders(1, 100, "", tab === "credentials" || (tab === "courses" && Boolean(classroomId)));
  const providers = providerResult?.items ?? [];
  const credentialsQuery = useInstructorCredentials(tab === "credentials" || tab === "courses");
  const credentials = credentialsQuery.data ?? [];
  const saveCredential = useSaveInstructorCredential();
  const deleteCredential = useDeleteInstructorCredential();
  const [credentialName, setCredentialName] = useState("");
  const [credentialProviderId, setCredentialProviderId] = useState("");
  const [credentialApiKey, setCredentialApiKey] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [studentClassroomFilter, setStudentClassroomFilter] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(10);
  const { data: studentResult, isLoading: studentsLoading, isError: studentsError, refetch: refetchStudents } = useInstructorStudents(
    {
      page: studentPage,
      pageSize: studentPageSize,
      search: studentFilter,
      ...(studentClassroomFilter ? { classroomId: studentClassroomFilter } : {}),
    },
    tab === "students" && studentsSearched,
  );
  const students = studentResult?.items ?? [];
  const createStudent = useCreateInstructorStudent();
  const assignStudent = useAssignStudentClassrooms();
  const importStudents = useImportInstructorStudents();
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentClassroomIds, setStudentClassroomIds] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof instructorApi.importStudents>> | null>(null);

  useEffect(() => {
    if (!selectedCourseId && courses[0]) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  function showClassroomStudents(id: string) {
    setStudentClassroomFilter(id);
    setStudentFilter("");
    setStudentSearch("");
    setStudentPage(1);
    setStudentsSearched(true);
    setTab("students");
  }

  return <div className="page-enter">
    <PageHeading eyebrow="Espacio docente" title={tab === "courses" ? "Cursos" : tab === "classrooms" ? "Aulas y secciones" : tab === "credentials" ? "Credenciales IA" : "Estudiantes"} description={tab === "courses" ? "Organiza tus cursos antes de crear aulas o secciones." : tab === "classrooms" ? "Administra tus aulas, matrículas y configuración de evaluación." : tab === "credentials" ? "Gestiona de forma segura las credenciales de los proveedores de IA." : "Matricula estudiantes y administra su acceso a las aulas."} />
    <DashboardBanner icon={BookOpen} title={`Espacio docente · ${user?.name ?? ""}`} description="Accede por separado a tus cursos, aulas, credenciales y estudiantes." />

    {tab === "courses" && <section className="surface min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Cursos</h2><p className="text-sm text-slate-500">Organiza aquí las aulas y secciones.</p></div>
          <div className="flex flex-wrap gap-2"><RefreshButton onClick={() => { setCoursesSearched(true); void refetchCourses(); }} busy={coursesFetching} label="cursos" /><button type="button" className="action" onClick={() => setCourseDialogOpen(true)}><Plus className="size-4" />Nuevo curso</button></div>
        </div>
        <form className="mb-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); setCourseFilter(courseSearch.trim()); setCoursesSearched(true); }}>
          <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Buscar curso" aria-label="Buscar cursos" />
          <button className="action" aria-label="Buscar cursos"><Search className="size-4" /></button>
        </form>
        {!coursesSearched ? <EmptyState icon={Search} title="Busca tus cursos" description="Escribe un nombre y pulsa Buscar para consultar tus cursos." /> : coursesLoading ? <DashboardSkeleton /> : coursesError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">No se pudieron cargar los cursos. <button type="button" className="font-semibold underline" onClick={() => void refetchCourses()}>Reintentar</button></div> : courses.length ? <div className="grid gap-3">{courses.map((course) => <CourseManagementCard key={course.id} course={course} />)}</div> : <EmptyState icon={BookOpen} title={courseFilter ? "No hay cursos con ese nombre" : "Aún no tienes cursos"} description={courseFilter ? "Prueba con otros términos o limpia la búsqueda." : "Crea tu primer curso para organizar las aulas y secciones."} action={{ label: courseFilter ? "Limpiar búsqueda" : "Crear curso", onClick: () => { if (courseFilter) { setCourseSearch(""); setCourseFilter(""); setCoursesSearched(false); } else setCourseDialogOpen(true); } }} />}
    </section>}

    {tab === "classrooms" && <section className="surface min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Aulas y secciones</h2><p className="text-sm text-slate-500">Administra matrículas y configura la evaluación.</p></div>
          <div className="flex flex-wrap gap-2"><RefreshButton onClick={() => { setClassroomsSearched(true); void refetchClassrooms(); }} busy={classroomsFetching} label="aulas" /><button type="button" className="action" onClick={() => setClassroomDialogOpen(true)} disabled={!courses.length}><Plus className="size-4" />Nueva aula</button></div>
        </div>
        <form className="mb-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); setSelectedId(""); setClassroomsPage(1); setClassroomFilter(classroomSearch.trim()); setClassroomsSearched(true); }}>
          <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" value={classroomSearch} onChange={(event) => setClassroomSearch(event.target.value)} placeholder="Buscar aula, curso o código" aria-label="Buscar aulas" />
          <button className="action" aria-label="Buscar aulas"><Search className="size-4" /></button>
        </form>
        {!classroomsSearched ? <EmptyState icon={Search} title="Busca tus aulas" description="Escribe el nombre del aula, curso o código y pulsa Buscar para ver resultados." /> : isLoading ? <DashboardSkeleton /> : classroomsError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">No se pudieron cargar las aulas. <button type="button" className="font-semibold underline" onClick={() => void refetchClassrooms()}>Reintentar</button></div> : classrooms.length ? <div className="grid gap-3">{classrooms.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.isActive ? "border-slate-200" : "border-amber-200 bg-amber-50/40"}`}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <button type="button" className="min-w-0 text-left" onClick={() => setSelectedId(item.id)}>
              <span className="block font-semibold text-slate-900">{item.name}</span>
              <span className="mt-1 block text-sm text-slate-500">{item.courseName} · Código {item.code}</span>
            </button>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{item.isActive ? "Activo" : "Desactivado"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="action secondary px-3 py-2" onClick={() => showClassroomStudents(item.id)}><Users className="size-4" />Ver estudiantes</button>
            <button type="button" className="action px-3 py-2" onClick={() => navigate(`/app/instructor/classrooms/${item.id}/ai-config`)}><Settings2 className="size-4" />Configurar IA</button>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3"><ClassroomManagementActions classroom={item} courses={courses} compact /></div>
        </article>)}</div> : <EmptyState icon={BookOpen} title={classroomFilter ? "No hay aulas con esa búsqueda" : "Aún no tienes aulas"} description={classroomFilter ? "Revisa el nombre, curso o código del aula." : "Crea un aula desde un curso para comenzar a matricular estudiantes."} action={{ label: classroomFilter ? "Limpiar búsqueda" : "Crear aula", onClick: () => { if (classroomFilter) { setClassroomFilter(""); setClassroomSearch(""); } else setClassroomDialogOpen(true); } }} />}
        <PaginationControls result={classroomsResult} onPageChange={setClassroomsPage} onPageSizeChange={(size) => { setClassroomsPageSize(size); setClassroomsPage(1); }} />
      </section>
    }

      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear curso</DialogTitle><DialogDescription>Un curso puede organizar varias aulas o secciones.</DialogDescription></DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault();
            createCourse.mutate({ name: newCourseName.trim(), description: newCourseDescription.trim() }, {
              onSuccess: (course) => { setNewCourseName(""); setNewCourseDescription(""); setSelectedCourseId(course.id); setCourseFilter(""); setCourseDialogOpen(false); },
            });
          }}>
            <label className="field">Nombre<input required value={newCourseName} onChange={(event) => setNewCourseName(event.target.value)} placeholder="Metodología de investigación" /></label>
            <label className="field">Descripción<input value={newCourseDescription} onChange={(event) => setNewCourseDescription(event.target.value)} placeholder="Opcional" /></label>
            <div className="flex justify-end gap-2"><button type="button" className="action secondary" onClick={() => setCourseDialogOpen(false)}>Cancelar</button><button className="action" disabled={createCourse.isPending}>{createCourse.isPending ? "Creando…" : "Crear curso"}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={classroomDialogOpen} onOpenChange={setClassroomDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear aula o sección</DialogTitle><DialogDescription>Cada aula tendrá un código único para matrícula.</DialogDescription></DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault();
            if (!selectedCourseId) return;
            createClassroom.mutate({ courseId: selectedCourseId, name: newClassroomName.trim() }, {
              onSuccess: () => { setNewClassroomName(""); setClassroomDialogOpen(false); setClassroomsSearched(true); },
            });
          }}>
            <label className="field">Curso<FormSelect required value={selectedCourseId || "__select_course__"} onValueChange={(value) => setSelectedCourseId(value === "__select_course__" ? "" : value)} options={[{ value: "__select_course__", label: "Selecciona un curso" }, ...courses.map((course) => ({ value: course.id, label: course.name }))]} /></label>
            <label className="field">Nombre del aula<input required value={newClassroomName} onChange={(event) => setNewClassroomName(event.target.value)} placeholder="Grupo A — 2026" /></label>
            <div className="flex justify-end gap-2"><button type="button" className="action secondary" onClick={() => setClassroomDialogOpen(false)}>Cancelar</button><button className="action" disabled={createClassroom.isPending || !selectedCourseId}>{createClassroom.isPending ? "Creando…" : "Crear aula"}</button></div>
          </form>
        </DialogContent>
      </Dialog>

    {tab === "credentials" && <section className="surface grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:p-6">
      <form className="grid content-start gap-4" onSubmit={(event) => {
        event.preventDefault();
        saveCredential.mutate({ name: credentialName.trim(), providerId: credentialProviderId, apiKey: credentialApiKey }, {
          onSuccess: () => { setCredentialName(""); setCredentialApiKey(""); },
        });
      }}>
        <div><h2 className="text-lg font-bold">Guardar credencial</h2><p className="text-sm text-slate-500">La clave se cifra y solo queda visible para tu cuenta docente.</p></div>
        {providersError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">No se pudieron cargar los proveedores. <button type="button" className="font-semibold underline" onClick={() => void refetchInstructorProviders()}>Reintentar</button></p>}
        <label className="field">Proveedor<FormSelect required value={credentialProviderId || "__select_provider__"} onValueChange={(value) => setCredentialProviderId(value === "__select_provider__" ? "" : value)} options={[{ value: "__select_provider__", label: "Selecciona proveedor" }, ...providers.map((provider) => ({ value: provider.id, label: provider.name }))]} /></label>
        <label className="field">Nombre de referencia<input required value={credentialName} onChange={(event) => setCredentialName(event.target.value)} placeholder="Cuenta institucional" /></label>
        <label className="field">API Key<input required type="password" autoComplete="new-password" value={credentialApiKey} onChange={(event) => setCredentialApiKey(event.target.value)} /></label>
        <button className="action w-fit" disabled={saveCredential.isPending || !credentialProviderId}><ShieldCheck className="size-4" />Guardar cifrada</button>
      </form>
      <div><h2 className="mb-3 text-lg font-bold">Credenciales guardadas</h2>{credentialsQuery.isLoading ? <DashboardSkeleton /> : credentialsQuery.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">No se pudieron cargar las credenciales. <button type="button" className="font-semibold underline" onClick={() => void credentialsQuery.refetch()}>Reintentar</button></p> : credentials.length ? <div className="grid gap-3">{credentials.map((credential) => <article key={credential.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4"><ProviderLogo provider={credential.provider} className="size-10" /><div className="min-w-0 flex-1"><h3 className="font-semibold">{credential.name}</h3><p className="text-sm text-slate-500">{credential.provider.name} · clave cifrada</p></div><button className="action danger px-3" aria-label={`Eliminar credencial ${credential.name}`} onClick={() => void confirm({ title: `¿Eliminar la credencial ${credential.name}?`, description: "Las aulas que la utilizan deberán seleccionar otra credencial antes de evaluar.", confirmLabel: "Eliminar credencial", destructive: true }).then((accepted) => { if (accepted) deleteCredential.mutate(credential.id); })}><Trash2 className="size-4" /></button></article>)}</div> : <EmptyState icon={KeyRound} title="Aún no guardaste credenciales" description="Guarda una credencial cifrada para conectarla con las aulas que administras." />}</div>
    </section>}

    {tab === "students" && <div className="grid gap-5">
      <section className="surface grid gap-6 p-5 lg:grid-cols-2 sm:p-6">
        <form className="grid content-start gap-3" onSubmit={(event) => {
          event.preventDefault();
          createStudent.mutate({ name: studentName.trim(), email: studentEmail.trim(), classroomIds: studentClassroomIds }, {
            onSuccess: () => { setStudentName(""); setStudentEmail(""); setStudentClassroomIds([]); },
          });
        }}>
          <div><h2 className="text-lg font-bold">Crear estudiante</h2><p className="text-sm text-slate-500">Recibirá por correo un enlace para definir su contraseña.</p></div>
          <label className="field">Nombre<input required value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
          <label className="field">Correo<input required type="email" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} /></label>
          <ClassroomMultiSelect
            classrooms={classrooms}
            selectedIds={studentClassroomIds}
            onChange={setStudentClassroomIds}
            legend="Asignar a una o más aulas"
          />
          {!classrooms.length && <p className="text-sm text-amber-700">Crea primero un curso y un aula.</p>}
          <button className="action w-fit" disabled={createStudent.isPending || !studentClassroomIds.length}><Plus className="size-4" />Crear y matricular</button>
        </form>
        <div className="grid content-start gap-3">
          <div><h2 className="text-lg font-bold">Importar desde Excel</h2><p className="text-sm text-slate-500">Usa la plantilla con columnas nombre, correo y aulas (códigos separados por coma).</p></div>
          <button type="button" className="action secondary w-fit" onClick={async () => {
            try {
              const blob = await instructorApi.downloadStudentTemplate();
              const href = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = href;
              anchor.download = "parametria-estudiantes.xlsx";
              anchor.click();
              URL.revokeObjectURL(href);
            } catch (error) {
              toast.error(getUserFacingError(error, "No se pudo descargar la plantilla."));
            }
          }}><Download className="size-4" />Descargar guía y plantilla</button>
          <label className="field">Archivo .xlsx<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setImportResult(null);
            importStudents.mutate(file, { onSuccess: (result) => { setImportResult(result); setStudentsSearched(true); } });
          }} /><span className="text-xs font-normal text-slate-500">Hasta 500 filas. El correo se envía de forma individual a cada estudiante creado.</span></label>
          {importStudents.isPending && <p className="text-sm text-slate-500">Validando filas y creando cuentas…</p>}
          {importResult && <div className="rounded-xl border border-slate-200 p-3 text-sm"><p>Importados: {importResult.created} · Con errores: {importResult.failed}</p>{importResult.results.filter((row) => !row.success).map((row) => <p key={row.rowNumber} className="mt-1 text-rose-700">Fila {row.rowNumber} ({row.email}): {row.message}</p>)}</div>}
        </div>
      </section>
      <section className="surface p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Estudiantes matriculados</h2>{studentsSearched && <RefreshButton onClick={() => void refetchStudents()} busy={studentsLoading} label="estudiantes" />}</div>
        <form className="my-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto]" onSubmit={(event) => {         event.preventDefault(); setStudentPage(1); setStudentFilter(studentSearch.trim()); setClassroomsSearched(true); setCoursesSearched(true); setStudentsSearched(true); }}>
          <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Nombre o correo" aria-label="Buscar estudiantes" />
          <FormSelect aria-label="Filtrar por aula" value={studentClassroomFilter || "__all_classrooms__"} onValueChange={(value) => setStudentClassroomFilter(value === "__all_classrooms__" ? "" : value)} options={[{ value: "__all_classrooms__", label: "Todas tus aulas" }, ...classrooms.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }))]} />
          <button className="action"><Search className="size-4" />Buscar</button>
        </form>
        {studentsSearched ? studentsLoading ? <DashboardSkeleton /> : studentsError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">No se pudieron cargar los estudiantes. <button type="button" className="font-semibold underline" onClick={() => void refetchStudents()}>Reintentar</button></p> : students.length ? <div className="table-wrap"><table className="min-w-2xl"><thead><tr><th>Estudiante</th><th>Aulas</th><th>Reasignar aulas</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><span className="block font-medium">{student.name}</span><span className="text-xs text-slate-500">{student.email}</span></td><td>{student.classrooms?.map((item) => `${item.name} (${item.code})`).join(", ")}</td><td><StudentClassroomAssignment student={student} classrooms={classrooms} onSave={(classroomIds) => assignStudent.mutate({ id: student.id, classroomIds })} /></td></tr>)}</tbody></table></div> : <EmptyState icon={GraduationCap} title={studentFilter || studentClassroomFilter ? "No encontramos estudiantes" : "Aún no hay estudiantes matriculados"} description={studentFilter || studentClassroomFilter ? "Prueba con otros términos o selecciona otra aula." : "Crea o importa estudiantes y asígnalos a tus aulas para comenzar."} /> : <EmptyState icon={GraduationCap} title="Gestiona tus estudiantes" description="Crea cuentas, importa una lista y organiza las matrículas por aula." />}
        <PaginationControls result={studentResult} onPageChange={setStudentPage} onPageSizeChange={(size) => { setStudentPageSize(size); setStudentPage(1); }} />
      </section>
    </div>}
  </div>;
}

function StudentClassroomAssignment({
  student,
  classrooms,
  onSave,
}: {
  student: UserRecord;
  classrooms: Array<{ id: string; name: string; code: string }>;
  onSave: (classroomIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState(student.classrooms?.map((classroom) => classroom.id) ?? []);
  return <details className="min-w-48">
    <summary className="brand-text cursor-pointer text-sm font-semibold">Editar aulas</summary>
    <div className="mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <ClassroomMultiSelect classrooms={classrooms} selectedIds={selectedIds} onChange={setSelectedIds} legend="Aulas asignadas" />
      <button type="button" className="action mt-3 w-full px-3 py-2 text-xs" onClick={() => onSave(selectedIds)}>Guardar cambios</button>
    </div>
  </details>;
}

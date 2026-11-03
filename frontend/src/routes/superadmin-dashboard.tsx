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
import { BrandLoader } from "@/components/brand-loader";
import { UserDialog, UniversityDialog } from "@/components/admin-record-dialogs";
import { LogoSourcePicker } from "@/components/logo-source-picker";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AiProvider, ProviderProtocol, University, UserRecord } from "@/services/types";
import { instructorApi } from "@/services/endpoints";
import type { EvaluationSubmission } from "@/services/endpoints";
import { ApiError, getUserFacingError } from "@/lib/api";
import { ReportSchemaManager } from "@/routes/report-schema-manager";
import { SystemPromptManager } from "@/routes/system-prompt-manager";
import { ClassroomManagementActions, CourseManagementCard } from "@/routes/instructor-academic-actions";
import { EmptyState, RefreshButton } from "@/routes/dashboard-shared";
import { FormSelect } from "@/components/ui/form-select";
import { DashboardBanner, DashboardSkeleton, PageHeading, SkeletonTableRows, StatCard, roleLabel } from "@/routes/dashboard-shared";

function ProviderForm({ provider, onCancel }: { provider: AiProvider | undefined; onCancel: () => void }) {
  const save = useSaveProvider(provider?.id);
  const uploadLogo = useUploadProviderLogo();
  const [name, setName] = useState(provider?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(provider?.logoUrl?.startsWith("/") ? "" : provider?.logoUrl ?? "");
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState(provider?.logoUrl?.startsWith("/") ? provider.logoUrl : "");
  const [logoSource, setLogoSource] = useState<"url" | "upload">(provider?.logoUrl?.startsWith("/") ? "upload" : "url");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "https://api.openai.com/v1");
  const [protocol, setProtocol] = useState<ProviderProtocol>(provider?.protocol ?? "OPENAI_COMPATIBLE");
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    const storedLogo = provider?.logoUrl ?? "";
    const isUploadedLogo = storedLogo.startsWith("/");
    setLogoUrl(isUploadedLogo ? "" : storedLogo);
    setUploadedLogoUrl(isUploadedLogo ? storedLogo : "");
    setLogoSource(isUploadedLogo ? "upload" : "url");
  }, [provider]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    try {
      const result = await uploadLogo.mutateAsync(file);
      setUploadedLogoUrl(result.logoUrl);
      setLogoSource("upload");
    } catch (error) {
      setUploadError(getUserFacingError(error, "No se pudo subir el logo."));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const selectedLogo = logoSource === "upload" ? uploadedLogoUrl : logoUrl.trim();
    if (logoSource === "upload" && !uploadedLogoUrl) {
      setUploadError("Sube una imagen antes de seleccionarla.");
      return;
    }
    save.mutate({ name: name.trim(), logoUrl: selectedLogo, baseUrl: baseUrl.trim(), protocol }, { onSuccess: onCancel });
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{provider ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        <DialogDescription>Registra el protocolo y la dirección del servicio. Los modelos se consultan con la credencial del docente.</DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        <label className="field">Nombre del proveedor<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="OpenAI, Grok, DeepSeek…" /></label>
        <label className="field">Base URL / Endpoint<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" /></label>
        <label className="field">Tipo de protocolo<FormSelect required value={protocol} onValueChange={(value) => {
          if (value === "OPENAI_COMPATIBLE" || value === "ANTHROPIC" || value === "GEMINI") setProtocol(value);
        }} options={[
          { value: "OPENAI_COMPATIBLE", label: "OpenAI compatible" },
          { value: "ANTHROPIC", label: "Anthropic" },
          { value: "GEMINI", label: "Gemini" },
        ]} /></label>
        <LogoSourcePicker
          idPrefix="provider-logo"
          url={logoUrl}
          uploadedUrl={uploadedLogoUrl}
          source={logoSource}
          onUrlChange={setLogoUrl}
          onSourceChange={setLogoSource}
          onUpload={(file) => void upload(file)}
          isUploading={uploadLogo.isPending}
          uploadError={uploadError}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="action secondary" onClick={onCancel}>Cancelar</button>
          <button className="action" disabled={save.isPending || uploadLogo.isPending}>{save.isPending ? "Guardando…" : provider ? "Guardar cambios" : "Agregar proveedor"}</button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function SuperadminDashboard() {
  const { data: stats, isError: statsError, refetch: refetchStats } = useSuperadminStats();
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [tab, setTab] = useState<"providers" | "universities" | "users" | "report-fields" | "system-prompt">("providers");
  const [providersPage, setProvidersPage] = useState(1);
  const [universitiesPage, setUniversitiesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [providersPageSize, setProvidersPageSize] = useState(10);
  const [universitiesPageSize, setUniversitiesPageSize] = useState(10);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [providersSearch, setProvidersSearch] = useState("");
  const [providersFilter, setProvidersFilter] = useState("");
  const [providersSearched, setProvidersSearched] = useState(false);
  const [universitiesSearch, setUniversitiesSearch] = useState("");
  const [universitiesFilter, setUniversitiesFilter] = useState("");
  const [universitiesSearched, setUniversitiesSearched] = useState(false);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRole, setUsersRole] = useState("");
  const [usersUniversityId, setUsersUniversityId] = useState("");
  const [usersActive, setUsersActive] = useState("");
  const [usersFilter, setUsersFilter] = useState<{ search?: string; role?: "SUPERADMIN" | "INSTRUCTOR" | "STUDENT"; universityId?: string; isActive?: boolean }>({});
  const [usersSearched, setUsersSearched] = useState(false);
  const { data: providerResult, isLoading: providersLoading, isFetching: providersFetching, isError: providersError, refetch: refetchProviders } = useProviders(providersPage, providersPageSize, providersFilter, providersSearched);
  const { data: universityResult, isLoading: universitiesLoading, isFetching: universitiesFetching, isError: universitiesError, refetch: refetchUniversities } = useUniversities(universitiesPage, universitiesPageSize, universitiesFilter, universitiesSearched);
  const { data: universityOptionsResult } = useUniversities(1, 100, "", tab === "users" || userDialogOpen);
  const { data: userResult, isLoading: usersLoading, isFetching: usersFetching, isError: usersError, refetch: refetchUsers } = useUsers({ ...usersFilter, page: usersPage, pageSize: usersPageSize }, usersSearched);
  const providers = providerResult?.items ?? [];
  const universities = universityResult?.items ?? [];
  const users = userResult?.items ?? [];
  const deleteProvider = useDeleteProvider();
  const deleteUniversity = useDeleteUniversity();
  const setUserStatus = useSetUserStatus();
  const sendPasswordReset = useSendPasswordReset();
  const { confirm } = useConfirmation();
  const [editing, setEditing] = useState<AiProvider | undefined>();
  const [addingProvider, setAddingProvider] = useState(false);
  const [universityDialogOpen, setUniversityDialogOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<University | undefined>();
  const [editingUser, setEditingUser] = useState<UserRecord | undefined>();

  async function confirmDelete(label: string, remove: () => void) {
    const accepted = await confirm({
      title: `¿Eliminar ${label}?`,
      description: "Esta acción no se puede deshacer. Los datos asociados podrían dejar de estar disponibles.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (accepted) remove();
  }

  async function toggleUserStatus(user: UserRecord) {
    const accepted = await confirm({
      title: user.isActive ? `¿Desactivar a ${user.name}?` : `¿Reactivar a ${user.name}?`,
      description: user.isActive
        ? "Se revocarán sus sesiones activas. Sus datos y aulas se conservarán."
        : "Podrá volver a iniciar sesión con su cuenta existente.",
      confirmLabel: user.isActive ? "Desactivar cuenta" : "Reactivar cuenta",
      destructive: user.isActive,
    });
    if (accepted) setUserStatus.mutate({ id: user.id, isActive: !user.isActive });
  }

  return <div className="page-enter">
    <PageHeading eyebrow="Panel administrativo" title={tab === "providers" ? "Proveedores de IA" : tab === "universities" ? "Universidades" : tab === "users" ? "Usuarios" : tab === "report-fields" ? "Campos del reporte" : "Instrucciones del sistema"} description="Administra por separado los recursos institucionales y los criterios globales de evaluación." />
    <DashboardBanner icon={ShieldCheck} title="Administración de ParametrIA" description="Configura proveedores, instituciones, cuentas, campos de reportes e instrucciones globales desde secciones independientes." />
    <section className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Proveedores" value={stats?.providerCount ?? providerResult?.pagination.total ?? 0} icon={KeyRound} />
      <StatCard label="Universidades" value={stats?.universityCount ?? universityResult?.pagination.total ?? 0} icon={Building2} />
      <StatCard label="Usuarios" value={stats?.userCount ?? userResult?.pagination.total ?? 0} icon={Users} />
      <StatCard label="Evaluaciones" value={stats?.evaluationCount ?? 0} icon={FileCheck2} />
    </section>
    {statsError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">No se pudieron actualizar las métricas. <button type="button" className="font-semibold underline" onClick={() => void refetchStats()}>Reintentar</button></p>}
    <div className="mb-5 flex flex-wrap gap-2">
      <button className={`action ${tab === "providers" ? "" : "secondary"}`} onClick={() => setTab("providers")}>Proveedores de IA</button>
      <button className={`action ${tab === "universities" ? "" : "secondary"}`} onClick={() => setTab("universities")}>Universidades</button>
      <button className={`action ${tab === "users" ? "" : "secondary"}`} onClick={() => setTab("users")}>Usuarios</button>
      <button className={`action ${tab === "report-fields" ? "" : "secondary"}`} onClick={() => setTab("report-fields")}>Campos del reporte</button>
      <button className={`action ${tab === "system-prompt" ? "" : "secondary"}`} onClick={() => setTab("system-prompt")}>Instrucciones del sistema</button>
    </div>
    {tab === "providers" ? <section className="surface p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Proveedores disponibles</h2><p className="mt-1 text-sm text-slate-500">Los modelos disponibles se consultan al configurar cada aula.</p></div><div className="flex flex-wrap gap-2"><RefreshButton onClick={() => { setProvidersSearched(true); void refetchProviders(); }} busy={providersFetching} label="proveedores" /><button className="action" onClick={() => { setEditing(undefined); setAddingProvider(true); }}><Plus className="size-4" />Nuevo proveedor</button></div></div>
      <form className="mb-5 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setProvidersPage(1); setProvidersFilter(providersSearch.trim()); setProvidersSearched(true); }}>
        <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" value={providersSearch} onChange={(event) => setProvidersSearch(event.target.value)} placeholder="Buscar proveedor" aria-label="Buscar proveedor" />
        <button className="action" type="submit"><Search className="size-4" />Buscar</button>
      </form>
      {(addingProvider || editing) && <ProviderForm key={editing?.id ?? "new"} provider={editing} onCancel={() => { setEditing(undefined); setAddingProvider(false); }} />}
      {providersSearched && (providersLoading ? <DashboardSkeleton rows={2} /> : providersError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>No se pudieron cargar los proveedores.</p><button type="button" className="mt-2 font-semibold underline" onClick={() => void refetchProviders()}>Reintentar</button></div> : <div className="grid gap-3 md:grid-cols-2">{providers.map((provider) => <article key={provider.id} className="provider-card flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4 sm:flex-nowrap"><ProviderLogo provider={provider} className="size-12" /><div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-900">{provider.name}</h3><p className="mt-1 break-all text-sm text-slate-500">{provider.baseUrl} · {provider.protocol}</p></div><button className="action secondary" onClick={() => { setAddingProvider(false); setEditing(provider); }}>Editar</button><button className="action danger px-3" aria-label={`Eliminar ${provider.name}`} onClick={() => void confirmDelete(`el proveedor ${provider.name}`, () => deleteProvider.mutate(provider.id))}><Trash2 className="size-4" /></button></article>)}</div>)}
      {providersSearched && !providersLoading && !providersError && providers.length === 0 && <EmptyState icon={KeyRound} title={providersFilter ? "No encontramos ese proveedor" : "Aún no hay proveedores"} description={providersFilter ? "Prueba con otro nombre o limpia la búsqueda para revisar todos los proveedores." : "Registra un proveedor para que los docentes puedan configurar sus aulas."} action={providersFilter ? { label: "Limpiar búsqueda", onClick: () => { setProvidersSearch(""); setProvidersFilter(""); } } : { label: "Agregar proveedor", onClick: () => setAddingProvider(true) }} />}
      <PaginationControls result={providerResult} onPageChange={setProvidersPage} onPageSizeChange={(size) => { setProvidersPageSize(size); setProvidersPage(1); }} />
    </section> : tab === "report-fields" ? <ReportSchemaManager /> : tab === "system-prompt" ? <SystemPromptManager /> : <div className="grid gap-5">
      {tab === "universities" && <section className="surface min-w-0 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Universidades</h2><div className="flex flex-wrap gap-2"><RefreshButton onClick={() => { setUniversitiesSearched(true); void refetchUniversities(); }} busy={universitiesFetching} label="universidades" /><button className="action" onClick={() => { setEditingUniversity(undefined); setUniversityDialogOpen(true); }}><Plus className="size-4" />Agregar</button></div></div>
        <form className="mb-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); setUniversitiesPage(1); setUniversitiesFilter(universitiesSearch.trim()); setUniversitiesSearched(true); }}>
          <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" value={universitiesSearch} onChange={(event) => setUniversitiesSearch(event.target.value)} placeholder="Nombre o dominio" aria-label="Buscar universidades" />
          <button className="action" type="submit"><Search className="size-4" />Buscar</button>
        </form>
        {universitiesError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">No se pudieron cargar las universidades. <button type="button" className="font-semibold underline" onClick={() => void refetchUniversities()}>Reintentar</button></div> : universitiesLoading ? <DashboardSkeleton rows={3} /> : universities.length ? <div className="table-wrap"><table className="min-w-116"><thead><tr><th>Institución</th><th>Dominio</th><th>Usuarios</th><th>Acciones</th></tr></thead><tbody>{universities.map((university) => <tr key={university.id}><td className="font-medium">{university.name}</td><td>{university.domain || "—"}</td><td>{university.userCount}</td><td><div className="flex gap-2"><button className="action secondary px-3 py-2" aria-label={`Editar ${university.name}`} onClick={() => { setEditingUniversity(university); setUniversityDialogOpen(true); }}><Pencil className="size-4" /></button><button className="action danger px-3 py-2" aria-label={`Eliminar ${university.name}`} onClick={() => void confirmDelete(`la universidad ${university.name}`, () => deleteUniversity.mutate(university.id))}><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Building2} title={universitiesSearched ? (universitiesFilter ? "No hay universidades con esa búsqueda" : "Aún no hay universidades") : "Gestiona las universidades"} description={universitiesSearched ? (universitiesFilter ? "Intenta con otro nombre o dominio, o agrega una nueva institución." : "Registra las instituciones para organizar usuarios y personalizar su identidad visual.") : "Busca una institución por nombre o dominio, o agrega una nueva para empezar."} action={universitiesFilter ? { label: "Limpiar búsqueda", onClick: () => { setUniversitiesSearch(""); setUniversitiesFilter(""); } } : { label: "Agregar universidad", onClick: () => { setEditingUniversity(undefined); setUniversityDialogOpen(true); } }} />}
        <PaginationControls result={universityResult} onPageChange={setUniversitiesPage} onPageSizeChange={(size) => { setUniversitiesPageSize(size); setUniversitiesPage(1); }} />
      </section>}
      {tab === "users" && <section className="surface min-w-0 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Usuarios</h2><div className="flex flex-wrap gap-2"><RefreshButton onClick={() => { setUsersSearched(true); void refetchUsers(); }} busy={usersFetching} label="usuarios" /><button className="action" onClick={() => { setEditingUser(undefined); setUserDialogOpen(true); }}><Plus className="size-4" />Agregar</button></div></div>
        <form className="mb-4 grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          setUsersPage(1);
          setUsersFilter({
            ...(usersSearch.trim() ? { search: usersSearch.trim() } : {}),
            ...(usersRole ? { role: usersRole as "SUPERADMIN" | "INSTRUCTOR" | "STUDENT" } : {}),
            ...(usersUniversityId ? { universityId: usersUniversityId } : {}),
            ...(usersActive ? { isActive: usersActive === "true" } : {}),
          });
          setUsersSearched(true);
        }}>
          <input className="min-w-0 rounded-lg border border-slate-200 px-3 py-2" value={usersSearch} onChange={(event) => setUsersSearch(event.target.value)} placeholder="Nombre o correo" aria-label="Buscar usuarios" />
          <FormSelect aria-label="Filtrar por rol" value={usersRole || "__all_roles__"} onValueChange={(value) => setUsersRole(value === "__all_roles__" ? "" : value)} options={[{ value: "__all_roles__", label: "Todos los roles" }, { value: "SUPERADMIN", label: "Superadmin" }, { value: "INSTRUCTOR", label: "Docente" }, { value: "STUDENT", label: "Estudiante" }]} />
          <FormSelect aria-label="Filtrar por universidad" value={usersUniversityId || "__all_universities__"} onValueChange={(value) => setUsersUniversityId(value === "__all_universities__" ? "" : value)} options={[{ value: "__all_universities__", label: "Todas las universidades" }, ...(universityOptionsResult?.items ?? []).map((university) => ({ value: university.id, label: university.name }))]} />
          <div className="flex gap-2"><FormSelect className="min-w-0 flex-1" aria-label="Filtrar por estado" value={usersActive || "__any_status__"} onValueChange={(value) => setUsersActive(value === "__any_status__" ? "" : value)} options={[{ value: "__any_status__", label: "Cualquier estado" }, { value: "true", label: "Activos" }, { value: "false", label: "Inactivos" }]} /><button className="action" type="submit"><Search className="size-4" />Buscar</button></div>
        </form>
        {usersError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">No se pudieron cargar los usuarios. <button type="button" className="font-semibold underline" onClick={() => void refetchUsers()}>Reintentar</button></div> : usersLoading ? <DashboardSkeleton rows={3} /> : users.length ? <div className="table-wrap"><table className="min-w-3xl"><thead><tr><th>Usuario</th><th>Rol</th><th>Institución</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className={user.isActive ? "" : "opacity-60"}><td><span className="block font-medium">{user.name}</span><span className="text-xs text-slate-500">{user.email}</span></td><td>{roleLabel(user.role)}</td><td>{user.universityName}</td><td>{user.isActive ? "Activo" : "Inactivo"}</td><td><div className="flex gap-2"><button className="action secondary px-3 py-2" aria-label={`Editar ${user.name}`} onClick={() => { setEditingUser(user); setUserDialogOpen(true); }}><Pencil className="size-4" /></button><button className="action secondary px-3 py-2" aria-label={`Enviar restablecimiento a ${user.name}`} disabled={!user.isActive} onClick={() => sendPasswordReset.mutate(user.id)}><Mail className="size-4" /></button><button className="action secondary px-3 py-2" aria-label={user.isActive ? `Desactivar ${user.name}` : `Reactivar ${user.name}`} onClick={() => void toggleUserStatus(user)}>{user.isActive ? <UserRoundX className="size-4" /> : <UserRoundCheck className="size-4" />}</button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title={usersSearched ? "No hay usuarios con estos filtros" : "Gestiona las cuentas"} description={usersSearched ? "Prueba con otros términos o cambia los filtros de rol, institución o estado." : "Busca y administra las cuentas de docentes, estudiantes y administradores."} action={{ label: usersSearch || usersRole || usersUniversityId || usersActive ? "Limpiar filtros" : "Agregar usuario", onClick: () => { if (usersSearch || usersRole || usersUniversityId || usersActive) { setUsersSearch(""); setUsersRole(""); setUsersUniversityId(""); setUsersActive(""); setUsersFilter({}); } else { setEditingUser(undefined); setUserDialogOpen(true); } } }} />}
        <PaginationControls result={userResult} onPageChange={setUsersPage} onPageSizeChange={(size) => { setUsersPageSize(size); setUsersPage(1); }} />
      </section>}
    </div>}
    <UniversityDialog key={editingUniversity?.id ?? "new-university"} {...(editingUniversity ? { university: editingUniversity } : {})} open={universityDialogOpen} onOpenChange={setUniversityDialogOpen} />
    <UserDialog key={editingUser?.id ?? "new-user"} {...(editingUser ? { user: editingUser } : {})} universities={universityOptionsResult?.items ?? universities} open={userDialogOpen} onOpenChange={setUserDialogOpen} />
  </div>;
}

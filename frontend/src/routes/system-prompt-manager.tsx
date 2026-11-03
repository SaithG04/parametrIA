import { useEffect, useState, type FormEvent } from "react";
import { FileClock, History, LockKeyhole, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useActivateSystemPromptVersion, useCreateSystemPromptVersion, useSystemPromptVersions } from "@/hooks/queries";
import { DashboardSkeleton, EmptyState, RefreshButton } from "@/routes/dashboard-shared";

export function SystemPromptManager() {
  const versionsQuery = useSystemPromptVersions();
  const createVersion = useCreateSystemPromptVersion();
  const activateVersion = useActivateSystemPromptVersion();
  const versions = versionsQuery.data ?? [];
  const activeVersion = versions.find((version) => version.isActive);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [hasEdited, setHasEdited] = useState(false);

  useEffect(() => {
    if (!activeVersion || hasEdited) return;
    setTitle(activeVersion.title);
    setInstructions(activeVersion.instructions);
  }, [activeVersion, hasEdited]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createVersion.mutate({ title: title.trim(), instructions: instructions.trim() }, {
      onSuccess: () => setHasEdited(false),
    });
  }

  return <section className="grid gap-5">
    <article className="system-prompt-banner">
      <span className="system-prompt-banner-icon"><ShieldCheck aria-hidden="true" /></span>
      <div>
        <p className="system-prompt-banner-label">Configuración global de evaluación</p>
        <h2>Instrucciones del sistema</h2>
        <p>Define criterios comunes para todas las aulas. Cada cambio crea una versión nueva; las evaluaciones anteriores conservan la versión que utilizaron.</p>
      </div>
      {activeVersion && <span className="system-prompt-version-badge">Activa · v{activeVersion.version}</span>}
    </article>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.85fr)]">
      <section className="surface min-w-0 p-4 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-slate-900">Editar instrucciones</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">Al guardar se crea una nueva versión y pasa a ser la activa. Las versiones publicadas no se sobrescriben.</p>
        </div>
        {versionsQuery.isLoading ? <DashboardSkeleton rows={3} /> : versionsQuery.isError
          ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">El editor estará disponible cuando se recupere la versión activa.</div>
          : <form className="grid gap-4" onSubmit={submit}>
            <label className="field">Nombre de la versión
              <input required maxLength={100} value={title} onChange={(event) => { setTitle(event.target.value); setHasEdited(true); }} placeholder="Evaluación académica general" />
            </label>
            <label className="field">Instrucciones institucionales
              <textarea required minLength={10} maxLength={30000} rows={12} value={instructions} onChange={(event) => { setInstructions(event.target.value); setHasEdited(true); }} placeholder="Indica los criterios comunes que debe aplicar el evaluador…" />
              <span className="text-xs font-normal text-slate-500">{instructions.length.toLocaleString("es-PE")} / 30 000 caracteres</span>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><LockKeyhole className="size-4 text-slate-500" />Reglas técnicas protegidas</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Las reglas contra instrucciones maliciosas en documentos, la respuesta en español y la salida JSON estricta se mantienen en el sistema y no pueden eliminarse desde este editor.</p>
            </div>
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
              <p className="text-sm font-semibold text-cyan-950">Campos del reporte vinculados</p>
              <p className="mt-1 text-sm leading-6 text-cyan-900/80">Las claves, descripciones, tipos y propiedades definidos en «Campos del reporte» se añaden automáticamente a las instrucciones. No hace falta copiarlos aquí.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">{activeVersion ? `La siguiente versión será v${activeVersion.version + 1}.` : "La configuración inicial se creará como versión 1."}</span>
              <button className="action" disabled={createVersion.isPending || !title.trim() || instructions.trim().length < 10}>
                <Save className="size-4" />{createVersion.isPending ? "Guardando versión…" : "Guardar nueva versión y activar"}
              </button>
            </div>
          </form>}
      </section>

      <section className="surface min-w-0 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><History className="size-5 text-slate-500" />Historial</h3><p className="mt-1 text-sm text-slate-500">Revisa o reactiva una versión anterior.</p></div>
          <RefreshButton onClick={() => void versionsQuery.refetch()} busy={versionsQuery.isFetching} label="versiones" />
        </div>
        {versionsQuery.isLoading ? <DashboardSkeleton rows={3} /> : versionsQuery.isError
          ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">No se pudo cargar el historial.</p>
          : versions.length ? <ol className="grid gap-3">{versions.map((version) => <li key={version.id} className={`rounded-xl border p-4 ${version.isActive ? "brand-border bg-[var(--institution-soft)]" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900"><span>v{version.version}</span><span>{version.title}</span>{version.isActive && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Activa</span>}</p>
                <time className="mt-1 block text-xs text-slate-500" dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              {!version.isActive && <button type="button" className="action secondary px-3 py-2" onClick={() => activateVersion.mutate(version.id)} disabled={activateVersion.isPending}>
                <RotateCcw className="size-4" />Reactivar
              </button>}
            </div>
            <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{version.instructions}</p>
          </li>)}</ol>
          : <EmptyState icon={FileClock} title="Aún no hay versiones" description="Guarda las instrucciones para crear la primera versión." />}
      </section>
    </div>
  </section>;
}

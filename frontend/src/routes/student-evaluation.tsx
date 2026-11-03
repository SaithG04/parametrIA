import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FileText,
  GraduationCap,
  Search,
} from "lucide-react";
import { ByokModal } from "@/components/byok-modal";
import { DropZone } from "@/components/dropzone";
import { BrandLoader } from "@/components/brand-loader";
import { MarkdownPreview } from "@/components/markdown-preview";
import { FormSelect } from "@/components/ui/form-select";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import {
  isDailyLimitError,
  useActiveEvaluationJob,
  useClassrooms,
  useEvaluationJob,
  usePreviewEvaluation,
  useSubmitByok,
  useSubmitEvaluation,
} from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import { ApiError } from "@/lib/api";
import type { EvaluationSubmission } from "@/services/endpoints";
import { StudentEvaluationFlow } from "@/routes/student-evaluation-flow";
import {
  DashboardBanner,
  DashboardSkeleton,
  EmptyState,
  PageHeading,
  RefreshButton,
} from "@/routes/dashboard-shared";

export function StudentEvaluationPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { confirm } = useConfirmation();
  const [classroomSearch, setClassroomSearch] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("");
  const [classroomsSearched, setClassroomsSearched] = useState(false);
  const classroomsQuery = useClassrooms(user!, 1, 100, classroomFilter, classroomsSearched);
  const classrooms = classroomsQuery.data?.items ?? [];
  const [classroomId, setClassroomId] = useState("");
  const activeClassroomId = classrooms.some((item) => item.id === classroomId)
    ? classroomId
    : classrooms[0]?.id ?? "";
  const submit = useSubmitEvaluation();
  const submitByok = useSubmitByok();
  const preview = usePreviewEvaluation();
  const activeJobQuery = useActiveEvaluationJob(Boolean(user?.id));
  const jobKey = `parametria.evaluation-job.${user?.id ?? "guest"}`;
  const [jobId, setJobId] = useState("");
  const activeJobId = activeJobQuery.isFetchedAfterMount && !activeJobQuery.isError
    ? activeJobQuery.data?.id ?? ""
    : "";
  const currentJobId = jobId || activeJobId;
  const jobQuery = useEvaluationJob(currentJobId, Boolean(currentJobId));
  const [file, setFile] = useState<File | null>(null);
  const [byokOpen, setByokOpen] = useState(false);
  const [confirmingSubmission, setConfirmingSubmission] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const canSubmit = Boolean(file && activeClassroomId && user?.id);
  const completedJob = jobQuery.data?.status === "SUCCEEDED" ? jobQuery.data : undefined;
  const activeJob = jobId
    ? jobQuery.data
    : activeJobQuery.isFetchedAfterMount && !activeJobQuery.isError
      ? activeJobQuery.data ?? undefined
      : undefined;
  const isJobInProgress = activeJob?.status === "WAITING" || activeJob?.status === "PROCESSING";
  const staleJobError = jobQuery.error instanceof ApiError
    && jobQuery.error.code === "EVALUATION_JOB_NOT_FOUND";
  const statusError = activeJobQuery.isError || (jobQuery.isError && !staleJobError);

  useEffect(() => {
    window.localStorage.removeItem(jobKey);
  }, [jobKey]);

  useEffect(() => {
    if (!staleJobError) return;
    window.localStorage.removeItem(jobKey);
    setJobId("");
  }, [jobKey, staleJobError]);

  useEffect(() => {
    if (file && activeClassroomId) preview.mutate({ classroomId: activeClassroomId, file });
  }, [file, activeClassroomId]);

  function rememberJob(job: { id: string }) {
    setJobId(job.id);
  }

  async function submitDocument() {
    if (!file || !activeClassroomId || !user) return;
    setConfirmingSubmission(true);
    try {
      const accepted = await confirm({
        title: "¿Procesar este documento?",
        description: `Se enviará «${file.name}» para evaluación y se consumirá 1 intento diario.`,
        confirmLabel: "Confirmar y procesar",
      });
      if (!accepted) return;
      const input: EvaluationSubmission = { classroomId: activeClassroomId, studentId: user.id, file };
      setUploadProgress(0);
      submit.mutate({ input, onUploadProgress: setUploadProgress }, {
        onSuccess: rememberJob,
        onError: (error) => {
          setUploadProgress(0);
          if (isDailyLimitError(error)) setByokOpen(true);
        },
      });
    } finally {
      setConfirmingSubmission(false);
    }
  }

  function chooseFile(nextFile: File) {
    if (!nextFile.name.toLowerCase().endsWith(".docx")) {
      toast.error("Selecciona un documento Word .docx.");
      return;
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 15 MB.");
      return;
    }
    setFile(nextFile);
    setUploadProgress(0);
    preview.reset();
  }

  function startAnotherEvaluation() {
    window.localStorage.removeItem(jobKey);
    setJobId("");
    setFile(null);
    setUploadProgress(0);
    preview.reset();
    void activeJobQuery.refetch();
  }

  return <div className="page-enter">
    <Link to="/app/student" className="action secondary mb-5">
      <ArrowLeft aria-hidden="true" className="size-4" />Volver al resumen
    </Link>
    <PageHeading
      eyebrow="Espacio del estudiante"
      title="Subir documento"
      description="Selecciona el aula, revisa el contenido que recibirá el evaluador y confirma el envío."
    />
    <StudentEvaluationFlow
      file={file ?? undefined}
      previewReady={Boolean(preview.data)}
      previewLoading={preview.isPending}
      uploadProgress={uploadProgress}
      uploading={submit.isPending || submitByok.isPending}
      job={activeJob ?? undefined}
    />
    {!isJobInProgress && !completedJob && <DashboardBanner
      icon={GraduationCap}
      title="Nueva evaluación"
      description="La vista previa te permite comprobar el documento antes de consumir un intento diario."
    />}

    {!isJobInProgress && !completedJob && <section className="surface mb-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="field min-w-0">
        Buscar aula
        <input
          value={classroomSearch}
          onChange={(event) => setClassroomSearch(event.target.value)}
          placeholder="Nombre del aula, curso o código"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="action"
          onClick={() => {
            setClassroomFilter(classroomSearch.trim());
            setClassroomsSearched(true);
          }}
        >
          <Search className="size-4" />Buscar aulas
        </button>
        {classroomsSearched && (
          <RefreshButton
            onClick={() => void classroomsQuery.refetch()}
            busy={classroomsQuery.isFetching}
            label="aulas"
          />
        )}
      </div>
      {classrooms.length > 0 && (
        <label className="field sm:col-span-2">
          Aula asignada
          <FormSelect
            value={activeClassroomId}
            onValueChange={(value) => {
              setClassroomId(value);
              setFile(null);
              setUploadProgress(0);
              preview.reset();
            }}
            options={classrooms.map((item) => ({
              value: item.id,
              label: `${item.name} · ${item.courseName} · ${item.code}`,
            }))}
          />
        </label>
      )}
    </section>}

    {!isJobInProgress && !completedJob && !classroomsSearched && (
      <EmptyState
        icon={Search}
        title="Busca un aula para empezar"
        description="Consulta las aulas a las que estás matriculado para seleccionar dónde enviar tu documento."
      />
    )}
    {!isJobInProgress && !completedJob && classroomsSearched && classroomsQuery.isLoading && <DashboardSkeleton rows={2} />}
    {!isJobInProgress && !completedJob && classroomsSearched && classroomsQuery.isError && (
      <p role="alert" className="surface p-4 text-sm text-rose-800">
        No se pudieron cargar tus aulas.{" "}
        <button type="button" className="font-semibold underline" onClick={() => void classroomsQuery.refetch()}>
          Reintentar
        </button>
      </p>
    )}
    {!isJobInProgress && !completedJob && classroomsSearched && !classroomsQuery.isLoading && !classroomsQuery.isError && classrooms.length === 0 && (
      <EmptyState
        icon={BookOpen}
        title="No se encontraron aulas"
        description={classroomFilter
          ? "Prueba con otro nombre, curso o código."
          : "Cuando tu docente te matricule, el aula aparecerá aquí."}
      />
    )}

    {statusError && (
      <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        No se pudo consultar el estado de la evaluación.{" "}
        <button
          type="button"
          className="font-semibold underline"
          onClick={() => { void activeJobQuery.refetch(); if (currentJobId) void jobQuery.refetch(); }}
        >
          Reintentar
        </button>
      </p>
    )}
    {jobQuery.data?.status === "FAILED" && (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-900">Puedes revisar el archivo e iniciar otra evaluación.</p>
        <button type="button" className="action secondary" onClick={startAnotherEvaluation}>Intentar de nuevo</button>
      </div>
    )}
    {completedJob && (
      <section className="evaluation-ready-card mb-5">
        <div className="evaluation-ready-icon"><CheckCircle2 aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <h2>Tu evaluación está lista</h2>
          <p>{completedJob.fileName} se procesó correctamente. Consulta ahora el informe completo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="action"
            onClick={() => completedJob.evaluationId && navigate(`/app/student/reports/${encodeURIComponent(completedJob.evaluationId)}`)}
            disabled={!completedJob.evaluationId}
          >
            <FileCheck2 className="size-4" />Ver informe
          </button>
          <button type="button" className="action secondary" onClick={startAnotherEvaluation}>
            Nueva evaluación
          </button>
        </div>
      </section>
    )}

    {activeClassroomId && !isJobInProgress && !completedJob && (
      <section className="surface grid gap-5 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Documento para evaluar</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Revisa el Word original y el texto que se enviará al evaluador. La vista previa no consume intentos.
          </p>
        </div>
        <DropZone
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          label="Arrastra tu documento aquí"
          hint="Documento Microsoft Word · .docx · máximo 15 MB"
          fileName={file?.name ?? null}
          onFile={chooseFile}
        />
        {file && (
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <FileText className="size-4" />Word original
              </h3>
              <OriginalWordPreview file={file} />
            </section>
            <section className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <h3 className="mb-2 font-semibold">Vista previa del documento convertido</h3>
              {preview.isPending
                ? <BrandLoader label="Convirtiendo el documento…" />
                : preview.isError
                  ? <p role="alert" className="text-sm text-rose-700">No se pudo preparar la vista previa. Comprueba que el documento Word sea válido.</p>
                  : preview.data
                    ? <>
                        <p className="mb-3 text-xs leading-5 text-slate-500">
                          El contenido se muestra en Markdown para conservar títulos, listas y tablas. Las imágenes y el diseño de página no se envían. {preview.data.characterCount.toLocaleString("es-PE")} caracteres.
                        </p>
                        <MarkdownPreview source={preview.data.convertedText} />
                      </>
                    : <p className="text-sm text-slate-500">Preparando vista previa…</p>}
            </section>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="max-w-2xl text-xs leading-5 text-slate-500">
            Al confirmar, se consumirá un intento diario. La evaluación se procesa en segundo plano.
          </p>
          <button
            type="button"
            className="action"
            disabled={!canSubmit || !preview.data || submit.isPending || confirmingSubmission || Boolean(activeJobQuery.data)}
            onClick={() => void submitDocument()}
          >
            {submit.isPending ? "Enviando…" : "Confirmar y procesar"}
          </button>
        </div>
      </section>
    )}

    <div className="mt-5">
      <Link to="/app/student/reports" className="action secondary">
        <FileCheck2 className="size-4" />Consultar mis reportes
      </Link>
    </div>
    <ByokModal
      open={byokOpen}
      onOpenChange={setByokOpen}
      submitting={submitByok.isPending}
      onConfirm={({ providerId, apiKey }) => {
        if (!file || !user) return;
        setUploadProgress(0);
        submitByok.mutate(
          {
            input: { classroomId: activeClassroomId, studentId: user.id, file, providerId, apiKey },
            onUploadProgress: setUploadProgress,
          },
          {
            onSuccess: (job) => { rememberJob(job); setByokOpen(false); },
            onError: () => setUploadProgress(0),
          },
        );
      }}
    />
  </div>;
}

export function OriginalWordPreview({ file }: { file: File }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setError("");
    setLoading(true);
    const renderTarget = document.createElement("div");
    void import("docx-preview")
      .then(({ renderAsync }) => renderAsync(file, renderTarget, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: true,
      }))
      .then(() => {
        if (active) container.replaceChildren(...renderTarget.childNodes);
      })
      .catch(() => {
        if (active) setError("No se pudo interpretar el Word original. Puedes revisar el texto convertido en la vista previa.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; container.replaceChildren(); };
  }, [file]);

  return (
    <div className="max-h-[38rem] overflow-auto rounded-lg bg-slate-50 p-2">
      {error && <p role="alert" className="mb-2 text-sm text-rose-700">{error}</p>}
      {loading && <p className="mb-2 text-sm text-slate-500">Cargando vista del documento Word…</p>}
      <div ref={containerRef} className="docx-preview min-h-24" />
    </div>
  );
}

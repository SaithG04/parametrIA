import {
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileCheck2,
  FileText,
  LoaderCircle,
  Upload,
} from "lucide-react";
import type { EvaluationJob } from "@/services/types";

type StepState = "complete" | "current" | "pending" | "error";

interface EvaluationFlowProps {
  file: File | undefined;
  previewReady: boolean;
  previewLoading: boolean;
  uploadProgress: number;
  uploading: boolean;
  job: EvaluationJob | undefined;
}

export function StudentEvaluationFlow({
  file,
  previewReady,
  previewLoading,
  uploadProgress,
  uploading,
  job,
}: EvaluationFlowProps) {
  const isComplete = job?.status === "SUCCEEDED";
  const hasFailed = job?.status === "FAILED";
  const isProcessing = job?.status === "WAITING" || job?.status === "PROCESSING";
  const uploadDone = Boolean(job) || (!uploading && uploadProgress === 100);
  const steps: Array<{ label: string; detail: string; state: StepState }> = [
    {
      label: "Documento",
      detail: file
        ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : job?.fileName ?? "Documento recibido",
      state: file || job ? "complete" : "pending",
    },
    {
      label: "Vista previa",
      detail: previewReady || job
        ? "Contenido revisado"
        : previewLoading
          ? "Preparando documento…"
          : "Pendiente de revisión",
      state: previewReady || job ? "complete" : previewLoading ? "current" : "pending",
    },
    {
      label: "Envío",
      detail: uploading ? `Subiendo ${uploadProgress}%` : uploadDone ? "Documento recibido" : "Listo para enviar",
      state: uploading ? "current" : uploadDone ? "complete" : "pending",
    },
    {
      label: "Evaluación",
      detail: isComplete
        ? "Informe listo"
        : hasFailed
          ? "Necesita atención"
          : job?.status === "WAITING"
            ? "En cola"
            : job?.status === "PROCESSING"
              ? "Analizando documento…"
              : "En espera de envío",
      state: hasFailed ? "error" : isComplete ? "complete" : isProcessing ? "current" : "pending",
    },
  ];

  if (!file && !job) return null;

  return (
    <section
      className={`evaluation-flow ${isComplete ? "is-success" : hasFailed ? "is-error" : ""}`}
      aria-label="Progreso de la evaluación"
      aria-live="polite"
    >
      <header className="evaluation-flow-heading">
        <span className="evaluation-flow-heading-icon">
          {isComplete
            ? <CircleCheck aria-hidden="true" />
            : hasFailed
              ? <CircleAlert aria-hidden="true" />
              : isProcessing || uploading
                ? <LoaderCircle aria-hidden="true" className="animate-spin" />
                : <FileCheck2 aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2>{isComplete ? "Evaluación completada" : hasFailed ? "No se pudo completar" : "Progreso del documento"}</h2>
          <p>
            {isComplete
              ? "El informe ya está disponible para consultarlo."
              : hasFailed
                ? job?.errorMessage || "Revisa el documento o la configuración del aula y vuelve a intentarlo."
                : uploading
                  ? "Estamos enviando el documento de forma segura."
                  : isProcessing
                    ? "El evaluador está trabajando. Puedes dejar esta página abierta."
                    : previewReady
                      ? "La vista previa está lista. Confirma para iniciar la evaluación."
                      : "Selecciona un documento y revisa el contenido antes de enviarlo."}
          </p>
        </div>
      </header>

      <ol className="evaluation-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={`evaluation-step is-${step.state}`}>
            <span className="evaluation-step-marker">
              {step.state === "complete"
                ? <Check aria-hidden="true" />
                : step.state === "error"
                  ? <CircleAlert aria-hidden="true" />
                  : step.state === "current"
                    ? <LoaderCircle aria-hidden="true" className="animate-spin" />
                    : <span>{index + 1}</span>}
            </span>
            <span className="evaluation-step-copy">
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>

      {uploading && (
        <div
          className="evaluation-upload-progress"
          role="progressbar"
          aria-label={`Carga del documento ${uploadProgress}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={uploadProgress}
        >
          <div className="evaluation-upload-progress-track">
            <span className={uploadProgress === 0 ? "is-indeterminate" : ""} style={{ width: `${uploadProgress}%` }} />
          </div>
          <span>{uploadProgress}%</span>
        </div>
      )}

      {isProcessing && (
        <div className="evaluation-processing-indicator">
          <span />
          <span />
          <span />
          <p><Clock3 aria-hidden="true" />El informe se actualizará automáticamente</p>
        </div>
      )}

      {hasFailed && job?.errorMessage && (
        <p className="evaluation-flow-error">
          <CircleAlert aria-hidden="true" />{job.errorMessage}
        </p>
      )}

      {!job && !uploading && file && (
        <p className="evaluation-flow-file">
          <FileText aria-hidden="true" />
          <span>{file.name}</span>
          <Upload aria-hidden="true" />
        </p>
      )}
    </section>
  );
}

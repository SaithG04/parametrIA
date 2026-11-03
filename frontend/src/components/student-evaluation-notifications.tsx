import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, ExternalLink, LoaderCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import "./student-evaluation-notifications.css";
import { useActiveEvaluationJob } from "@/hooks/queries";
import { useEvaluationJobEvents } from "@/hooks/use-evaluation-job-events";
import type { EvaluationJob } from "@/services/types";

function isActive(job: EvaluationJob | null | undefined) {
  return job?.status === "WAITING" || job?.status === "PROCESSING";
}

function statusLabel(status: EvaluationJob["status"]) {
  if (status === "WAITING") return "En cola";
  if (status === "PROCESSING") return "Procesando";
  if (status === "SUCCEEDED") return "Completada";
  return "No se pudo completar";
}

export function StudentEvaluationNotifications() {
  const activeQuery = useActiveEvaluationJob();
  const realtime = useEvaluationJobEvents();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const activeJob = isActive(activeQuery.data) ? activeQuery.data : null;
  const job = activeJob ?? realtime.lastJob;

  useEffect(() => {
    if (realtime.lastJob) setUnread(true);
  }, [realtime.lastJob]);

  function toggle() {
    setOpen((current) => !current);
    setUnread(false);
  }

  return <div className="evaluation-notifications">
    <button
      type="button"
      className="evaluation-notifications-trigger"
      aria-label={activeJob ? `Notificaciones: evaluación ${statusLabel(activeJob.status)}` : "Notificaciones de evaluación"}
      aria-expanded={open}
      aria-controls="student-evaluation-notifications"
      onClick={toggle}
    >
      <Bell aria-hidden="true" className="size-5" />
      {(activeJob || unread) && <span className="evaluation-notifications-badge" aria-hidden="true">1</span>}
    </button>
    {open && <section
      id="student-evaluation-notifications"
      className="evaluation-notifications-panel"
      aria-label="Notificaciones de evaluación"
      aria-live="polite"
    >
      <header className="evaluation-notifications-heading">
        <div>
          <strong>Procesamiento</strong>
          <p>Estado de tu documento</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones">
          <XCircle aria-hidden="true" className="size-4" />
        </button>
      </header>
      {activeQuery.isPending
        ? <p className="evaluation-notifications-empty">Consultando el estado…</p>
        : activeQuery.isError
          ? <p role="alert" className="evaluation-notifications-error">No se pudo consultar el estado. Actualiza la página o inténtalo nuevamente.</p>
          : job
            ? <div className="evaluation-notification-item">
                <span className={`evaluation-notification-icon is-${job.status.toLowerCase()}`}>
                  {job.status === "WAITING"
                    ? <Clock3 aria-hidden="true" className="size-5" />
                    : job.status === "PROCESSING"
                      ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
                      : job.status === "SUCCEEDED"
                        ? <CheckCircle2 aria-hidden="true" className="size-5" />
                        : <XCircle aria-hidden="true" className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <strong>{statusLabel(job.status)}</strong>
                  <p className="evaluation-notification-file">{job.fileName}</p>
                  <p className="evaluation-notification-message">
                    {job.status === "WAITING"
                      ? "Tu documento está esperando para ser procesado."
                      : job.status === "PROCESSING"
                        ? "El evaluador está trabajando en tu informe."
                        : job.status === "SUCCEEDED"
                          ? "Tu informe ya está disponible."
                          : job.errorMessage || "Revisa el documento e inténtalo nuevamente."}
                  </p>
                  {job.status === "SUCCEEDED" && job.evaluationId && (
                    <Link
                      className="evaluation-notification-link"
                      to={`/app/student/reports/${encodeURIComponent(job.evaluationId)}`}
                      onClick={() => setOpen(false)}
                    >
                      Ver informe <ExternalLink aria-hidden="true" className="size-3.5" />
                    </Link>
                  )}
                  {job.status === "FAILED" && (
                    <Link className="evaluation-notification-link" to="/app/student/evaluation" onClick={() => setOpen(false)}>
                      Intentar otra vez <ExternalLink aria-hidden="true" className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            : <p className="evaluation-notifications-empty">No tienes evaluaciones en proceso.</p>}
      {!realtime.connected && activeJob && (
        <p className="evaluation-notifications-fallback">Reconectando a las actualizaciones en tiempo real…</p>
      )}
      <Link
        className="evaluation-notifications-footer"
        to="/app/student/evaluation"
        onClick={() => setOpen(false)}
      >
        Ir a Subir documento
      </Link>
    </section>}
  </div>;
}

import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileCheck2, GraduationCap } from "lucide-react";
import { ReportDocument, ReportPdfDownloadButton } from "@/components/report-document";
import { useEvaluation } from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import { DashboardBanner, EmptyState, PageHeading } from "@/routes/dashboard-shared";

export function EvaluationReportDetailPage() {
  const { evaluationId = "" } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const evaluationQuery = useEvaluation(evaluationId);
  const backPath = user?.role === "INSTRUCTOR"
    ? "/app/instructor/reports"
    : "/app/student/reports";

  return <div className="page-enter">
    <Link to={backPath} className="action secondary mb-5">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Volver a reportes
    </Link>
    <PageHeading
      eyebrow={user?.role === "INSTRUCTOR" ? "Auditoría académica" : "Espacio del estudiante"}
      title="Informe de evaluación"
      description="Consulta el resultado completo y los datos del documento evaluado."
    />
    {evaluationQuery.isLoading
      ? <div className="surface p-8 text-center text-sm text-slate-500">Cargando el informe…</div>
      : evaluationQuery.isError || !evaluationQuery.data
        ? <EmptyState
            icon={FileCheck2}
            title="No se pudo abrir este informe"
            description="Puede que no exista o que no tengas permiso para consultarlo."
            action={{ label: "Volver a reportes", onClick: () => navigate(backPath) }}
          />
        : <>
            <DashboardBanner
              icon={GraduationCap}
              title={`${evaluationQuery.data.courseName} · ${evaluationQuery.data.classroomName}`}
              description={`${new Date(evaluationQuery.data.createdAt).toLocaleString("es-CO")} · ${evaluationQuery.data.providerName} · ${evaluationQuery.data.model}`}
            />
            <div className="report-toolbar flex justify-end">
              <p className="mr-auto self-center text-xs text-slate-500">Se abrirá la impresión del navegador; elige «Guardar como PDF».</p>
              <ReportPdfDownloadButton fileName={evaluationQuery.data.fileName} />
            </div>
            <ReportDocument
              report={{
                ...evaluationQuery.data.report,
                providerName: evaluationQuery.data.providerName ?? evaluationQuery.data.report.providerName ?? "ParametrIA",
                model: evaluationQuery.data.model ?? evaluationQuery.data.report.model ?? "Modelo evaluador",
              }}
              studentName={evaluationQuery.data.studentName}
              fileName={evaluationQuery.data.fileName}
            />
          </>}
  </div>;
}

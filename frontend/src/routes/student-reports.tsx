import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileCheck2, GraduationCap, Search } from "lucide-react";
import { PaginationControls } from "@/components/pagination-controls";
import { useEvaluations } from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import { DashboardBanner, DashboardSkeleton, EmptyState, PageHeading, RefreshButton } from "./dashboard-shared";

export function StudentReportsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const reportsQuery = useEvaluations(
    { studentId: user?.id ?? "", ...(submittedSearch ? { search: submittedSearch } : {}) },
    page,
    pageSize,
    Boolean(user?.id) && hasSearched,
  );
  const reports = reportsQuery.data?.items ?? [];

  function searchReports(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
    setHasSearched(true);
  }

  function openReport(id: string) {
    navigate(`/app/student/reports/${encodeURIComponent(id)}`);
  }

  return <div className="page-enter">
    <PageHeading
      eyebrow="Espacio del estudiante"
      title="Mis reportes"
      description="Consulta los informes generados para tus documentos en todas tus aulas."
    />
    <DashboardBanner
      icon={GraduationCap}
      title="Tus resultados académicos"
      description="Busca tus evaluaciones y selecciona una fila para abrir el informe completo."
    />
    <form className="surface mb-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={searchReports}>
      <label className="field min-w-0">
        Nombre del documento
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. tesis-final.docx" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="action" type="submit"><Search className="size-4" />Buscar reportes</button>
        {hasSearched && <RefreshButton onClick={() => void reportsQuery.refetch()} busy={reportsQuery.isFetching} label="reportes" />}
      </div>
    </form>

    {reportsQuery.isError && hasSearched
      ? <EmptyState
          icon={FileCheck2}
          title="No se pudieron cargar tus reportes"
          description="Inténtalo de nuevo en unos momentos."
          action={{ label: "Actualizar", onClick: () => void reportsQuery.refetch() }}
        />
      : reportsQuery.isLoading && hasSearched
        ? <DashboardSkeleton rows={4} />
        : !hasSearched
          ? <EmptyState icon={Search} title="Busca tus reportes" description="Puedes filtrar por el nombre del archivo evaluado." />
          : reports.length === 0
            ? <EmptyState icon={FileCheck2} title="Todavía no tienes reportes" description="Cuando completes una evaluación, su informe aparecerá aquí." />
            : <>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Documento</th><th>Curso y aula</th><th>Fecha</th><th>Proveedor</th></tr></thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr
                          key={report.id}
                          className="evaluation-report-row"
                          onClick={() => openReport(report.id)}
                        >
                          <td className="font-semibold"><Link to={`/app/student/reports/${encodeURIComponent(report.id)}`} onClick={(event) => event.stopPropagation()}>{report.fileName}</Link></td>
                          <td>{report.courseName}<span className="block text-xs text-slate-500">{report.classroomName}</span></td>
                          <td>{new Date(report.createdAt).toLocaleString("es-CO")}</td>
                          <td>{report.providerName}<span className="block text-xs text-slate-500">{report.model}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  result={reportsQuery.data}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
              </>}
  </div>;
}

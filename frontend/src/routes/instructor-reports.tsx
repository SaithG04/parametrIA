import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, FileSearch, Search } from "lucide-react";
import { PaginationControls } from "@/components/pagination-controls";
import { FormSelect } from "@/components/ui/form-select";
import { useClassrooms, useCourses, useEvaluations } from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import { DashboardBanner, DashboardSkeleton, EmptyState, PageHeading, RefreshButton } from "@/routes/dashboard-shared";

export function InstructorReportsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const coursesQuery = useCourses({ page: 1, pageSize: 100 });
  const classroomsQuery = useClassrooms(user!, 1, 100);
  const [courseId, setCourseId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [fileName, setFileName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState<{
    courseId?: string;
    classroomId?: string;
    studentName?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const reportsQuery = useEvaluations(filters, page, pageSize, hasSearched);
  const reports = reportsQuery.data?.items ?? [];

  function searchReports(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({
      ...(courseId ? { courseId } : {}),
      ...(classroomId ? { classroomId } : {}),
      ...(studentName.trim() ? { studentName: studentName.trim() } : {}),
      ...(fileName.trim() ? { search: fileName.trim() } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    });
    setHasSearched(true);
  }

  function openReport(id: string) {
    navigate(`/app/instructor/reports/${encodeURIComponent(id)}`);
  }

  return <div className="page-enter">
    <PageHeading
      eyebrow="Panel docente"
      title="Auditoría de reportes"
      description="Consulta las evaluaciones de los estudiantes matriculados en tus aulas."
    />
    <DashboardBanner
      icon={ClipboardCheck}
      title="Reportes de tus estudiantes"
      description="Filtra por curso, aula, estudiante o fecha y abre una fila para revisar el informe completo."
    />
    <form className="surface mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 2xl:items-end" onSubmit={searchReports}>
      <label className="field min-w-0">
        Curso
        <FormSelect
          value={courseId}
          onValueChange={(value) => {
            setCourseId(value);
            setClassroomId("");
          }}
          placeholder={coursesQuery.isLoading ? "Cargando cursos…" : "Todos mis cursos"}
          options={coursesQuery.data?.items.map((course) => ({ value: course.id, label: course.name })) ?? []}
        />
      </label>
      <label className="field min-w-0">
        Aula
        <FormSelect
          value={classroomId}
          onValueChange={setClassroomId}
          placeholder={classroomsQuery.isLoading ? "Cargando aulas…" : "Todas mis aulas"}
          options={(classroomsQuery.data?.items ?? [])
            .filter((classroom) => !courseId || classroom.courseId === courseId)
            .map((classroom) => ({
              value: classroom.id,
              label: `${classroom.name} · ${classroom.courseName}`,
            }))}
        />
      </label>
      <label className="field min-w-0">Estudiante<input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Nombre del estudiante" /></label>
      <label className="field min-w-0">Desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label className="field min-w-0">Hasta<input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <label className="field min-w-0">Documento<input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Nombre del archivo" /></label>
      <div className="flex flex-wrap gap-2">
        <button className="action" type="submit"><Search className="size-4" />Buscar</button>
        {hasSearched && <RefreshButton onClick={() => void reportsQuery.refetch()} busy={reportsQuery.isFetching} label="reportes" />}
      </div>
    </form>

    {reportsQuery.isError && hasSearched
      ? <EmptyState
          icon={FileSearch}
          title="No se pudieron cargar los reportes"
          description="Inténtalo de nuevo para consultar las evaluaciones de tus cursos."
          action={{ label: "Reintentar", onClick: () => void reportsQuery.refetch() }}
        />
      : reportsQuery.isLoading && hasSearched
        ? <DashboardSkeleton rows={4} />
        : !hasSearched
          ? <EmptyState icon={Search} title="Busca evaluaciones" description="Elige los filtros que necesitas y presiona Buscar para consultar los reportes." />
          : reports.length === 0
            ? <EmptyState icon={FileSearch} title="No hay reportes para estos filtros" description="Prueba con otro curso o amplía el rango de fechas." />
            : <>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Documento</th><th>Estudiante</th><th>Curso y aula</th><th>Fecha</th><th>Proveedor</th></tr></thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr
                          key={report.id}
                          className="evaluation-report-row"
                          onClick={() => openReport(report.id)}
                        >
                          <td className="font-semibold"><Link to={`/app/instructor/reports/${encodeURIComponent(report.id)}`} onClick={(event) => event.stopPropagation()}>{report.fileName}</Link></td>
                          <td>{report.studentName}</td>
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

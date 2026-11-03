import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Upload,
} from "lucide-react";
import { useStudentStats } from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import {
  DashboardBanner,
  DashboardSkeleton,
  EmptyState,
  PageHeading,
  RefreshButton,
  StatCard,
} from "@/routes/dashboard-shared";

export function StudentDashboard() {
  const { user } = useSession();
  const statsQuery = useStudentStats(Boolean(user?.id));

  return <div className="page-enter">
    <PageHeading
      eyebrow="Panel del estudiante"
      title="Resumen"
      description="Consulta tu actividad académica y accede a tus evaluaciones y reportes."
    />
    <DashboardBanner
      icon={GraduationCap}
      title={`Hola, ${user?.name?.split(" ")[0] ?? "estudiante"}`}
      description="Este es el resumen de tus aulas y evaluaciones."
    />

    <section className="mb-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tu actividad</h2>
          <p className="mt-1 text-sm text-slate-600">Métricas actualizadas de tu cuenta.</p>
        </div>
        <RefreshButton
          onClick={() => void statsQuery.refetch()}
          busy={statsQuery.isFetching}
          label="métricas"
        />
      </div>
      {statsQuery.isLoading
        ? <DashboardSkeleton rows={2} />
        : statsQuery.isError
          ? <EmptyState
              icon={Activity}
              title="No se pudieron cargar tus métricas"
              description="Inténtalo de nuevo para consultar el resumen."
              action={{ label: "Reintentar", onClick: () => void statsQuery.refetch() }}
            />
          : statsQuery.data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Aulas activas" value={statsQuery.data.classroomCount} icon={BookOpen} />
              <StatCard label="Evaluaciones completadas" value={statsQuery.data.evaluationCount} icon={ClipboardCheck} />
              <StatCard label="Evaluaciones este mes" value={statsQuery.data.monthEvaluationCount} icon={CalendarDays} />
              <StatCard label="En proceso" value={statsQuery.data.activeJobCount} icon={Activity} />
            </div>}
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900">Accesos rápidos</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink
          to="/app/student/evaluation"
          icon={Upload}
          title="Subir documento"
          description="Selecciona un aula, revisa tu documento y envíalo para evaluación."
        />
        <QuickLink
          to="/app/student/reports"
          icon={FileCheck2}
          title="Mis reportes"
          description="Busca y consulta los resultados de tus evaluaciones."
        />
      </div>
    </section>
  </div>;
}

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof Upload;
  title: string;
  description: string;
}) {
  return <Link
    to={to}
    className="surface group flex min-w-0 items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
  >
    <span className="brand-soft grid size-11 shrink-0 place-items-center rounded-xl">
      <Icon aria-hidden="true" className="size-5" />
    </span>
    <span className="min-w-0">
      <strong className="block text-slate-900">{title}</strong>
      <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span>
    </span>
  </Link>;
}

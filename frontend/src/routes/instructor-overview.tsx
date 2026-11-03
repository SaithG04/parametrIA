import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  FileSearch,
  KeyRound,
  PanelsTopLeft,
  Users,
} from "lucide-react";
import { useInstructorStats } from "@/hooks/queries";
import { useSession } from "@/hooks/use-session";
import {
  DashboardBanner,
  DashboardSkeleton,
  EmptyState,
  PageHeading,
  RefreshButton,
  StatCard,
} from "@/routes/dashboard-shared";

export function InstructorOverviewPage() {
  const { user } = useSession();
  const statsQuery = useInstructorStats();
  const stats = statsQuery.data;

  return <div className="page-enter">
    <PageHeading
      eyebrow="Panel docente"
      title="Resumen"
      description="Consulta la actividad de tus cursos y accede rápidamente a la gestión académica."
    />
    <DashboardBanner
      icon={BookOpen}
      title={`Bienvenido, ${user?.name ?? "docente"}`}
      description="Aquí tienes un resumen actualizado de tus aulas, estudiantes y evaluaciones."
    />

    <section className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Actividad académica</h2>
          <p className="mt-1 text-sm text-slate-600">Métricas de tus cursos y aulas.</p>
        </div>
        <RefreshButton
          onClick={() => void statsQuery.refetch()}
          busy={statsQuery.isFetching}
          label="métricas"
        />
      </div>
      {statsQuery.isLoading
        ? <DashboardSkeleton rows={4} />
        : statsQuery.isError
          ? <EmptyState
              icon={Activity}
              title="No se pudieron cargar las métricas"
              description="Inténtalo de nuevo para consultar el resumen de actividad."
              action={{ label: "Reintentar", onClick: () => void statsQuery.refetch() }}
            />
          : stats && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Cursos" value={stats.courseCount} icon={BookOpen} />
              <StatCard label="Aulas" value={stats.classroomCount} icon={PanelsTopLeft} />
              <StatCard label="Estudiantes" value={stats.studentCount} icon={Users} />
              <StatCard label="Evaluaciones totales" value={stats.evaluationCount} icon={ClipboardCheck} />
              <StatCard label="Evaluaciones · últimos 7 días" value={stats.recentEvaluationCount} icon={Activity} />
              <StatCard label="Aulas con IA configurada" value={stats.configuredClassroomCount} icon={KeyRound} />
              <StatCard label="Evaluaciones en proceso" value={stats.activeJobCount} icon={ClipboardCheck} />
            </div>}
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900">Accesos rápidos</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink to="/app/instructor/courses" icon={BookOpen} title="Cursos" description="Organiza tus cursos y asignaturas." />
        <QuickLink to="/app/instructor/classrooms" icon={PanelsTopLeft} title="Aulas" description="Configura tus aulas y evaluaciones." />
        <QuickLink to="/app/instructor/students" icon={Users} title="Estudiantes" description="Gestiona matrículas y grupos." />
        <QuickLink to="/app/instructor/reports" icon={FileSearch} title="Auditar reportes" description="Revisa las evaluaciones de tus estudiantes." />
        <QuickLink to="/app/instructor/credentials" icon={KeyRound} title="Credenciales IA" description="Administra las credenciales de tus proveedores." />
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
  icon: typeof BookOpen;
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

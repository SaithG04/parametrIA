import { RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="mb-7">
    <p className="eyebrow">{eyebrow}</p>
    <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">{title}</h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
  </header>;
}

export function DashboardBanner({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return <section className="dashboard-banner">
    <span className="dashboard-banner-icon"><Icon aria-hidden="true" className="size-6" /></span>
    <div className="min-w-0">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  </section>;
}

export function DashboardSkeleton({ rows = 3 }: { rows?: number }) {
  return <div aria-label="Cargando contenido" className="space-y-3 py-2">
    {Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
      <div className="skeleton size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3 w-2/5 rounded" /><div className="skeleton h-3 w-3/5 rounded" /></div>
      <div className="skeleton h-9 w-20 rounded-lg" />
    </div>)}
  </div>;
}

export function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return <article className="surface flex items-center justify-between p-5 transition-shadow hover:shadow-lg">
    <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold text-slate-900">{value}</p></div>
    <span className="brand-soft grid size-11 place-items-center rounded-xl"><Icon className="size-5" /></span>
  </article>;
}

export function SkeletonTableRows({ columns }: { columns: number }) {
  return <>{[0, 1, 2].map((row) => <tr key={row} aria-hidden="true">
    {Array.from({ length: columns }, (_, column) => <td key={column}><span className="skeleton block h-3 rounded" /></td>)}
  </tr>)}</>;
}

export function roleLabel(role: string) {
  return role === "SUPERADMIN" ? "Superadministrador" : role === "INSTRUCTOR" ? "Docente" : "Estudiante";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return <section className="surface grid justify-items-center gap-3 px-6 py-12 text-center">
    <span className="brand-soft grid size-12 place-items-center rounded-2xl"><Icon className="size-6" /></span>
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <p className="max-w-lg text-sm leading-6 text-slate-500">{description}</p>
    {action && <Button variant="secondary" onClick={action.onClick}>{action.label}</Button>}
  </section>;
}

export function RefreshButton({
  onClick,
  busy = false,
  label,
}: {
  onClick: () => void;
  busy?: boolean;
  label: string;
}) {
  return <Button
    type="button"
    variant="secondary"
    size="sm"
    onClick={onClick}
    disabled={busy}
    aria-label={`Actualizar ${label}`}
    title={`Actualizar ${label}`}
  >
    <RefreshCw aria-hidden="true" className={`size-4 ${busy ? "animate-spin" : ""}`} />
    <span className="hidden sm:inline">{busy ? "Actualizando…" : "Actualizar"}</span>
  </Button>;
}

export function DashboardFrame({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

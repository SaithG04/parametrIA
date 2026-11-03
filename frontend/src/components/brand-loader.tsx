export function BrandLoader({ label = "Cargando ParametrIA…", compact = false }: { label?: string; compact?: boolean }) {
  return <span className={`brand-loader ${compact ? "brand-loader-compact" : ""}`} role="status" aria-live="polite">
    <img src="/images/parametria-mark.svg" alt="" className="brand-loader-mark" />
    <span>{label}</span>
  </span>;
}

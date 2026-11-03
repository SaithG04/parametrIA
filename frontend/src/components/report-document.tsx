import { BadgeCheck, Download, FileText } from "lucide-react";
import type { Report } from "@/services/types";
import { Button } from "@/components/ui/button";
import "./report-document.css";

function displayLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("es"));
}

function reportColumnWeight(key: string) {
  const normalized = key.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/(estado|status)/.test(normalized)) return 0.65;
  if (/(seccion|section)/.test(normalized)) return 0.8;
  if (/(criterio|criterion)/.test(normalized)) return 1.25;
  if (/(justificacion|justification)/.test(normalized)) return 1.35;
  if (/(evidencia|evidence)/.test(normalized)) return 1.15;
  return 1;
}

function ReportValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Sí" : "No"}</span>;
  if (typeof value === "string" || typeof value === "number") return <span className="whitespace-pre-wrap">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      const rows = value as Array<Record<string, unknown>>;
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const columnWeights = columns.map(reportColumnWeight);
      const totalColumnWeight = columnWeights.reduce((total, weight) => total + weight, 0);
      return <div className="table-wrap">
        <table className="report-data-table min-w-[34rem]">
          <colgroup>
            {columns.map((key, index) => (
              <col key={key} style={{ width: `${((columnWeights[index] ?? 1) / totalColumnWeight) * 100}%` }} />
            ))}
          </colgroup>
          <thead><tr>{columns.map((key) => <th key={key}>{displayLabel(key)}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((key) => <td key={key}><ReportValue value={row[key]} /></td>)}</tr>)}</tbody>
        </table>
      </div>;
    }
    return <ul className="grid gap-2 pl-5">{value.map((item, index) => <li key={index} className="list-disc"><ReportValue value={item} /></li>)}</ul>;
  }
  if (typeof value === "object") {
    return <div className="table-wrap">
      <table><tbody>{Object.entries(value).map(([key, item]) => <tr key={key}><th>{displayLabel(key)}</th><td><ReportValue value={item} /></td></tr>)}</tbody></table>
    </div>;
  }
  return <span>{String(value)}</span>;
}

export function ReportDocument({ report, studentName, fileName }: { report: Report; studentName: string; fileName: string }) {
  const entries = Object.entries(report).filter(([key]) => !["providerName", "model", "overallScore", "summary", "sections", "recommendations"].includes(key));
  const sections = Array.isArray(report.sections) ? report.sections : [];
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];

  return <article className="report-document mx-auto max-w-5xl" data-print-report>
    <header className="surface rounded-b-none p-5 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="brand-soft grid size-11 shrink-0 place-items-center rounded-xl"><FileText className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Reporte de evaluación</p>
          <h2 className="mt-1 break-words font-display text-2xl font-bold text-slate-900">{fileName}</h2>
          <p className="mt-1 text-sm text-slate-500">Estudiante: {studentName}</p>
        </div>
        {typeof report.overallScore === "number" && <div className="brand-soft rounded-xl px-4 py-2 text-center"><span className="block text-2xl font-bold">{report.overallScore}</span><span className="text-xs opacity-80">Puntaje</span></div>}
      </div>
      {typeof report.summary === "string" && report.summary && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{report.summary}</p>}
    </header>
    <div className="surface mt-4 grid gap-5 p-4 sm:p-7">
      {entries.map(([key, value]) => <section key={key} className="grid min-w-0 gap-2">
        <h3 className="text-base font-bold text-slate-900">{displayLabel(key)}</h3>
        <ReportValue value={value} />
      </section>)}
      {sections.map((section, index) => <section key={index} className="grid gap-2">
        <h3 className="text-base font-bold text-slate-900">{typeof section === "object" && section !== null && "name" in section ? String(section.name) : `Sección ${index + 1}`}</h3>
        <ReportValue value={section} />
      </section>)}
      {recommendations.length > 0 && <section className="grid gap-2">
        <h3 className="text-base font-bold text-slate-900">Recomendaciones</h3>
        <ReportValue value={recommendations} />
      </section>}
      {!entries.length && !sections.length && !recommendations.length && !report.summary && <p className="text-sm text-slate-500">El reporte no contiene campos para mostrar.</p>}
    </div>
    <footer className="surface mt-4 flex flex-wrap items-center gap-2 p-4 text-xs text-slate-500">
      <BadgeCheck className="size-4 text-emerald-700" />
      <span>Evaluado con {report.providerName || "ParametrIA"} · modelo {report.model || "no especificado"}.</span>
    </footer>
  </article>;
}

export function ReportPdfDownloadButton({ fileName }: { fileName: string }) {
  function printReport() {
    const previousTitle = document.title;
    const safeName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .trim()
      .slice(0, 100);
    document.title = safeName ? `ParametrIA - ${safeName}` : "ParametrIA - Informe de evaluación";
    try {
      window.print();
    } finally {
      document.title = previousTitle;
    }
  }

  return <Button
    type="button"
    className="report-download-action"
    aria-label="Descargar informe en PDF"
    title="En el diálogo de impresión, selecciona «Guardar como PDF»."
    onClick={printReport}
  >
    <Download aria-hidden="true" className="size-4" />
    Descargar PDF
  </Button>;
}

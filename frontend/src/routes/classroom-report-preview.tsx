import type { ReportSchemaChildDefinition, ReportSchemaFieldDefinition } from "@/services/types";

type ExampleField = ReportSchemaChildDefinition & { children?: ReportSchemaChildDefinition[] };

function exampleValue(field: ExampleField, index = 0): unknown {
  switch (field.type) {
    case "STRING": {
      const key = field.key.toLowerCase();
      if (key.includes("criterio")) return index === 0 ? "Coherencia entre objetivos y metodología" : "Sustento de las conclusiones";
      if (key.includes("justificacion") || key.includes("evidencia")) return "El documento relaciona el objetivo con el método en la sección de metodología (p. 12).";
      if (key.includes("pagina") || key.includes("ubicacion")) return "Página 12";
      if (key.includes("titulo")) return "Relación entre variables en el contexto estudiado";
      if (key.includes("autor")) return "Nombre del estudiante";
      return `Ejemplo de ${field.label.toLocaleLowerCase("es-CO")}, basado en el documento.`;
    }
    case "NUMBER":
      return index + 3;
    case "BOOLEAN":
      return index === 0;
    case "ENUM":
      return field.options?.[0] ?? "Opción configurada";
    case "ARRAY_OF_STRINGS":
      return [`Ejemplo de ${field.label.toLocaleLowerCase("es-CO")} basado en evidencia.`];
    case "OBJECT":
      return Object.fromEntries((field.children ?? []).map((child) => [child.key, exampleValue(child, index)]));
    case "ARRAY_OF_OBJECTS":
      return [0, 1].map((rowIndex) =>
        Object.fromEntries((field.children ?? []).map((child) => [child.key, exampleValue(child, rowIndex)])),
      );
  }
}

function ExampleOutput({ value, children }: { value: unknown; children?: ReportSchemaChildDefinition[] }) {
  if (Array.isArray(value) && value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    const records = value as Array<Record<string, unknown>>;
    const columns = children ?? [];
    return <div className="table-wrap">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead><tr>{columns.map((column) => <th key={column.key} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-600">{column.label}</th>)}</tr></thead>
        <tbody>{records.map((record, rowIndex) => <tr key={rowIndex} className="align-top even:bg-slate-50">
          {columns.map((column) => <td key={column.key} className="border-b border-slate-100 px-3 py-2 text-slate-700"><ExampleOutput value={record[column.key]} /></td>)}
        </tr>)}</tbody>
      </table>
    </div>;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const properties = children ?? [];
    return <div className="table-wrap">
      <table className="w-full min-w-[20rem] text-left text-sm"><tbody>{properties.map((property) => <tr key={property.key}>
        <th className="w-2/5 border-b border-slate-100 px-3 py-2 font-medium text-slate-500">{property.label}</th>
        <td className="border-b border-slate-100 px-3 py-2 text-slate-700"><ExampleOutput value={record[property.key]} /></td>
      </tr>)}</tbody></table>
    </div>;
  }
  if (Array.isArray(value)) {
    return <ul className="list-inside list-disc space-y-1">{value.map((item, index) => <li key={index}>{String(item)}</li>)}</ul>;
  }
  if (typeof value === "boolean") return <span>{value ? "Sí" : "No"}</span>;
  return <span>{String(value ?? "—")}</span>;
}

export function ClassroomReportPreview({ field }: { field: ReportSchemaFieldDefinition }) {
  return <ExampleOutput value={exampleValue(field)} children={field.children ?? []} />;
}

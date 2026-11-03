import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Pencil, Plus, Shapes } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSelect } from "@/components/ui/form-select";
import { useReportSchemaFields, useSaveReportSchemaField, useSetReportSchemaFieldStatus } from "@/hooks/queries";
import type { ReportFieldType, ReportSchemaChildDefinition, ReportSchemaField } from "@/services/types";
import type { ReportSchemaFieldInput } from "@/services/endpoints";
import { DashboardSkeleton, EmptyState, RefreshButton } from "./dashboard-shared";

const fieldTypeOptions: Array<{ value: ReportFieldType; label: string }> = [
  { value: "STRING", label: "Texto" },
  { value: "NUMBER", label: "Número" },
  { value: "BOOLEAN", label: "Sí / No" },
  { value: "ENUM", label: "Lista de opciones" },
  { value: "ARRAY_OF_STRINGS", label: "Lista de textos" },
  { value: "OBJECT", label: "Objeto con propiedades" },
  { value: "ARRAY_OF_OBJECTS", label: "Lista de objetos" },
];
const fieldTypes = new Set<string>(fieldTypeOptions.map((option) => option.value));

function isReportFieldType(value: string): value is ReportFieldType {
  return fieldTypes.has(value);
}

type ChildField = ReportSchemaChildDefinition;

function FieldFormDialog({
  field,
  open,
  onOpenChange,
}: {
  field: ReportSchemaField | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveReportSchemaField(field?.id);
  const [key, setKey] = useState(field?.key ?? "");
  const [label, setLabel] = useState(field?.label ?? "");
  const [type, setType] = useState<ReportFieldType>(field?.type ?? "STRING");
  const [description, setDescription] = useState(field?.description ?? "");
  const [options, setOptions] = useState(field?.options?.join(", ") ?? "");
  const [required, setRequired] = useState(field?.isRequired ?? true);
  const [children, setChildren] = useState<ChildField[]>(field?.children ?? []);

  function updateChild(index: number, patch: Partial<ChildField>) {
    setChildren((current) => current.map((child, childIndex) => childIndex === index ? { ...child, ...patch } : child));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedOptions = options.split(",").map((option) => option.trim()).filter(Boolean);
    const childFields = children.filter((child) => child.key.trim() && child.label.trim() && child.description.trim());
    const input: ReportSchemaFieldInput = {
      key: key.trim(),
      label: label.trim(),
      type,
      description: description.trim(),
      isRequired: required,
      ...(type === "ENUM" ? { options: parsedOptions } : {}),
      ...((type === "OBJECT" || type === "ARRAY_OF_OBJECTS") ? { children: childFields } : {}),
      ...(field ? { sortOrder: field.sortOrder, isActive: field.isActive } : {}),
    };
    save.mutate(input, { onSuccess: () => onOpenChange(false) });
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl bg-white p-5 sm:p-6">
      <DialogHeader>
        <DialogTitle>{field ? "Editar campo del reporte" : "Agregar campo al reporte"}</DialogTitle>
        <DialogDescription>Define qué información debe producir la IA. La clave será el nombre de la propiedad en el JSON.</DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">Nombre visible<input required maxLength={100} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Bibliografía faltante" /></label>
          <label className="field">Clave JSON<input required pattern="[a-z][a-z0-9_]*" maxLength={80} value={key} onChange={(event) => setKey(event.target.value)} placeholder="bibliografia_faltante" /><span className="text-xs font-normal text-slate-500">Minúsculas, números y guion bajo; comienza con una letra. No se admiten las claves reservadas del visor (summary, sections, recommendations, providerName, model, overallScore).</span></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">Tipo de dato<FormSelect value={type} options={fieldTypeOptions} onValueChange={(value) => { if (isReportFieldType(value)) setType(value); }} /></label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
            Campo obligatorio en el reporte
          </label>
        </div>
        <label className="field">Instrucción para la IA<textarea required maxLength={1000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe qué debe incluir este campo y en qué evidencia basarse." /></label>
        {type === "ENUM" && <label className="field">Opciones permitidas<input required value={options} onChange={(event) => setOptions(event.target.value)} placeholder="CUMPLE, NO CUMPLE, PARCIAL" /><span className="text-xs font-normal text-slate-500">Separa las opciones con comas.</span></label>}
        {(type === "OBJECT" || type === "ARRAY_OF_OBJECTS") && <section className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-sm font-semibold">Propiedades internas</h3><p className="text-xs text-slate-500">{type === "OBJECT" ? "El JSON contendrá un objeto con estas propiedades." : "Cada elemento de la lista tendrá estas propiedades."}</p></div>
            <button type="button" className="action secondary px-3 py-2" onClick={() => setChildren((current) => [...current, { key: "", label: "", type: "STRING", description: "" }])}><Plus className="size-4" />Agregar propiedad</button>
          </div>
          {children.map((child, index) => <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
            <label className="field">Nombre visible<input required value={child.label} onChange={(event) => updateChild(index, { label: event.target.value })} /></label>
            <label className="field">Clave<input required pattern="[a-z][a-z0-9_]*" value={child.key} onChange={(event) => updateChild(index, { key: event.target.value })} /></label>
            <label className="field">Tipo<FormSelect value={child.type} options={fieldTypeOptions.filter((option) => option.value !== "OBJECT" && option.value !== "ARRAY_OF_OBJECTS")} onValueChange={(value) => {
              if (!isReportFieldType(value)) return;
              if (value === "ENUM") updateChild(index, { type: value, options: [] });
              else {
                const { options: _options, ...childWithoutOptions } = child;
                updateChild(index, { ...childWithoutOptions, type: value });
              }
            }} /></label>
            <label className="field">Instrucción<textarea required rows={2} value={child.description} onChange={(event) => updateChild(index, { description: event.target.value })} /></label>
            {child.type === "ENUM" && <label className="field sm:col-span-2">Opciones<input required value={child.options?.join(", ") ?? ""} onChange={(event) => updateChild(index, { options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })} placeholder="Completa, Incompleta" /></label>}
            <button type="button" className="justify-self-start text-xs font-medium text-rose-700 hover:underline sm:col-span-2" onClick={() => setChildren((current) => current.filter((_, childIndex) => childIndex !== index))}>Quitar propiedad</button>
          </div>)}
          {!children.length && <p className="text-sm text-rose-700">Agrega al menos una propiedad para completar este tipo de dato.</p>}
        </section>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="action secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button className="action" disabled={save.isPending || ((type === "OBJECT" || type === "ARRAY_OF_OBJECTS") && !children.length)}>{save.isPending ? "Guardando…" : field ? "Guardar cambios" : "Agregar campo"}</button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

export function ReportSchemaManager() {
  const fieldsQuery = useReportSchemaFields();
  const setStatus = useSetReportSchemaFieldStatus();
  const fields = fieldsQuery.data ?? [];
  const [editing, setEditing] = useState<ReportSchemaField | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  return <section className="surface p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Campos del reporte de evaluación</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Configura la estructura del JSON que generará la IA para todas las evaluaciones nuevas. Los informes ya generados no se modifican.</p></div>
      <div className="flex gap-2"><RefreshButton onClick={() => void fieldsQuery.refetch()} busy={fieldsQuery.isFetching} label="campos del reporte" /><button className="action" onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="size-4" />Agregar campo</button></div>
    </div>
    {fieldsQuery.isLoading
      ? <DashboardSkeleton rows={3} />
      : fieldsQuery.isError
        ? <EmptyState icon={Shapes} title="No se pudieron cargar los campos" description="Intenta actualizar la lista. Si el problema continúa, consulta al administrador del sistema." action={{ label: "Actualizar", onClick: () => void fieldsQuery.refetch() }} />
        : fields.length
          ? <div className="grid gap-3 md:grid-cols-2">{fields.map((field) => <article key={field.id} className={`rounded-xl border p-4 ${field.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{field.label}</h3><span className="brand-soft rounded-full px-2 py-0.5 text-xs">{field.type}</span>{!field.isRequired && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Opcional</span>}</div><code className="mt-1 block text-xs text-slate-500">{field.key}</code></div>
                <div className="flex gap-2">
                  <button type="button" className="action secondary px-3 py-2" onClick={() => { setEditing(field); setFormOpen(true); }} aria-label={`Editar ${field.label}`}><Pencil className="size-4" /></button>
                  <button type="button" className="action secondary px-3 py-2" onClick={() => setStatus.mutate({ id: field.id, isActive: !field.isActive })} disabled={setStatus.isPending} aria-label={`${field.isActive ? "Desactivar" : "Activar"} ${field.label}`}>
                    {field.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-600">{field.description}</p>
              {!!field.options?.length && <p className="mt-2 text-xs text-slate-500">Opciones: {field.options.join(" · ")}</p>}
              {!!field.children?.length && <p className="mt-2 text-xs text-slate-500">Propiedades: {field.children.map((child) => child.label).join(" · ")}</p>}
            </article>)}</div>
          : <EmptyState icon={Shapes} title="Aún no hay campos configurados" description="Agrega los campos que la IA debe generar en sus informes." />}
    <FieldFormDialog key={editing?.id ?? "new-report-field"} field={editing} open={formOpen} onOpenChange={setFormOpen} />
  </section>;
}

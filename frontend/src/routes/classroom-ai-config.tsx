import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Settings2 } from "lucide-react";
import { DropZone } from "@/components/dropzone";
import { PromptPillEditor } from "@/components/prompt-pill-editor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSelect } from "@/components/ui/form-select";
import { useActiveReportSchemaFields, useClassroom, useInstructorCredentials, useProviderModels, useProviders, useSaveAiConfig } from "@/hooks/queries";
import { ClassroomReportPreview } from "@/routes/classroom-report-preview";
import { EmptyState, DashboardSkeleton, PageHeading } from "./dashboard-shared";

const ADD_CREDENTIAL = "__add_credential__";
const promptExample = `Evalúa el documento de investigación siguiendo los criterios y ponderaciones de la rúbrica configurada para esta aula. Basa cada observación en evidencia que aparezca en el documento; no inventes datos, resultados ni fuentes. Si falta información para valorar un criterio, indícalo claramente y explica qué debería incluir el estudiante.

Entrega comentarios respetuosos, específicos y útiles. Para cada criterio, explica qué evidencia encontraste y por qué cumple o qué necesita mejorar. Cierra destacando fortalezas y los pasos prioritarios para mejorar el trabajo.`;

export function ClassroomAiConfigPage() {
  const { classroomId = "" } = useParams();
  const navigate = useNavigate();
  const classroomQuery = useClassroom(classroomId);
  const classroom = classroomQuery.data;
  const { data: providerResult, isLoading: providersLoading } = useProviders(1, 100, "", Boolean(classroomId));
  const credentialsQuery = useInstructorCredentials(Boolean(classroomId));
  const reportFieldsQuery = useActiveReportSchemaFields(Boolean(classroomId));
  const saveConfig = useSaveAiConfig(classroomId);
  const providers = providerResult?.items ?? [];
  const credentials = credentialsQuery.data ?? [];
  const reportFields = reportFieldsQuery.data ?? [];
  const [providerId, setProviderId] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedReportFields, setSelectedReportFields] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [dailyLimit, setDailyLimit] = useState("2");
  const [promptExampleOpen, setPromptExampleOpen] = useState(false);
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const providerModelsQuery = useProviderModels(providerId, credentialId, Boolean(classroomId));
  const providerModels = providerModelsQuery.data ?? [];

  useEffect(() => {
    if (!classroom) return;
    setProviderId(classroom.config.providerId);
    setCredentialId(classroom.config.credentialId);
    setSelectedModels(classroom.config.selectedModels);
    setSelectedReportFields(classroom.config.selectedReportFields.length
      ? classroom.config.selectedReportFields.filter((key) => reportFields.some((field) => field.key === key))
      : reportFields.map((field) => field.key));
    setUserPrompt(classroom.config.userPrompt);
    setRubricText(classroom.config.rubricText);
    setDailyLimit(String(classroom.config.dailyLimit));
  }, [classroom, reportFields]);

  useEffect(() => {
    if (!providerModelsQuery.data) return;
    setSelectedModels((current) => current.filter((model) => providerModelsQuery.data.includes(model)));
  }, [providerModelsQuery.data]);

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveConfig.mutate({
      providerId,
      credentialId,
      selectedModels,
      selectedReportFields,
      userPrompt: userPrompt.trim(),
      rubricText,
      dailyLimit: Math.max(1, Number(dailyLimit) || 1),
    }, { onSuccess: () => navigate("/app/instructor", { replace: true }) });
  }

  function chooseCredential(value: string) {
    if (value === ADD_CREDENTIAL) {
      navigate("/app/instructor/credentials");
      return;
    }
    setCredentialId(value);
  }

  const previewFields = reportFields.filter((field) => selectedReportFields.includes(field.key));
  const promptPills = previewFields.flatMap((field) => [
    { key: field.key, label: field.label, description: field.description },
    ...(field.children ?? []).map((child) => ({
      key: `${field.key}.${child.key}`,
      label: child.label,
      description: child.description,
    })),
  ]);

  return <div className="page-enter">
    <button
      type="button"
      className="action secondary mb-5"
      onClick={() => navigate("/app/instructor/courses")}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Volver a cursos y aulas
    </button>

    {classroomQuery.isLoading
      ? <DashboardSkeleton rows={2} />
      : classroomQuery.isError || !classroom
        ? <EmptyState
            icon={Settings2}
            title="No se pudo cargar el aula"
            description="Verifica que el aula siga disponible e inténtalo nuevamente."
            action={{ label: "Volver a aulas", onClick: () => navigate("/app/instructor/courses") }}
          />
        : <>
            <PageHeading
              eyebrow="Configuración del aula"
              title="Configuración de IA"
              description={`${classroom.courseName} · ${classroom.name}. Define cómo se evaluarán los documentos del aula.`}
            />
            <form className="surface grid gap-5 p-4 sm:p-6" onSubmit={saveSettings}>
              <p className="text-sm text-slate-500">Las claves se administran por separado en Credenciales IA; aquí eliges cuál utilizar.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="field">
                  Proveedor de IA
                  <FormSelect
                    required
                    value={providerId}
                    placeholder="Selecciona un proveedor"
                    options={providers.map((provider) => ({ value: provider.id, label: provider.name }))}
                    onValueChange={(value) => {
                      setProviderId(value);
                      setCredentialId("");
                      setSelectedModels([]);
                    }}
                  />
                  {providersLoading && <span className="text-xs font-normal text-slate-500">Cargando proveedores…</span>}
                </label>
                <label className="field">
                  Credencial para este proveedor
                  <FormSelect
                    required
                    value={credentialId}
                    placeholder="Selecciona una credencial"
                    options={[
                      ...credentials.filter((credential) => credential.providerId === providerId)
                        .map((credential) => ({ value: credential.id, label: credential.name })),
                      { value: ADD_CREDENTIAL, label: "Agregar credencial…" },
                    ]}
                    onValueChange={chooseCredential}
                  />
                  <span className="text-xs font-normal text-slate-500">La opción para agregar te lleva a la administración de tus credenciales.</span>
                </label>
              </div>

              {providerId && credentialId && <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold">Modelos disponibles para esta credencial</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {providerModels.map((model) => (
                    <label key={model} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model)}
                        onChange={(event) => setSelectedModels((current) => event.target.checked
                          ? [...current, model]
                          : current.filter((entry) => entry !== model))}
                      />
                      {model}
                    </label>
                  ))}
                </div>
                {providerModelsQuery.isLoading
                  ? <p className="mt-2 text-xs text-slate-500">Consultando modelos con la credencial seleccionada…</p>
                  : providerModelsQuery.isError
                    ? <p role="alert" className="mt-2 text-xs text-rose-700">No se pudieron consultar los modelos. Verifica la credencial y el endpoint del proveedor.</p>
                    : providerModels.length
                      ? <p className="mt-2 text-xs text-slate-500">La lista proviene del proveedor. Las evaluaciones rotan entre los modelos que selecciones.</p>
                      : <p className="mt-2 text-xs text-slate-500">La credencial no tiene modelos disponibles.</p>}
              </fieldset>}

              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold">Qué incluir en el reporte</legend>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-2xl text-xs leading-5 text-slate-500">
                    Cada botón activa o excluye un bloque completo del informe. Los campos y su formato los define el administrador; aquí decides cuáles aplicar a esta aula.
                  </p>
                  <button
                    type="button"
                    className="action secondary shrink-0 px-3 py-2"
                    disabled={!reportFields.length}
                    onClick={() => setReportPreviewOpen(true)}
                  >
                    <Eye aria-hidden="true" className="size-4" />
                    Ver ejemplo de salida
                  </button>
                </div>
                {reportFieldsQuery.isLoading
                  ? <p className="text-sm text-slate-500">Cargando contenido del reporte…</p>
                  : reportFieldsQuery.isError
                    ? <p className="text-sm text-rose-700">No se pudo cargar el contenido del reporte. Actualiza la página e inténtalo de nuevo.</p>
                    : reportFields.length
                      ? <div className="flex flex-wrap gap-2">
                          {reportFields.map((field) => {
                            const isSelected = selectedReportFields.includes(field.key);
                            return <button
                              key={field.id}
                              type="button"
                              aria-pressed={isSelected}
                              title={field.description}
                              disabled={isSelected && selectedReportFields.length === 1}
                              onClick={() => setSelectedReportFields((current) => isSelected
                                ? current.filter((key) => key !== field.key)
                                : [...current, field.key])}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isSelected
                                ? "brand-soft brand-border"
                                : "brand-border-hover border-slate-200 bg-white text-slate-600"}`}
                            >
                              {field.label}
                            </button>;
                          })}
                        </div>
                      : <p className="text-sm text-slate-500">El administrador todavía no ha configurado campos para los reportes.</p>}
                {reportFields.length > 0 && <p className="mt-3 text-xs text-slate-500">
                  Debe quedar al menos un bloque activo. La vista previa muestra los bloques seleccionados ahora; guarda la configuración para aplicar los cambios.
                </p>}
              </fieldset>

              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="field" htmlFor="evaluation-instructions">Instrucciones de evaluación</label>
                  <button type="button" className="action secondary px-3 py-2" onClick={() => setPromptExampleOpen(true)}>
                    <Eye aria-hidden="true" className="size-4" />
                    Ver ejemplo
                  </button>
                </div>
                <PromptPillEditor
                  id="evaluation-instructions"
                  value={userPrompt}
                  pills={promptPills}
                  onChange={setUserPrompt}
                  placeholder="Describe el enfoque, tono y criterios que debe seguir el evaluador."
                />
                {reportFields.length > 0 && <>
                  <p className="text-xs text-slate-500">
                    Los campos se muestran como etiquetas legibles en el editor y se guardan como referencias al esquema. El backend las resuelve al generar el informe.
                  </p>
                </>}
                <p className="text-xs font-normal leading-5 text-slate-500">
                  El estudiante subirá su documento original en Word (.docx). Antes de enviarlo a la IA, el sistema lo convertirá a Markdown para facilitar su procesamiento. El texto se conservará cuando sea posible, pero el formato visual y algunos elementos complejos pueden cambiar o perderse. Las imágenes no se enviarán ni serán analizadas: en su lugar aparecerá un indicador como [IMAGEN: descripción] (o [IMAGEN: sin descripción]). Indica aquí cómo debe tratar el evaluador esos indicadores y evita pedirle que interprete el contenido visual.
                </p>
                <p className="text-xs font-normal leading-5 text-slate-500">
                  No pidas al estudiante que genere ni adjunte archivos de salida. ParametrIA producirá automáticamente el reporte con los campos definidos por el administrador; usa estas instrucciones para orientar la evaluación, no para cambiar la estructura del reporte.
                </p>
              </div>

              <div className="grid items-start gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Rúbrica del curso</p>
                  <DropZone
                    accept=".md,text/markdown,text/plain"
                    label="Sube una rúbrica .md"
                    hint="Arrastra el archivo o haz clic · Markdown (.md)"
                    fileName={rubricText ? "Rúbrica Markdown cargada" : null}
                    onFile={(file) => {
                      if (file.name.toLowerCase().endsWith(".md")) void file.text().then(setRubricText);
                    }}
                  />
                  <textarea
                    className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
                    aria-label="Contenido de la rúbrica"
                    placeholder="O pega aquí el contenido de la rúbrica."
                    value={rubricText}
                    onChange={(event) => setRubricText(event.target.value)}
                  />
                </div>
                <label className="field">
                  Límite diario por alumno
                  <input type="number" min="1" max="100" required value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} />
                  <span className="text-xs font-normal text-slate-500">Evaluaciones diarias antes de solicitar una clave propia al estudiante.</span>
                </label>
              </div>
              <div>
                <button className="action" disabled={saveConfig.isPending || !providerId || !credentialId || !selectedModels.length}>
                  {saveConfig.isPending ? "Guardando…" : "Guardar configuración"}
                </button>
              </div>
            </form>
            <Dialog open={reportPreviewOpen} onOpenChange={setReportPreviewOpen}>
              <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl rounded-2xl bg-white p-5 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Ejemplo de cómo verá el reporte el estudiante</DialogTitle>
                  <DialogDescription>
                    La tabla se construye con los campos que el administrador configuró y que están activos para esta aula. El contenido es ilustrativo; la IA lo completará con la rúbrica y el documento real.
                  </DialogDescription>
                </DialogHeader>
                {previewFields.length
                  ? <div className="table-wrap max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-[36rem] text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr>
                            <th className="w-1/4 border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">Bloque del reporte</th>
                            <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">Ejemplo de contenido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewFields.map((field) => (
                            <tr key={field.id} className="align-top even:bg-slate-50/60">
                              <th className="border-b border-slate-100 px-4 py-4 font-semibold text-slate-800">
                                <span className="block">{field.label}</span>
                                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{field.description}</span>
                              </th>
                              <td className="border-b border-slate-100 px-4 py-4 text-slate-700">
                                <ClassroomReportPreview field={field} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                      Activa al menos un bloque para ver un ejemplo del reporte final.
                    </div>}
                <div className="flex justify-end">
                  <button type="button" className="action secondary" onClick={() => setReportPreviewOpen(false)}>Cerrar ejemplo</button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={promptExampleOpen} onOpenChange={setPromptExampleOpen}>
              <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl bg-white p-5 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Ejemplo de instrucciones de evaluación</DialogTitle>
                  <DialogDescription>
                    Puedes adaptarlo a la rúbrica del aula. Al usarlo, reemplazará las instrucciones actuales; después podrás editarlo.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {promptExample}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="action secondary" onClick={() => setPromptExampleOpen(false)}>Cerrar</button>
                  <button type="button" className="action" onClick={() => { setUserPrompt(promptExample); setPromptExampleOpen(false); }}>
                    Usar este ejemplo
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </>}
  </div>;
}

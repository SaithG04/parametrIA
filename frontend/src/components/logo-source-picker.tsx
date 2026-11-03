import { useRef, useState } from "react";
import { Check, ImageUp, Link2, Upload } from "lucide-react";

export type LogoSource = "url" | "upload";

export function LogoSourcePicker({
  idPrefix,
  url,
  uploadedUrl,
  source,
  onUrlChange,
  onSourceChange,
  onUpload,
  isUploading,
  uploadError,
  urlError,
}: {
  idPrefix: string;
  url: string;
  uploadedUrl: string;
  source: LogoSource;
  onUrlChange: (url: string) => void;
  onSourceChange: (source: LogoSource) => void;
  onUpload: (file: File | undefined) => void;
  isUploading: boolean;
  uploadError: string;
  urlError?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const previewUrl = source === "upload" ? uploadedUrl : url;

  return <fieldset className="grid gap-3 border-0 p-0">
    <legend className="text-sm font-semibold text-slate-700">Imagen del logo</legend>
    <div role="group" className="grid gap-2 sm:grid-cols-2" aria-label="Elige el origen de la imagen">
      <button
        type="button"
        aria-pressed={source === "url"}
        onClick={() => onSourceChange("url")}
        className={`logo-source-card ${source === "url" ? "is-selected" : ""}`}
      >
        <span className="logo-source-icon"><Link2 aria-hidden="true" className="size-4" /></span>
        <span className="min-w-0 flex-1 text-left"><strong>URL de Internet</strong><small>Pegar un enlace público</small></span>
        {source === "url" && <Check aria-hidden="true" className="logo-source-check size-4" />}
      </button>
      <button
        type="button"
        aria-pressed={source === "upload"}
        onClick={() => onSourceChange("upload")}
        className={`logo-source-card ${source === "upload" ? "is-selected" : ""}`}
      >
        <span className="logo-source-icon"><ImageUp aria-hidden="true" className="size-4" /></span>
        <span className="min-w-0 flex-1 text-left"><strong>Subir imagen</strong><small>Elegir un archivo del dispositivo</small></span>
        {source === "upload" && <Check aria-hidden="true" className="logo-source-check size-4" />}
      </button>
    </div>

    {source === "url" ? <label className="field">
      URL pública de la imagen
      <input
        id={`${idPrefix}-url`}
        type="url"
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        placeholder="https://ejemplo.com/logo.png"
        aria-invalid={Boolean(urlError)}
        aria-describedby={urlError ? `${idPrefix}-url-error` : undefined}
      />
      {urlError && <span id={`${idPrefix}-url-error`} role="alert" className="text-sm font-normal text-rose-700">{urlError}</span>}
      <span className="text-xs font-normal text-slate-500">Debe ser accesible públicamente desde Internet.</span>
    </label> : <div className="grid gap-2">
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Selecciona una imagen de logo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setFileName(file.name);
          onUpload(file);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="action secondary" onClick={() => fileInput.current?.click()} disabled={isUploading}>
          <Upload aria-hidden="true" className="size-4" />{isUploading ? "Subiendo imagen…" : uploadedUrl ? "Cambiar imagen" : "Elegir imagen"}
        </button>
        <span className="min-w-0 text-sm text-slate-600">{fileName || (uploadedUrl ? "Logo cargado" : "Aún no seleccionas una imagen")}</span>
      </div>
      <span className="text-xs text-slate-500">JPG, PNG o WebP · máximo 2 MB.</span>
      {uploadError && <p role="alert" className="text-sm text-rose-700">{uploadError}</p>}
    </div>}

    {previewUrl && <img src={previewUrl} alt="Vista previa del logo seleccionado" className="size-16 rounded-xl border border-slate-200 bg-white object-contain p-1" />}
  </fieldset>;
}

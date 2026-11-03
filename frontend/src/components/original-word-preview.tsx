import { useEffect, useRef, useState } from "react";

export function OriginalWordPreview({ file }: { file: File }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setError("");
    setLoading(true);
    const renderTarget = document.createElement("div");
    void import("docx-preview")
      .then(({ renderAsync }) => renderAsync(file, renderTarget, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: true,
      }))
      .then(() => {
        if (active) container.replaceChildren(...renderTarget.childNodes);
      })
      .catch(() => {
        if (active) setError("No se pudo interpretar el Word original. Puedes revisar el texto convertido en la vista previa.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; container.replaceChildren(); };
  }, [file]);

  return (
    <div className="max-h-[38rem] overflow-auto rounded-lg bg-slate-50 p-2">
      {error && <p role="alert" className="mb-2 text-sm text-rose-700">{error}</p>}
      {loading && <p className="mb-2 text-sm text-slate-500">Cargando vista del documento Word…</p>}
      <div ref={containerRef} className="docx-preview min-h-24" />
    </div>
  );
}

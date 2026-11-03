import { useCallback, useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function DropZone({
  accept,
  hint,
  label,
  fileName,
  onFile,
  className,
}: {
  accept: string;
  hint: string;
  label: string;
  fileName?: string | null;
  onFile: (file: File) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/40 px-6 py-10 text-center transition-colors",
        "hover:border-ring/60 hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring",
        dragging && "border-ring bg-accent/20",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <UploadCloud className="size-5" />
      </div>
      {fileName ? (
        <p className="text-sm font-medium text-foreground">{fileName}</p>
      ) : (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

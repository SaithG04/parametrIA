import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageResult } from "@/services/types";
import { FormSelect } from "@/components/ui/form-select";

export function PaginationControls<T>({
  result,
  onPageChange,
  onPageSizeChange,
}: {
  result: PageResult<T> | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (!result) return null;
  const { page, pageSize, total, totalPages } = result.pagination;
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
    <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}` : "Sin resultados"}</span>
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2">Filas
        <FormSelect
          aria-label="Filas por página"
          className="h-9 w-[5.5rem]"
          value={String(pageSize)}
          onValueChange={(size) => onPageSizeChange(Number(size))}
          options={[10, 25, 50, 100].map((size) => ({ value: String(size), label: String(size) }))}
        />
      </label>
      <button type="button" className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" /></button>
      <span>{page} / {Math.max(totalPages, 1)}</span>
      <button type="button" className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="size-4" /></button>
    </div>
  </div>;
}

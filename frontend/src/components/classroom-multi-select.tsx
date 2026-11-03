import { useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SelectableClassroom {
  id: string;
  name: string;
  code: string;
  courseName?: string;
}

export function ClassroomMultiSelect({
  classrooms,
  selectedIds,
  onChange,
  legend,
}: {
  classrooms: SelectableClassroom[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  legend: string;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const visibleClassrooms = classrooms.filter((classroom) =>
    `${classroom.courseName ?? ""} ${classroom.name} ${classroom.code}`
      .toLocaleLowerCase("es")
      .includes(normalizedSearch),
  );
  const selectedClassrooms = classrooms.filter((classroom) => selectedIds.includes(classroom.id));
  const visibleIds = new Set(visibleClassrooms.map((classroom) => classroom.id));

  function toggle(classroomId: string, checked: boolean) {
    onChange(
      checked
        ? [...new Set([...selectedIds, classroomId])]
        : selectedIds.filter((id) => id !== classroomId),
    );
  }

  function toggleVisible() {
    const allVisibleSelected = visibleClassrooms.every((classroom) => selectedIds.includes(classroom.id));
    onChange(
      allVisibleSelected
        ? selectedIds.filter((id) => !visibleIds.has(id))
        : [...new Set([...selectedIds, ...visibleClassrooms.map((classroom) => classroom.id)])],
    );
  }

  return (
    <fieldset className="classroom-multi-select">
      <legend>{legend}</legend>
      <div className="classroom-multi-select-summary">
        <span>{selectedIds.length ? `${selectedIds.length} aula${selectedIds.length === 1 ? "" : "s"} seleccionada${selectedIds.length === 1 ? "" : "s"}` : "Ninguna aula seleccionada"}</span>
        <button type="button" onClick={() => onChange([])} disabled={!selectedIds.length}>
          <X aria-hidden="true" className="size-3.5" />Limpiar
        </button>
      </div>
      {selectedClassrooms.length > 0 && (
        <ul className="classroom-multi-select-chips" aria-label="Aulas seleccionadas">
          {selectedClassrooms.map((classroom) => (
            <li key={classroom.id}>
              <span>{classroom.courseName ? `${classroom.courseName} · ` : ""}{classroom.name}</span>
              <button type="button" aria-label={`Quitar ${classroom.name}`} onClick={() => toggle(classroom.id, false)}>
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="classroom-multi-select-search">
        <Search aria-hidden="true" className="size-4" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por curso, aula o código"
          aria-label="Buscar aulas para asignar"
        />
        <ChevronDown aria-hidden="true" className="size-4 rotate-180 text-slate-400" />
      </label>
      <div className="classroom-multi-select-actions">
        <span>{visibleClassrooms.length} de {classrooms.length} aulas</span>
        <button type="button" onClick={toggleVisible} disabled={!visibleClassrooms.length}>
          <Check aria-hidden="true" className="size-3.5" />{visibleClassrooms.every((classroom) => selectedIds.includes(classroom.id)) ? "Quitar visibles" : "Seleccionar visibles"}
        </button>
      </div>
      <div className="classroom-multi-select-options">
        {visibleClassrooms.length ? visibleClassrooms.map((classroom) => (
          <label key={classroom.id} className="classroom-multi-select-option">
            <input
              type="checkbox"
              checked={selectedIds.includes(classroom.id)}
              onChange={(event) => toggle(classroom.id, event.target.checked)}
            />
            <span className="min-w-0">
              <strong>{classroom.name}</strong>
              <small>{classroom.courseName ? `${classroom.courseName} · ` : ""}Código {classroom.code}</small>
            </span>
          </label>
        )) : (
          <p className="px-3 py-5 text-center text-sm text-slate-500">No encontramos aulas con esa búsqueda.</p>
        )}
      </div>
    </fieldset>
  );
}

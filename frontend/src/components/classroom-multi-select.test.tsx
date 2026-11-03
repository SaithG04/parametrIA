import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassroomMultiSelect } from "@/components/classroom-multi-select";

const classrooms = [
  { id: "class-1", name: "Aula A", code: "A-101", courseName: "Metodología" },
  { id: "class-2", name: "Aula B", code: "B-202", courseName: "Tesis II" },
];

describe("ClassroomMultiSelect", () => {
  it("filters classrooms and selects all visible results without changing hidden selections", () => {
    const onChange = vi.fn();
    render(
      <ClassroomMultiSelect
        classrooms={classrooms}
        selectedIds={["class-2"]}
        onChange={onChange}
        legend="Aulas"
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar aulas para asignar" }), {
      target: { value: "metodología" },
    });

    expect(screen.getByText("Aula A")).toBeInTheDocument();
    expect(screen.queryByText("Aula B")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar visibles" }));

    expect(onChange).toHaveBeenCalledWith(["class-2", "class-1"]);
  });

  it("allows removing an individual selected classroom", () => {
    const onChange = vi.fn();
    render(
      <ClassroomMultiSelect
        classrooms={classrooms}
        selectedIds={["class-1", "class-2"]}
        onChange={onChange}
        legend="Aulas"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quitar Aula A" }));

    expect(onChange).toHaveBeenCalledWith(["class-2"]);
  });
});

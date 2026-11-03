import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptPillEditor } from "@/components/prompt-pill-editor";

describe("PromptPillEditor", () => {
  const pills = [{
    key: "ficha.objetivo_general",
    label: "Objetivo general",
    description: "Objetivo principal del documento.",
  }];

  it("renders stored field references as readable pills instead of template syntax", () => {
    render(
      <PromptPillEditor
        id="prompt"
        value="Evalúa {{field:ficha.objetivo_general}} con evidencia."
        pills={pills}
        onChange={vi.fn()}
        placeholder="Instrucciones"
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Instrucciones de evaluación" });
    expect(editor).toHaveTextContent("Objetivo general");
    expect(editor).not.toHaveTextContent("{{field:ficha.objetivo_general}}");
  });

  it("serializes an inserted pill back to the backend template", () => {
    const onChange = vi.fn();
    render(
      <PromptPillEditor
        id="prompt"
        value="Evalúa el documento."
        pills={pills}
        onChange={onChange}
        placeholder="Instrucciones"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "+ Objetivo general" }));
    expect(onChange).toHaveBeenLastCalledWith("Evalúa el documento.{{field:ficha.objetivo_general}} ");
  });
});

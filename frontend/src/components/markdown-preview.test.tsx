import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "@/components/markdown-preview";

describe("MarkdownPreview", () => {
  it("renders headings, emphasis, lists, and tables as formatted content", () => {
    render(<MarkdownPreview source={"# Objetivos\n\nTexto **importante**.\n\n- Primero\n- Segundo\n\n| Criterio | Resultado |\n| --- | --- |\n| Método | Correcto |"} />);

    expect(screen.getByRole("heading", { name: "Objetivos" })).toBeInTheDocument();
    expect(screen.getByText("importante").tagName).toBe("STRONG");
    expect(screen.getByText("Primero").tagName).toBe("LI");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Correcto")).toBeInTheDocument();
    expect(screen.queryByText("# Objetivos")).not.toBeInTheDocument();
  });
});

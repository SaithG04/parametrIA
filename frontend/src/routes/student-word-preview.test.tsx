import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OriginalWordPreview } from "@/routes/student-evaluation";

const { renderAsyncMock } = vi.hoisted(() => ({
  renderAsyncMock: vi.fn(async (_file: File, container: HTMLElement) => {
    container.innerHTML = "<p>Contenido original de Word</p>";
  }),
}));

vi.mock("docx-preview", () => ({ renderAsync: renderAsyncMock }));

describe("OriginalWordPreview", () => {
  it("renders the uploaded File and exposes the resulting Word content", async () => {
    const file = new File(["contenido"], "tesis.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const { container } = render(<OriginalWordPreview file={file} />);

    expect(await screen.findByText("Contenido original de Word")).toBeInTheDocument();
    expect(renderAsyncMock).toHaveBeenCalledWith(
      file,
      expect.any(HTMLDivElement),
      undefined,
      expect.objectContaining({ inWrapper: true, ignoreHeight: true }),
    );
    expect(container.querySelector(".docx-preview")).toHaveTextContent("Contenido original de Word");
  });
});

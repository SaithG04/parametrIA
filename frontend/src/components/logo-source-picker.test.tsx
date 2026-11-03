import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogoSourcePicker, type LogoSource } from "@/components/logo-source-picker";

describe("LogoSourcePicker", () => {
  it("uses accessible visual cards instead of native radio controls", () => {
    const onSourceChange = vi.fn<(source: LogoSource) => void>();
    render(
      <LogoSourcePicker
        idPrefix="test-logo"
        url=""
        uploadedUrl=""
        source="url"
        onUrlChange={vi.fn()}
        onSourceChange={onSourceChange}
        onUpload={vi.fn()}
        isUploading={false}
        uploadError=""
      />,
    );

    expect(screen.getByRole("button", { name: /URL de Internet/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Subir imagen/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Subir imagen/i }));

    expect(onSourceChange).toHaveBeenCalledWith("upload");
  });
});

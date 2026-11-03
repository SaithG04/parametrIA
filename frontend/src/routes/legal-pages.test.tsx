import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LegalAcceptanceGate } from "@/routes/legal-pages";

const { acceptMutation } = vi.hoisted(() => ({ acceptMutation: vi.fn() }));

vi.mock("@/hooks/queries", () => ({
  useAcceptLegal: () => ({ mutate: acceptMutation, isPending: false }),
  useLegalDocuments: () => ({
    data: {
      terms: { version: "terms-v1", title: "Términos de uso", content: "# Términos" },
      privacy: { version: "privacy-v1", title: "Política de privacidad", content: "# Privacidad" },
      privacyContact: "privacy@example.test",
      retention: { sourceDocumentDays: 30, evaluationReportMonths: 12 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useLegalStatus: () => ({
    data: {
      terms: { version: "terms-v1", accepted: false, acceptedAt: null },
      privacy: { version: "privacy-v1", accepted: false, acceptedAt: null },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("LegalAcceptanceGate", () => {
  beforeEach(() => acceptMutation.mockClear());

  it("requires both explicit acknowledgements before registering acceptance", () => {
    render(<MemoryRouter><LegalAcceptanceGate userId="user-1"><p>Contenido protegido</p></LegalAcceptanceGate></MemoryRouter>);

    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    const acceptButton = screen.getByRole("button", { name: "Aceptar y continuar" });
    expect(acceptButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText("He leído y acepto los Términos de uso."));
    expect(acceptButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText("He leído y acepto el tratamiento descrito en la Política de privacidad."));
    expect(acceptButton).toBeEnabled();

    fireEvent.click(acceptButton);
    expect(acceptMutation).toHaveBeenCalledWith(undefined, expect.objectContaining({ onError: expect.any(Function) }));
  });
});

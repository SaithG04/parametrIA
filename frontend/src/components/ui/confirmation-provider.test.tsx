import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmationProvider, useConfirmation } from "@/components/ui/confirmation-provider";

function ConfirmationExample() {
  const { confirm } = useConfirmation();
  return <button type="button" onClick={async () => {
    const accepted = await confirm({
      title: "Confirmar acción",
      description: "Esta acción requiere confirmación.",
      confirmLabel: "Continuar",
    });
    document.body.dataset["confirmationResult"] = String(accepted);
  }}>Abrir confirmación</button>;
}

describe("ConfirmationProvider", () => {
  it("resolves with the user's choice using the application dialog", async () => {
    render(<ConfirmationProvider><ConfirmationExample /></ConfirmationProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmación" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Esta acción requiere confirmación.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(document.body.dataset["confirmationResult"]).toBe("true"));
  });

  it("resolves false when the user cancels", async () => {
    render(<ConfirmationProvider><ConfirmationExample /></ConfirmationProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmación" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(document.body.dataset["confirmationResult"]).toBe("false"));
  });
});

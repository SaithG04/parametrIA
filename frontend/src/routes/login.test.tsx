import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/routes/login";

vi.mock("@/hooks/queries", () => ({
  useLogin: () => ({ mutateAsync: vi.fn() }),
}));

describe("LoginPage", () => {
  it("shows product information and keeps password visibility control inside its field", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: /Gestiona tus evaluaciones/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inicia sesión" })).toBeInTheDocument();

    const password = screen.getByLabelText("Contraseña");
    const visibilityButton = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(visibilityButton.parentElement).toHaveClass("password-field");
    expect(visibilityButton).toHaveClass("password-visibility");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(visibilityButton);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();
  });
});

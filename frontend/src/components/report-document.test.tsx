import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportDocument, ReportPdfDownloadButton } from "@/components/report-document";
import type { Report } from "@/services/types";

describe("ReportDocument", () => {
  it("renders dynamic fields and tabular object arrays", () => {
    const report: Report = {
      overallScore: 0,
      summary: "",
      sections: [],
      recommendations: [],
      ficha: { titulo: "Estudio de caso", estado: "En revisión" },
      tabla_verificacion: [
        { criterio: "Metodología", justificacion: "Coincide con los objetivos." },
        { criterio: "Resultados", justificacion: "Falta evidencia." },
      ],
      providerName: "Proveedor de prueba",
      model: "modelo-ejemplo",
    };

    render(<ReportDocument report={report} studentName="Ana Pérez" fileName="informe.docx" />);

    expect(screen.getByText("informe.docx")).toBeInTheDocument();
    expect(screen.getByText("Estudio de caso")).toBeInTheDocument();
    expect(screen.getByText("Metodología")).toBeInTheDocument();
    expect(screen.getByText("Falta evidencia.")).toBeInTheDocument();
    expect(screen.getByText(/Proveedor de prueba/)).toBeInTheDocument();
  });

  it("opens the browser print dialog for PDF export", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<ReportPdfDownloadButton fileName="informe final.docx" />);

    fireEvent.click(screen.getByRole("button", { name: "Descargar informe en PDF" }));

    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});

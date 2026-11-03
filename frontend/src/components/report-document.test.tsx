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

  it("allocates more PDF table width to long text columns", () => {
    const report: Report = {
      overallScore: 0,
      summary: "",
      sections: [],
      recommendations: [],
      tabla_verificacion: [
        {
          estado: "NO_CUMPLE",
          seccion: "Resumen y abstract",
          criterio: "Presenta objetivo y metodología",
          justificacion: "La descripción debe explicar la muestra y el diseño de investigación.",
          evidencia_documental: "El archivo no contiene la sección requerida.",
        },
      ],
      providerName: "Proveedor de prueba",
      model: "modelo-ejemplo",
    };

    const { container } = render(<ReportDocument report={report} studentName="Ana Pérez" fileName="informe.docx" />);
    const columns = [...container.querySelectorAll<HTMLTableColElement>(".report-data-table col")];
    const widthFor = (index: number) => Number.parseFloat(columns[index]?.style.width ?? "0");

    expect(columns).toHaveLength(5);
    expect(widthFor(0)).toBeLessThan(widthFor(2));
    expect(widthFor(2)).toBeLessThan(widthFor(3));
    expect(widthFor(1)).toBeLessThan(widthFor(4));
  });

  it("opens the browser print dialog for PDF export", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<ReportPdfDownloadButton fileName="informe final.docx" />);

    fireEvent.click(screen.getByRole("button", { name: "Descargar informe en PDF" }));

    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});

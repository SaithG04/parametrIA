import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudentEvaluationFlow } from "@/routes/student-evaluation-flow";
import type { EvaluationJob } from "@/services/types";

const file = new File(["thesis content"], "tesis.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

function createJob(status: EvaluationJob["status"]): EvaluationJob {
  return {
    id: "job-1",
    status,
    fileName: "tesis.docx",
    errorMessage: "",
    evaluationId: status === "SUCCEEDED" ? "evaluation-1" : null,
    createdAt: "2026-11-02T10:00:00.000Z",
  };
}

describe("StudentEvaluationFlow", () => {
  it("shows upload progress while sending the document", () => {
    render(
      <StudentEvaluationFlow
        file={file}
        previewReady
        previewLoading={false}
        uploadProgress={42}
        uploading
        job={undefined}
      />,
    );

    expect(screen.getByText("Subiendo 42%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Carga del documento 42%" })).toBeInTheDocument();
  });

  it("shows the live evaluation stage while the job is processing", () => {
    render(
      <StudentEvaluationFlow
        file={file}
        previewReady
        previewLoading={false}
        uploadProgress={100}
        uploading={false}
        job={createJob("PROCESSING")}
      />,
    );

    expect(screen.getByText("El evaluador está trabajando. Puedes dejar esta página abierta.")).toBeInTheDocument();
    expect(screen.getByText("Analizando documento…")).toBeInTheDocument();
    expect(screen.getByText("El informe se actualizará automáticamente")).toBeInTheDocument();
  });

  it("marks the report as ready after the job succeeds", () => {
    render(
      <StudentEvaluationFlow
        file={file}
        previewReady
        previewLoading={false}
        uploadProgress={100}
        uploading={false}
        job={createJob("SUCCEEDED")}
      />,
    );

    expect(screen.getByRole("heading", { name: "Evaluación completada" })).toBeInTheDocument();
    expect(screen.getByText("Informe listo")).toBeInTheDocument();
  });
});

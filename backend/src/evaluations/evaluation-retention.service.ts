import { Injectable, Logger } from "@nestjs/common";
import { EvaluationJobStatus } from "@prisma/client";
import { DATA_RETENTION } from "../legal/legal-documents";
import { PrismaService } from "../prisma/prisma.service";
import { FileStorageService } from "../storage/storage.service";

@Injectable()
export class EvaluationRetentionService {
  private readonly logger = new Logger(EvaluationRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async cleanupExpiredData() {
    const now = new Date();
    const sourceCutoff = new Date(now.getTime() - DATA_RETENTION.sourceDocumentDays * 24 * 60 * 60 * 1000);
    const reportCutoff = new Date(now);
    const originalDay = reportCutoff.getUTCDate();
    reportCutoff.setUTCDate(1);
    reportCutoff.setUTCMonth(reportCutoff.getUTCMonth() - DATA_RETENTION.evaluationReportMonths);
    const lastDayOfCutoffMonth = new Date(Date.UTC(
      reportCutoff.getUTCFullYear(),
      reportCutoff.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    reportCutoff.setUTCDate(Math.min(originalDay, lastDayOfCutoffMonth));

    const terminalStatuses = [EvaluationJobStatus.SUCCEEDED, EvaluationJobStatus.FAILED];
    const batchSize = 500;
    let documentsDeleted = 0;
    let sourceFailures = 0;
    let sourceCursor = "";

    while (true) {
      const expiredSources = await this.prisma.evaluationJob.findMany({
        where: {
          ...(sourceCursor ? { id: { gt: sourceCursor } } : {}),
          status: { in: terminalStatuses },
          updatedAt: { lte: sourceCutoff },
          OR: [
            { fileKey: { not: "" } },
            { evaluation: { is: { fileKey: { not: "" } } } },
          ],
        },
        include: { evaluation: { select: { fileKey: true } } },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (expiredSources.length === 0) break;

      for (const job of expiredSources) {
        try {
          const keys = new Set([job.fileKey, job.evaluation?.fileKey ?? ""].filter(Boolean));
          for (const key of keys) await this.fileStorage.deleteDocument(key);
          await this.prisma.$transaction([
            this.prisma.evaluation.updateMany({
              where: { jobId: job.id },
              data: { fileKey: "" },
            }),
            this.prisma.evaluationJob.updateMany({
              where: { id: job.id, fileKey: { not: "" } },
              data: { fileKey: "" },
            }),
          ]);
          documentsDeleted += keys.size;
        } catch (error) {
          sourceFailures += 1;
          this.logger.error(
            `Could not apply source-document retention for evaluation job ${job.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      sourceCursor = expiredSources[expiredSources.length - 1]?.id ?? sourceCursor;
      if (expiredSources.length < batchSize) break;
    }

    let reportsDeleted = 0;
    let reportFailures = 0;
    let reportCursor = "";

    while (true) {
      const expiredReports = await this.prisma.evaluation.findMany({
        where: {
          ...(reportCursor ? { id: { gt: reportCursor } } : {}),
          createdAt: { lte: reportCutoff },
          OR: [
            { jobId: null },
            { job: { is: { status: { in: terminalStatuses } } } },
          ],
        },
        include: { job: { select: { id: true, fileKey: true } } },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (expiredReports.length === 0) break;

      for (const evaluation of expiredReports) {
        try {
          const keys = new Set([evaluation.fileKey, evaluation.job?.fileKey ?? ""].filter(Boolean));
          for (const key of keys) await this.fileStorage.deleteDocument(key);
          await this.prisma.$transaction(async (transaction) => {
            if (evaluation.job) {
              await transaction.evaluationJob.deleteMany({
                where: { id: evaluation.job.id, status: { in: terminalStatuses } },
              });
            }
            await transaction.evaluation.deleteMany({
              where: { id: evaluation.id, createdAt: { lte: reportCutoff } },
            });
          });
          reportsDeleted += 1;
        } catch (error) {
          reportFailures += 1;
          this.logger.error(
            `Could not apply report-retention policy for evaluation ${evaluation.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      reportCursor = expiredReports[expiredReports.length - 1]?.id ?? reportCursor;
      if (expiredReports.length < batchSize) break;
    }

    let jobsDeleted = 0;
    let jobFailures = 0;
    let jobCursor = "";

    while (true) {
      const expiredJobsWithoutReport = await this.prisma.evaluationJob.findMany({
        where: {
          ...(jobCursor ? { id: { gt: jobCursor } } : {}),
          status: { in: terminalStatuses },
          createdAt: { lte: reportCutoff },
          evaluation: { is: null },
        },
        select: { id: true, fileKey: true },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      if (expiredJobsWithoutReport.length === 0) break;

      for (const job of expiredJobsWithoutReport) {
        try {
          if (job.fileKey) await this.fileStorage.deleteDocument(job.fileKey);
          await this.prisma.evaluationJob.deleteMany({
            where: {
              id: job.id,
              status: { in: terminalStatuses },
              createdAt: { lte: reportCutoff },
              evaluation: { is: null },
            },
          });
          jobsDeleted += 1;
        } catch (error) {
          jobFailures += 1;
          this.logger.error(
            `Could not apply metadata-retention policy for evaluation job ${job.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
      jobCursor = expiredJobsWithoutReport[expiredJobsWithoutReport.length - 1]?.id ?? jobCursor;
      if (expiredJobsWithoutReport.length < batchSize) break;
    }

    this.logger.log(
      `Retention cleanup finished: ${documentsDeleted} source documents, ${reportsDeleted} reports, ${jobsDeleted} job records deleted; ${sourceFailures + reportFailures + jobFailures} failures.`,
    );
    return {
      sourceDocumentsDeleted: documentsDeleted,
      sourceDocumentFailures: sourceFailures,
      reportsDeleted,
      reportFailures,
      jobsDeleted,
      jobFailures,
    };
  }
}

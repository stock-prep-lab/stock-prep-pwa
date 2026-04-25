export type ImportScopeId = "FX" | "HK" | "JP" | "UK" | "US";

export type ImportJobStatus = "completed" | "failed" | "processing" | "queued";

export type ImportJobRecord = {
  id: string;
  scopeId: ImportScopeId;
  fileName: string;
  status: ImportJobStatus;
  startedAt: string;
  finishedAt?: string;
  datasetVersion?: string;
  manifestKey?: string;
  symbolCount: number;
  dailyPriceCount: number;
  exchangeRateCount: number;
  errorMessage?: string;
};

export type ImportJobsPayload = {
  datasetVersion: string | null;
  generatedAt: string | null;
  jobs: ImportJobRecord[];
};

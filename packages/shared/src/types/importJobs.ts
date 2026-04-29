export type ImportScopeId = "FX" | "HK" | "JP" | "UK" | "US";

export type ImportJobStatus = "completed" | "failed" | "processing" | "queued";

export type CreateImportUploadSessionRequest = {
  contentType: string;
  fileName: string;
  fileSize: number;
  scopeId: ImportScopeId;
};

export type ImportDirectUploadSession = {
  expiresAt: string;
  fileName: string;
  finalizeToken: string;
  jobId: string;
  mode: "direct-r2";
  scopeId: ImportScopeId;
  uploadHeaders: Record<string, string>;
  uploadMethod: "PUT";
  uploadUrl: string;
};

export type ImportProxyUploadSession = {
  mode: "server-proxy";
  reason: string;
};

export type ImportUploadSessionPayload = ImportDirectUploadSession | ImportProxyUploadSession;

export type FinalizeImportUploadRequest = {
  finalizeToken: string;
};

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

const TYPE_MARKER = undefined as never;

export type ImportScopeId = "FX" | "HK" | "JP" | "UK" | "US";
export const ImportScopeId = TYPE_MARKER as ImportScopeId;

export type ImportJobStatus = "completed" | "failed" | "processing" | "queued";
export const ImportJobStatus = TYPE_MARKER as ImportJobStatus;

export type CreateImportUploadSessionRequest = {
  contentType: string;
  fileName: string;
  fileSize: number;
  scopeId: ImportScopeId;
};
export const CreateImportUploadSessionRequest =
  TYPE_MARKER as CreateImportUploadSessionRequest;

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
export const ImportDirectUploadSession = TYPE_MARKER as ImportDirectUploadSession;

export type ImportProxyUploadSession = {
  mode: "server-proxy";
  reason: string;
};
export const ImportProxyUploadSession = TYPE_MARKER as ImportProxyUploadSession;

export type ImportUploadSessionPayload = ImportDirectUploadSession | ImportProxyUploadSession;
export const ImportUploadSessionPayload = TYPE_MARKER as ImportUploadSessionPayload;

export type FinalizeImportUploadRequest = {
  finalizeToken: string;
};
export const FinalizeImportUploadRequest = TYPE_MARKER as FinalizeImportUploadRequest;

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
export const ImportJobRecord = TYPE_MARKER as ImportJobRecord;

export type ImportJobsPayload = {
  datasetVersion: string | null;
  generatedAt: string | null;
  jobs: ImportJobRecord[];
};
export const ImportJobsPayload = TYPE_MARKER as ImportJobsPayload;

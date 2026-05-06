import type {
  CreateImportUploadSessionRequest,
  DatasetVersionPayload,
  FinalizeImportUploadRequest,
  HoldingsPayload,
  ImportJobRecord,
  ImportJobsPayload,
  ImportUploadSessionPayload,
  LatestSummaryPayload,
  MarketDataPayload,
  UpsertHoldingRequest,
} from "@stock-prep/shared";

import { getStockPrepServerBackend, resetStockPrepServerBackendState } from "./stockPrepBackend.js";

export async function handleDatasetVersionRequest({
  localDatasetVersion,
}: {
  localDatasetVersion?: string | null;
} = {}): Promise<DatasetVersionPayload> {
  return getStockPrepServerBackend().getDatasetVersionPayload({ localDatasetVersion });
}

export async function handleMarketDataRequest(): Promise<MarketDataPayload> {
  return getStockPrepServerBackend().getMarketDataPayload();
}

export async function handleLatestSummaryRequest(): Promise<LatestSummaryPayload> {
  return getStockPrepServerBackend().getLatestSummaryPayload();
}

export async function handleGetHoldingsRequest(): Promise<HoldingsPayload> {
  return getStockPrepServerBackend().getHoldingsPayload();
}

export async function handleUpsertHoldingRequest(
  request: UpsertHoldingRequest,
): Promise<HoldingsPayload> {
  return getStockPrepServerBackend().upsertHolding(request);
}

export async function handleListImportJobsRequest(): Promise<ImportJobsPayload> {
  return getStockPrepServerBackend().getImportJobsPayload();
}

export async function handleCreateImportUploadSessionRequest(
  request: CreateImportUploadSessionRequest,
): Promise<ImportUploadSessionPayload> {
  return getStockPrepServerBackend().createImportUploadSession(request);
}

export async function handleFinalizeImportUploadRequest(
  request: FinalizeImportUploadRequest,
): Promise<ImportJobRecord> {
  return getStockPrepServerBackend().finalizeImportUpload(request);
}

export async function handleImportMarketZipRequest({
  fileName,
  scopeId,
  zipBytes,
}: {
  fileName: string;
  scopeId: ImportJobRecord["scopeId"];
  zipBytes: Uint8Array;
}): Promise<ImportJobRecord> {
  return getStockPrepServerBackend().importMarketZip({
    fileName,
    scopeId,
    zipBytes,
  });
}

export function resetStockPrepApiServerState(): void {
  resetStockPrepServerBackendState();
}

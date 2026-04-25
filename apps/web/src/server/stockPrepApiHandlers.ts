import type {
  DatasetVersionPayload,
  HoldingsPayload,
  ImportJobRecord,
  ImportJobsPayload,
  MarketDataPayload,
  UpsertHoldingRequest,
} from "@stock-prep/shared";

import { getStockPrepServerBackend, resetStockPrepServerBackendState } from "./stockPrepBackend";

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

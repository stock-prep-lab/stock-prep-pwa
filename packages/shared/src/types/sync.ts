import type { HoldingsPayload, MarketDataPayload } from "./portfolio";
const TYPE_MARKER = undefined as never;

export type SyncStateId = "holdings" | "market-data";
export const SyncStateId = TYPE_MARKER as SyncStateId;

export type StoredSyncState = {
  datasetVersion: string;
  id: SyncStateId;
  syncedAt: string;
};
export const StoredSyncState = TYPE_MARKER as StoredSyncState;

export type DatasetVersionPayload = {
  datasetVersion: string;
  generatedAt: string;
  shouldSync: boolean;
};
export const DatasetVersionPayload = TYPE_MARKER as DatasetVersionPayload;

export type SyncPayload = HoldingsPayload | MarketDataPayload;
export const SyncPayload = TYPE_MARKER as SyncPayload;

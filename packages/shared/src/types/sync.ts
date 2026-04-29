import type { HoldingsPayload, MarketDataPayload } from "./portfolio.js";

export type SyncStateId = "holdings" | "market-data";

export type StoredSyncState = {
  datasetVersion: string;
  id: SyncStateId;
  syncedAt: string;
};

export type DatasetVersionPayload = {
  datasetVersion: string;
  generatedAt: string;
  shouldSync: boolean;
};

export type SyncPayload = HoldingsPayload | MarketDataPayload;

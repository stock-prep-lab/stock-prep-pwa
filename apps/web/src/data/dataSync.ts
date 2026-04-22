import type { HoldingsPayload, MarketDataPayload } from "@stock-prep/shared";

import { fetchDatasetVersion, fetchHoldings, fetchMarketData } from "./syncApi";
import { notifyStockPrepDataChanged } from "./dataSyncEvents";
import {
  persistHoldingsPayload,
  persistMarketDataPayload,
  readLocalSyncVersion,
} from "./dataSyncPersistence";

export type DataSyncResult = {
  holdingsUpdated: boolean;
  marketDataUpdated: boolean;
};

export async function syncStockPrepData(): Promise<DataSyncResult> {
  const [localHoldingsVersion, localMarketDataVersion] = await Promise.all([
    readLocalSyncVersion("holdings"),
    readLocalSyncVersion("market-data"),
  ]);

  const datasetVersion = await fetchDatasetVersion(localMarketDataVersion);
  let marketDataPayload: MarketDataPayload | null = null;
  let holdingsPayload: HoldingsPayload | null = null;

  if (datasetVersion.shouldSync) {
    marketDataPayload = await fetchMarketData();
    await persistMarketDataPayload(marketDataPayload);
  }

  holdingsPayload = await fetchHoldings();

  if (holdingsPayload.updatedAt !== localHoldingsVersion) {
    await persistHoldingsPayload(holdingsPayload);
  } else {
    holdingsPayload = null;
  }

  const result = {
    holdingsUpdated: holdingsPayload !== null,
    marketDataUpdated: marketDataPayload !== null,
  };

  if (result.holdingsUpdated || result.marketDataUpdated) {
    notifyStockPrepDataChanged();
  }

  return result;
}

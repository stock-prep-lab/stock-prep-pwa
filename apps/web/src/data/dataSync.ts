import type { HoldingsPayload, LatestSummaryPayload } from "@stock-prep/shared";

import { fetchDatasetVersion, fetchHoldings, fetchLatestSummary, fetchUserSymbols } from "./syncApi";
import { notifyStockPrepDataChanged } from "./dataSyncEvents";
import { notifyUserSymbolsChanged } from "./userSymbolsEvents";
import {
  persistHoldingsPayload,
  persistLatestSummaryPayload,
  persistUserSymbolsPayload,
  readLocalSyncVersion,
} from "./dataSyncPersistence";

export type DataSyncResult = {
  holdingsUpdated: boolean;
  latestSummaryUpdated: boolean;
  userSymbolsUpdated: boolean;
};

export async function syncStockPrepData(): Promise<DataSyncResult> {
  const [localHoldingsVersion, localLatestSummaryVersion, localUserSymbolsVersion] = await Promise.all([
    readLocalSyncVersion("holdings"),
    readLocalSyncVersion("latest-summary"),
    readLocalSyncVersion("user-symbols"),
  ]);

  const datasetVersion = await fetchDatasetVersion(localLatestSummaryVersion, {
    activity: "background",
  });
  let latestSummaryPayload: LatestSummaryPayload | null = null;
  let holdingsPayload: HoldingsPayload | null = null;

  if (datasetVersion.shouldSync) {
    latestSummaryPayload = await fetchLatestSummary({
      activity: "background",
    });
    await persistLatestSummaryPayload(latestSummaryPayload);
  }

  holdingsPayload = await fetchHoldings({
    activity: "background",
  });
  const userSymbolsPayload = await fetchUserSymbols({
    activity: "background",
  });

  if (holdingsPayload.updatedAt !== localHoldingsVersion) {
    await persistHoldingsPayload(holdingsPayload);
  } else {
    holdingsPayload = null;
  }

  const userSymbolsUpdated = userSymbolsPayload.updatedAt !== localUserSymbolsVersion;

  if (userSymbolsUpdated) {
    await persistUserSymbolsPayload(userSymbolsPayload);
  }

  const result = {
    holdingsUpdated: holdingsPayload !== null,
    latestSummaryUpdated: latestSummaryPayload !== null,
    userSymbolsUpdated,
  };

  if (result.holdingsUpdated || result.latestSummaryUpdated) {
    notifyStockPrepDataChanged();
  }

  if (result.userSymbolsUpdated) {
    notifyUserSymbolsChanged();
  }

  return result;
}

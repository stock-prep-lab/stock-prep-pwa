import type { HoldingsPayload, LatestSummaryPayload } from "@stock-prep/shared";

import { fetchDatasetVersion, fetchHoldings, fetchLatestSummary } from "./syncApi";
import { notifyStockPrepDataChanged } from "./dataSyncEvents";
import {
  persistHoldingsPayload,
  persistLatestSummaryPayload,
  readLocalSyncVersion,
} from "./dataSyncPersistence";

export type DataSyncResult = {
  holdingsUpdated: boolean;
  latestSummaryUpdated: boolean;
};

export async function syncStockPrepData(): Promise<DataSyncResult> {
  const [localHoldingsVersion, localLatestSummaryVersion] = await Promise.all([
    readLocalSyncVersion("holdings"),
    readLocalSyncVersion("latest-summary"),
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

  if (holdingsPayload.updatedAt !== localHoldingsVersion) {
    await persistHoldingsPayload(holdingsPayload);
  } else {
    holdingsPayload = null;
  }

  const result = {
    holdingsUpdated: holdingsPayload !== null,
    latestSummaryUpdated: latestSummaryPayload !== null,
  };

  if (result.holdingsUpdated || result.latestSummaryUpdated) {
    notifyStockPrepDataChanged();
  }

  return result;
}

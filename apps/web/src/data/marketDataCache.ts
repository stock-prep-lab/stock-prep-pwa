import { persistMarketDataPayload, readLocalSyncVersion } from "./dataSyncPersistence";
import { fetchMarketData } from "./syncApi";

export async function ensureMarketDataSnapshot(): Promise<void> {
  const [marketDataVersion, latestSummaryVersion] = await Promise.all([
    readLocalSyncVersion("market-data"),
    readLocalSyncVersion("latest-summary"),
  ]);

  if (marketDataVersion && (!latestSummaryVersion || marketDataVersion === latestSummaryVersion)) {
    return;
  }

  const payload = await fetchMarketData({
    activity: "background",
  });

  await persistMarketDataPayload(payload);
}

import { persistMarketDataPayload, readLocalSyncVersion } from "./dataSyncPersistence";
import { fetchMarketData } from "./syncApi";

const MARKET_DATA_HYDRATION_TIMEOUT_MS = 15_000;

export async function ensureMarketDataSnapshot(): Promise<void> {
  const [marketDataVersion, latestSummaryVersion] = await Promise.all([
    readLocalSyncVersion("market-data"),
    readLocalSyncVersion("latest-summary"),
  ]);

  if (marketDataVersion && (!latestSummaryVersion || marketDataVersion === latestSummaryVersion)) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MARKET_DATA_HYDRATION_TIMEOUT_MS);

  try {
    const payload = await fetchMarketData({
      activity: "silent",
      signal: controller.signal,
    });

    await persistMarketDataPayload(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("市場データ補完がタイムアウトしました。時間をおいて再度開いてください。");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

import { describe, expect, it } from "vitest";

import type { MarketDataPayload } from "@stock-prep/shared";

import {
  loadPersistedMarketData,
  planPersistedMarketData,
} from "./stockPrepMarketDataStorage";

describe("stockPrepMarketDataStorage", () => {
  it("splits daily prices into chunks and restores the original payload", async () => {
    const payload: MarketDataPayload = {
      dailyPrices: [
        {
          close: 101,
          currency: "USD",
          date: "2026-04-28",
          high: 102,
          id: "us-aapl-2026-04-28",
          low: 100,
          open: 100,
          region: "US",
          sourceSymbol: "aapl.us",
          symbolId: "us-aapl",
          volume: 10,
        },
        {
          close: 103,
          currency: "USD",
          date: "2026-04-29",
          high: 104,
          id: "us-aapl-2026-04-29",
          low: 102,
          open: 102,
          region: "US",
          sourceSymbol: "aapl.us",
          symbolId: "us-aapl",
          volume: 12,
        },
      ],
      datasetVersion: "market-data-2026-04-29",
      exchangeRates: [
        {
          baseCurrency: "USD",
          close: 153,
          date: "2026-04-29",
          id: "USDJPY-2026-04-29",
          pair: "USDJPY",
          quoteCurrency: "JPY",
        },
      ],
      generatedAt: "2026-04-29T12:00:00.000Z",
      symbols: [
        {
          code: "AAPL",
          currency: "USD",
          id: "us-aapl",
          name: "Apple",
          region: "US",
          securityType: "stock",
          source: "stooq",
          sourceSymbol: "aapl.us",
        },
      ],
    };

    const planned = planPersistedMarketData({
      baseKey: "current/market-data.json",
      chunkSize: 1,
      marketData: payload,
    });
    const objectMap = new Map(planned.objects.map((object) => [object.key, object.body]));

    expect(planned.artifact.dailyPriceChunkKeys).toHaveLength(2);

    const restored = await loadPersistedMarketData({
      key: "current/market-data.json",
      readJson: async <T>(key: string) => objectMap.get(key) as T,
    });

    expect(restored.artifactKeys).toEqual([
      "current/market-data.json",
      "current/market-data.symbols.json",
      "current/market-data.exchange-rates.json",
      "current/market-data.daily-prices.0000.json",
      "current/market-data.daily-prices.0001.json",
    ]);
    expect(restored.marketData).toEqual(payload);
  });
});

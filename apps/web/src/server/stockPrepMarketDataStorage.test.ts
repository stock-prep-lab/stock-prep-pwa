import { describe, expect, it } from "vitest";

import type { MarketDataPayload } from "@stock-prep/shared";

import {
  loadPersistedHistoryBarsForSymbol,
  loadPersistedMarketData,
  planPersistedMarketData,
} from "./stockPrepMarketDataStorage";

describe("stockPrepMarketDataStorage", () => {
  it("splits daily prices by scope and restores the original payload", async () => {
    const payload: MarketDataPayload = {
      dailyPrices: [
        {
          close: 200,
          currency: "JPY",
          date: "2026-04-29",
          high: 201,
          id: "jp-7203-2026-04-29",
          low: 199,
          open: 199,
          region: "JP",
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
          volume: 20,
        },
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
          code: "7203",
          currency: "JPY",
          id: "jp-7203",
          name: "Toyota",
          region: "JP",
          securityType: "stock",
          source: "stooq",
          sourceSymbol: "7203.jp",
        },
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

    expect(planned.artifact.scopeArtifacts.US?.marketDataKey).toBe("current/us/market-data.json");
    expect(planned.artifact.scopeArtifacts.JP?.marketDataKey).toBe("current/jp/market-data.json");

    const restored = await loadPersistedMarketData({
      key: "current/market-data.json",
      readJson: async <T>(key: string) => objectMap.get(key) as T,
    });

    expect(restored.artifactKeys).toContain("current/market-data.json");
    expect(restored.artifactKeysByScope.JP).toEqual([
      "current/jp/market-data.json",
      "current/jp/market-data.symbols.json",
      "current/jp/market-data.exchange-rates.json",
      "current/jp/history-index.json",
      "current/jp/latest-summary.json",
      "current/jp/market-data.daily-prices.0000.json",
    ]);
    expect(restored.artifactKeysByScope.US).toEqual([
      "current/us/market-data.json",
      "current/us/market-data.symbols.json",
      "current/us/market-data.exchange-rates.json",
      "current/us/history-index.json",
      "current/us/latest-summary.json",
      "current/us/market-data.daily-prices.0000.json",
      "current/us/market-data.daily-prices.0001.json",
    ]);
    expect(restored.marketData).toEqual(payload);
  });

  it("loads only the indexed chunks for a symbol history lookup", async () => {
    const payload: MarketDataPayload = {
      dailyPrices: [
        {
          close: 200,
          currency: "JPY",
          date: "2026-04-28",
          high: 201,
          id: "jp-7203-2026-04-28",
          low: 199,
          open: 199,
          region: "JP",
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
          volume: 100,
        },
        {
          close: 201,
          currency: "JPY",
          date: "2026-04-29",
          high: 202,
          id: "jp-7203-2026-04-29",
          low: 200,
          open: 200,
          region: "JP",
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
          volume: 101,
        },
        {
          close: 1500,
          currency: "JPY",
          date: "2026-04-29",
          high: 1505,
          id: "jp-6758-2026-04-29",
          low: 1490,
          open: 1495,
          region: "JP",
          sourceSymbol: "6758.jp",
          symbolId: "jp-6758",
          volume: 99,
        },
      ],
      datasetVersion: "market-data-2026-04-29",
      exchangeRates: [],
      generatedAt: "2026-04-29T12:00:00.000Z",
      symbols: [
        {
          code: "7203",
          currency: "JPY",
          id: "jp-7203",
          name: "Toyota",
          region: "JP",
          securityType: "stock",
          source: "stooq",
          sourceSymbol: "7203.jp",
        },
        {
          code: "6758",
          currency: "JPY",
          id: "jp-6758",
          name: "Sony",
          region: "JP",
          securityType: "stock",
          source: "stooq",
          sourceSymbol: "6758.jp",
        },
      ],
    };

    const planned = planPersistedMarketData({
      baseKey: "current/market-data.json",
      chunkSize: 1,
      marketData: payload,
    });
    const objectMap = new Map(planned.objects.map((object) => [object.key, object.body]));
    const readKeys: string[] = [];

    const bars = await loadPersistedHistoryBarsForSymbol({
      key: "current/market-data.json",
      readJson: async <T>(key: string) => {
        readKeys.push(key);
        return objectMap.get(key) as T;
      },
      symbolId: "jp-7203",
    });

    expect(bars.map((bar) => bar.id)).toEqual([
      "jp-7203-2026-04-28",
      "jp-7203-2026-04-29",
    ]);
    expect(readKeys).toEqual([
      "current/market-data.json",
      "current/jp/market-data.json",
      "current/jp/history-index.json",
      "current/jp/market-data.daily-prices.0000.json",
      "current/jp/market-data.daily-prices.0001.json",
    ]);
  });
});

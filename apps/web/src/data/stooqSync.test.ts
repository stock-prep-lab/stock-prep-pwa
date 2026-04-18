import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createStockPrepDbRepository,
  loadStockPrepSnapshot,
  openStockPrepDb,
} from "../storage/stockPrepDb";
import type { StockPrepDbRepository } from "../storage/stockPrepDb";
import { runStartupStooqSync, syncStooqDailyData, type StooqSyncResult } from "./stooqSync";
import { StooqUnsupportedDataError, type StooqClient } from "./stooqClient";

describe("stooqSync", () => {
  let db: IDBDatabase;
  let dbName: string;
  let repository: StockPrepDbRepository;

  beforeEach(async () => {
    dbName = `stock-prep-stooq-sync-test-${Date.now()}-${Math.random()}`;
    db = await openStockPrepDb({ dbName });
    repository = createStockPrepDbRepository(db);
  });

  afterEach(async () => {
    db.close();
    await deleteTestDatabase(dbName);
  });

  it("imports Stooq daily prices, exchange rates, and symbols into IndexedDB", async () => {
    const result = await syncStooqDailyData({
      client: createSuccessfulClient(),
      equityTargets: [
        {
          code: "7203",
          currency: "JPY",
          name: "トヨタ自動車",
          region: "JP",
          sourceSymbol: "7203.jp",
        },
      ],
      exchangeRatePairs: ["USDJPY"],
      repository,
    });

    await expect(loadStockPrepSnapshot(repository)).resolves.toEqual({
      cashBalances: [],
      dailyPrices: [
        {
          close: 3218,
          currency: "JPY",
          date: "2026-04-17",
          high: 3240,
          id: "jp-7203-2026-04-17",
          low: 3112,
          open: 3138,
          region: "JP",
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
          volume: 28430000,
        },
      ],
      exchangeRates: [
        {
          baseCurrency: "USD",
          close: 154.42,
          date: "2026-04-17",
          id: "USDJPY-2026-04-17",
          pair: "USDJPY",
          quoteCurrency: "JPY",
        },
      ],
      holdings: [],
      symbols: [
        {
          code: "7203",
          currency: "JPY",
          id: "jp-7203",
          name: "トヨタ自動車",
          region: "JP",
          source: "stooq",
          sourceSymbol: "7203.jp",
        },
      ],
    });
    expect(result).toEqual<StooqSyncResult>({
      failures: [],
      importedDailyPriceCount: 1,
      importedExchangeRateCount: 1,
      importedSymbolCount: 1,
    });
  });

  it("marks unsupported equity symbols without stopping other imports", async () => {
    const result = await syncStooqDailyData({
      client: {
        fetchDailyPrices: async (target) => {
          throw new StooqUnsupportedDataError(target.sourceSymbol);
        },
        fetchExchangeRates: async () => [
          {
            baseCurrency: "USD",
            close: 154.42,
            date: "2026-04-17",
            id: "USDJPY-2026-04-17",
            pair: "USDJPY",
            quoteCurrency: "JPY",
          },
        ],
      },
      equityTargets: [
        {
          code: "XXXX",
          currency: "USD",
          name: "Unsupported",
          region: "US",
          sourceSymbol: "xxxx.us",
        },
      ],
      exchangeRatePairs: ["USDJPY"],
      repository,
    });

    await expect(repository.getSymbol("us-xxxx")).resolves.toEqual({
      code: "XXXX",
      currency: "USD",
      id: "us-xxxx",
      name: "Unsupported",
      region: "US",
      source: "stooq",
      sourceSymbol: "xxxx.us",
      unsupportedReason: "Stooq data is not available for xxxx.us.",
    });
    expect(result.failures).toEqual([
      {
        kind: "dailyPrice",
        reason: "Stooq data is not available for xxxx.us.",
        sourceSymbol: "xxxx.us",
      },
    ]);
  });

  it("treats unsupported exchange-rate pairs as failures", async () => {
    const result = await syncStooqDailyData({
      client: {
        fetchDailyPrices: async () => [],
        fetchExchangeRates: async (pair) => {
          throw new StooqUnsupportedDataError(pair.toLowerCase());
        },
      },
      equityTargets: [],
      exchangeRatePairs: ["HKDJPY"],
      repository,
    });

    expect(result).toEqual<StooqSyncResult>({
      failures: [
        {
          kind: "exchangeRate",
          reason: "Stooq data is not available for hkdjpy.",
          sourceSymbol: "hkdjpy",
        },
      ],
      importedDailyPriceCount: 0,
      importedExchangeRateCount: 0,
      importedSymbolCount: 0,
    });
  });

  it("skips startup sync when the API key is missing", async () => {
    await expect(runStartupStooqSync({ apiKey: null, repository })).resolves.toEqual({
      reason: "missing-api-key",
      status: "skipped",
    });
  });
});

function createSuccessfulClient(): StooqClient {
  return {
    fetchDailyPrices: async (target) => [
      {
        close: 3218,
        currency: target.currency,
        date: "2026-04-17",
        high: 3240,
        id: "jp-7203-2026-04-17",
        low: 3112,
        open: 3138,
        region: target.region,
        sourceSymbol: target.sourceSymbol,
        symbolId: "jp-7203",
        volume: 28430000,
      },
    ],
    fetchExchangeRates: async () => [
      {
        baseCurrency: "USD",
        close: 154.42,
        date: "2026-04-17",
        id: "USDJPY-2026-04-17",
        pair: "USDJPY",
        quoteCurrency: "JPY",
      },
    ],
  };
}

function deleteTestDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to delete test database."));
    };
    request.onsuccess = () => {
      resolve();
    };
  });
}

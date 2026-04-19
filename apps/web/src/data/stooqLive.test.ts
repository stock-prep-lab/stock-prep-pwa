import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createStockPrepDbRepository,
  loadStockPrepSnapshot,
  openStockPrepDb,
} from "../storage/stockPrepDb";
import type { StockPrepDbRepository } from "../storage/stockPrepDb";
import {
  buildStooqSourceSymbol,
  createStooqClient,
  resolveStooqApiKey,
  stooqExchangeRatePairs,
  type StooqEquityImportTarget,
} from "./stooqClient";
import { syncStooqDailyData } from "./stooqSync";

const apiKey = resolveStooqApiKey();

describe.skipIf(!apiKey)("stooq live import", () => {
  let db: IDBDatabase;
  let dbName: string;
  let repository: StockPrepDbRepository;

  beforeEach(async () => {
    dbName = `stock-prep-stooq-live-test-${Date.now()}-${Math.random()}`;
    db = await openStockPrepDb({ dbName });
    repository = createStockPrepDbRepository(db);
  });

  afterEach(async () => {
    db.close();
    await deleteTestDatabase(dbName);
  });

  it("fetches real Stooq CSV and stores daily prices and exchange rates", async () => {
    const equityTargets: StooqEquityImportTarget[] = [
      {
        code: "7203",
        currency: "JPY",
        name: "トヨタ自動車",
        region: "JP",
        sourceSymbol: buildStooqSourceSymbol({ code: "7203", region: "JP" }),
      },
      {
        code: "AAPL",
        currency: "USD",
        name: "Apple",
        region: "US",
        sourceSymbol: buildStooqSourceSymbol({ code: "AAPL", region: "US" }),
      },
      {
        code: "HSBA",
        currency: "GBP",
        name: "HSBC Holdings",
        region: "UK",
        sourceSymbol: buildStooqSourceSymbol({ code: "HSBA", region: "UK" }),
      },
      {
        code: "0700",
        currency: "HKD",
        name: "Tencent Holdings",
        region: "HK",
        sourceSymbol: buildStooqSourceSymbol({ code: "0700", region: "HK" }),
      },
    ];

    const result = await syncStooqDailyData({
      client: createStooqClient({ apiKey, fromDate: "20260401", toDate: "20260417" }),
      equityTargets,
      exchangeRatePairs: [stooqExchangeRatePairs[0]],
      repository,
    });
    const snapshot = await loadStockPrepSnapshot(repository);

    expect(result.failures).toEqual([]);
    expect(snapshot.symbols).toHaveLength(4);
    expect(snapshot.symbols).toEqual(
      expect.arrayContaining([
        {
          code: "7203",
          currency: "JPY",
          id: "jp-7203",
          name: "トヨタ自動車",
          region: "JP",
          source: "stooq",
          sourceSymbol: "7203.jp",
        },
        {
          code: "AAPL",
          currency: "USD",
          id: "us-aapl",
          name: "Apple",
          region: "US",
          source: "stooq",
          sourceSymbol: "aapl.us",
        },
        {
          code: "HSBA",
          currency: "GBP",
          id: "uk-hsba",
          name: "HSBC Holdings",
          region: "UK",
          source: "stooq",
          sourceSymbol: "hsba.uk",
        },
        {
          code: "0700",
          currency: "HKD",
          id: "hk-0700",
          name: "Tencent Holdings",
          region: "HK",
          source: "stooq",
          sourceSymbol: "700.hk",
        },
      ]),
    );
    expect(snapshot.dailyPrices.length).toBeGreaterThan(0);
    expect(snapshot.exchangeRates.length).toBeGreaterThan(0);
    expect(new Set(snapshot.dailyPrices.map((price) => price.sourceSymbol))).toEqual(
      new Set(["7203.jp", "aapl.us", "hsba.uk", "700.hk"]),
    );
    expect(snapshot.dailyPrices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: "JPY",
          region: "JP",
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
        }),
      ]),
    );
    expect(snapshot.exchangeRates[0]).toEqual(
      expect.objectContaining({
        baseCurrency: "USD",
        pair: "USDJPY",
        quoteCurrency: "JPY",
      }),
    );
  }, 30000);
});

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

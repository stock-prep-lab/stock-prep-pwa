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
    const equityTarget: StooqEquityImportTarget = {
      code: "7203",
      currency: "JPY",
      name: "トヨタ自動車",
      region: "JP",
      sourceSymbol: buildStooqSourceSymbol({ code: "7203", region: "JP" }),
    };

    const result = await syncStooqDailyData({
      client: createStooqClient({ apiKey, fromDate: "20260401", toDate: "20260417" }),
      equityTargets: [equityTarget],
      exchangeRatePairs: [stooqExchangeRatePairs[0]],
      repository,
    });
    const snapshot = await loadStockPrepSnapshot(repository);

    expect(result.failures).toEqual([]);
    expect(snapshot.symbols).toEqual([
      {
        code: "7203",
        currency: "JPY",
        id: "jp-7203",
        name: "トヨタ自動車",
        region: "JP",
        source: "stooq",
        sourceSymbol: "7203.jp",
      },
    ]);
    expect(snapshot.dailyPrices.length).toBeGreaterThan(0);
    expect(snapshot.exchangeRates.length).toBeGreaterThan(0);
    expect(snapshot.dailyPrices[0]).toEqual(
      expect.objectContaining({
        currency: "JPY",
        region: "JP",
        sourceSymbol: "7203.jp",
        symbolId: "jp-7203",
      }),
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

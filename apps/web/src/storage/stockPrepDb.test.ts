import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  CashBalance,
  DailyPriceBar,
  ExchangeRateBar,
  PortfolioHolding,
  StoredSyncState,
  StoredStockSymbol,
} from "@stock-prep/shared";

import {
  createStockPrepDbRepository,
  dummyStockPrepSnapshot,
  loadStockPrepSnapshot,
  openStockPrepDb,
  saveDummyStockPrepData,
  stockPrepStores,
} from "./stockPrepDb";

describe("stockPrepDb", () => {
  let db: IDBDatabase;
  let dbName: string;

  beforeEach(async () => {
    dbName = `stock-prep-test-${Date.now()}-${Math.random()}`;
    db = await openStockPrepDb({ dbName });
  });

  afterEach(async () => {
    db.close();
    await deleteTestDatabase(dbName);
  });

  it("creates the Slice 9 stores", () => {
    expect(Array.from(db.objectStoreNames).sort()).toEqual(Object.values(stockPrepStores).sort());
  });

  it("saves and reads each store", async () => {
    const repository = createStockPrepDbRepository(db);

    const symbol: StoredStockSymbol = {
      code: "7203",
      currency: "JPY",
      id: "jp-7203",
      name: "トヨタ自動車",
      region: "JP",
      source: "stooq",
      sourceSymbol: "7203.jp",
    };
    const dailyPrice: DailyPriceBar = {
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
    };
    const exchangeRate: ExchangeRateBar = {
      baseCurrency: "USD",
      close: 154.42,
      date: "2026-04-17",
      id: "USDJPY-2026-04-17",
      pair: "USDJPY",
      quoteCurrency: "JPY",
    };
    const holding: PortfolioHolding = {
      averagePrice: 2840,
      currency: "JPY",
      id: "holding-jp-7203",
      quantity: 200,
      symbolId: "jp-7203",
      updatedAt: "2026-04-17T15:00:00+09:00",
    };
    const cashBalance: CashBalance = {
      amount: 331000,
      currency: "JPY",
      updatedAt: "2026-04-17T15:00:00+09:00",
    };
    const syncState: StoredSyncState = {
      datasetVersion: "server-market-v1",
      id: "market-data",
      syncedAt: "2026-04-17T15:35:00+09:00",
    };

    await repository.putSymbol(symbol);
    await repository.putDailyPrice(dailyPrice);
    await repository.putExchangeRate(exchangeRate);
    await repository.putHolding(holding);
    await repository.putCashBalance(cashBalance);
    await repository.putSyncState(syncState);

    await expect(repository.getSymbol("jp-7203")).resolves.toEqual(symbol);
    await expect(repository.getSymbolByCodeRegion("7203", "JP")).resolves.toEqual(symbol);
    await expect(repository.getDailyPrice("jp-7203-2026-04-17")).resolves.toEqual(dailyPrice);
    await expect(repository.getExchangeRate("USDJPY-2026-04-17")).resolves.toEqual(exchangeRate);
    await expect(repository.getHolding("holding-jp-7203")).resolves.toEqual(holding);
    await expect(repository.getCashBalance("JPY")).resolves.toEqual(cashBalance);
    await expect(repository.getSyncState("market-data")).resolves.toEqual(syncState);
  });

  it("saves and loads the dummy snapshot", async () => {
    const repository = createStockPrepDbRepository(db);

    await saveDummyStockPrepData(repository);
    const snapshot = await loadStockPrepSnapshot(repository);

    expect(snapshot.symbols).toHaveLength(dummyStockPrepSnapshot.symbols.length);
    expect(snapshot.dailyPrices).toHaveLength(dummyStockPrepSnapshot.dailyPrices.length);
    expect(snapshot.exchangeRates).toHaveLength(dummyStockPrepSnapshot.exchangeRates.length);
    expect(snapshot.holdings).toHaveLength(dummyStockPrepSnapshot.holdings.length);
    expect(snapshot.cashBalances).toEqual(dummyStockPrepSnapshot.cashBalances);
  });

  it("clears all stores", async () => {
    const repository = createStockPrepDbRepository(db);

    await saveDummyStockPrepData(repository);
    await repository.clearAllStores();

    await expect(loadStockPrepSnapshot(repository)).resolves.toEqual({
      cashBalances: [],
      dailyPrices: [],
      exchangeRates: [],
      holdings: [],
      symbols: [],
    });
  });

  it("replaces market data and holdings snapshots store by store", async () => {
    const repository = createStockPrepDbRepository(db);

    await saveDummyStockPrepData(repository);

    await repository.replaceMarketDataSnapshot({
      dailyPrices: [dummyStockPrepSnapshot.dailyPrices[1]!],
      exchangeRates: [],
      symbols: [dummyStockPrepSnapshot.symbols[1]!],
    });
    await repository.replaceHoldingsSnapshot({
      cashBalances: [],
      holdings: [],
    });

    await expect(loadStockPrepSnapshot(repository)).resolves.toEqual({
      cashBalances: [],
      dailyPrices: [dummyStockPrepSnapshot.dailyPrices[1]!],
      exchangeRates: [],
      holdings: [],
      symbols: [dummyStockPrepSnapshot.symbols[1]!],
    });
  });
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

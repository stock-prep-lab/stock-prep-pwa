import type {
  CashBalance,
  DailyPriceBar,
  ExchangeRateBar,
  PortfolioHolding,
  StockPrepSnapshot,
  StoredSyncState,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { dummyStockPrepSnapshot } from "../data/seedSnapshot";

export const STOCK_PREP_DB_NAME = "stock-prep-lab";
export const STOCK_PREP_DB_VERSION = 2;

export const stockPrepStores = {
  cash: "cash",
  dailyPrices: "dailyPrices",
  exchangeRates: "exchangeRates",
  holdings: "holdings",
  syncState: "syncState",
  symbols: "symbols",
} as const;

type StockPrepStoreName = (typeof stockPrepStores)[keyof typeof stockPrepStores];

export type MarketDataSnapshot = Pick<StockPrepSnapshot, "dailyPrices" | "exchangeRates" | "symbols">;

export type HoldingsSnapshot = Pick<StockPrepSnapshot, "cashBalances" | "holdings">;

export type StockPrepDbRepository = {
  clearAllStores: () => Promise<void>;
  close: () => void;
  getCashBalance: (currency: CashBalance["currency"]) => Promise<CashBalance | null>;
  getDailyPrice: (id: DailyPriceBar["id"]) => Promise<DailyPriceBar | null>;
  getExchangeRate: (id: ExchangeRateBar["id"]) => Promise<ExchangeRateBar | null>;
  getHolding: (id: PortfolioHolding["id"]) => Promise<PortfolioHolding | null>;
  getSymbol: (id: StoredStockSymbol["id"]) => Promise<StoredStockSymbol | null>;
  getSyncState: (id: StoredSyncState["id"]) => Promise<StoredSyncState | null>;
  getSymbolByCodeRegion: (
    code: StoredStockSymbol["code"],
    region: StoredStockSymbol["region"],
  ) => Promise<StoredStockSymbol | null>;
  listCashBalances: () => Promise<CashBalance[]>;
  listDailyPrices: () => Promise<DailyPriceBar[]>;
  listExchangeRates: () => Promise<ExchangeRateBar[]>;
  listHoldings: () => Promise<PortfolioHolding[]>;
  listSymbols: () => Promise<StoredStockSymbol[]>;
  putSyncState: (syncState: StoredSyncState) => Promise<void>;
  putCashBalance: (cashBalance: CashBalance) => Promise<void>;
  putDailyPrice: (price: DailyPriceBar) => Promise<void>;
  putExchangeRate: (rate: ExchangeRateBar) => Promise<void>;
  putHolding: (holding: PortfolioHolding) => Promise<void>;
  putSymbol: (symbol: StoredStockSymbol) => Promise<void>;
  replaceHoldingsSnapshot: (snapshot: HoldingsSnapshot) => Promise<void>;
  replaceMarketDataSnapshot: (snapshot: MarketDataSnapshot) => Promise<void>;
};

export function openStockPrepDb({
  dbName = STOCK_PREP_DB_NAME,
  indexedDb = globalThis.indexedDB,
}: {
  dbName?: string;
  indexedDb?: IDBFactory;
} = {}): Promise<IDBDatabase> {
  if (!indexedDb) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(dbName, STOCK_PREP_DB_VERSION);

    request.onblocked = () => {
      reject(new Error("Opening IndexedDB was blocked by another connection."));
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB."));
    };
    request.onupgradeneeded = () => {
      migrateStockPrepDb(request.result);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export function createStockPrepDbRepository(db: IDBDatabase): StockPrepDbRepository {
  return {
    clearAllStores: () => clearAllStores(db),
    close: () => db.close(),
    getCashBalance: (currency) => getByKey<CashBalance>(db, stockPrepStores.cash, currency),
    getDailyPrice: (id) => getByKey<DailyPriceBar>(db, stockPrepStores.dailyPrices, id),
    getExchangeRate: (id) => getByKey<ExchangeRateBar>(db, stockPrepStores.exchangeRates, id),
    getHolding: (id) => getByKey<PortfolioHolding>(db, stockPrepStores.holdings, id),
    getSymbol: (id) => getByKey<StoredStockSymbol>(db, stockPrepStores.symbols, id),
    getSyncState: (id) => getByKey<StoredSyncState>(db, stockPrepStores.syncState, id),
    getSymbolByCodeRegion: (code, region) =>
      getByIndex<StoredStockSymbol>(db, stockPrepStores.symbols, "by_code_region", [code, region]),
    listCashBalances: () => getAll<CashBalance>(db, stockPrepStores.cash),
    listDailyPrices: () => getAll<DailyPriceBar>(db, stockPrepStores.dailyPrices),
    listExchangeRates: () => getAll<ExchangeRateBar>(db, stockPrepStores.exchangeRates),
    listHoldings: () => getAll<PortfolioHolding>(db, stockPrepStores.holdings),
    listSymbols: () => getAll<StoredStockSymbol>(db, stockPrepStores.symbols),
    putSyncState: (syncState) => putValue(db, stockPrepStores.syncState, syncState),
    putCashBalance: (cashBalance) => putValue(db, stockPrepStores.cash, cashBalance),
    putDailyPrice: (price) => putValue(db, stockPrepStores.dailyPrices, price),
    putExchangeRate: (rate) => putValue(db, stockPrepStores.exchangeRates, rate),
    putHolding: (holding) => putValue(db, stockPrepStores.holdings, holding),
    putSymbol: (symbol) => putValue(db, stockPrepStores.symbols, symbol),
    replaceHoldingsSnapshot: (snapshot) => replaceHoldingsSnapshot(db, snapshot),
    replaceMarketDataSnapshot: (snapshot) => replaceMarketDataSnapshot(db, snapshot),
  };
}

export async function saveDummyStockPrepData(repository: StockPrepDbRepository): Promise<void> {
  await Promise.all(dummyStockPrepSnapshot.symbols.map((symbol) => repository.putSymbol(symbol)));
  await Promise.all(
    dummyStockPrepSnapshot.dailyPrices.map((price) => repository.putDailyPrice(price)),
  );
  await Promise.all(
    dummyStockPrepSnapshot.exchangeRates.map((rate) => repository.putExchangeRate(rate)),
  );
  await Promise.all(
    dummyStockPrepSnapshot.holdings.map((holding) => repository.putHolding(holding)),
  );
  await Promise.all(
    dummyStockPrepSnapshot.cashBalances.map((cash) => repository.putCashBalance(cash)),
  );
  await repository.putSyncState({
    datasetVersion: "local-dummy-v1",
    id: "market-data",
    syncedAt: "2026-04-17T15:00:00+09:00",
  });
  await repository.putSyncState({
    datasetVersion: "local-dummy-v1",
    id: "holdings",
    syncedAt: "2026-04-17T15:00:00+09:00",
  });
}

export async function loadStockPrepSnapshot(
  repository: StockPrepDbRepository,
): Promise<StockPrepSnapshot> {
  const [cashBalances, dailyPrices, exchangeRates, holdings, symbols] = await Promise.all([
    repository.listCashBalances(),
    repository.listDailyPrices(),
    repository.listExchangeRates(),
    repository.listHoldings(),
    repository.listSymbols(),
  ]);

  return {
    cashBalances,
    dailyPrices,
    exchangeRates,
    holdings,
    symbols,
  };
}

export { dummyStockPrepSnapshot } from "../data/seedSnapshot";

function migrateStockPrepDb(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(stockPrepStores.symbols)) {
    const store = db.createObjectStore(stockPrepStores.symbols, { keyPath: "id" });
    store.createIndex("by_code_region", ["code", "region"], { unique: true });
    store.createIndex("by_source_symbol", "sourceSymbol", { unique: true });
  }

  if (!db.objectStoreNames.contains(stockPrepStores.dailyPrices)) {
    const store = db.createObjectStore(stockPrepStores.dailyPrices, { keyPath: "id" });
    store.createIndex("by_source_symbol", "sourceSymbol");
    store.createIndex("by_symbol_date", ["symbolId", "date"], { unique: true });
  }

  if (!db.objectStoreNames.contains(stockPrepStores.exchangeRates)) {
    const store = db.createObjectStore(stockPrepStores.exchangeRates, { keyPath: "id" });
    store.createIndex("by_pair_date", ["pair", "date"], { unique: true });
  }

  if (!db.objectStoreNames.contains(stockPrepStores.holdings)) {
    const store = db.createObjectStore(stockPrepStores.holdings, { keyPath: "id" });
    store.createIndex("by_symbol_id", "symbolId");
  }

  if (!db.objectStoreNames.contains(stockPrepStores.cash)) {
    db.createObjectStore(stockPrepStores.cash, { keyPath: "currency" });
  }

  if (!db.objectStoreNames.contains(stockPrepStores.syncState)) {
    db.createObjectStore(stockPrepStores.syncState, { keyPath: "id" });
  }
}

async function clearAllStores(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(Object.values(stockPrepStores), "readwrite");
  const done = transactionDone(transaction);

  for (const storeName of Object.values(stockPrepStores)) {
    transaction.objectStore(storeName).clear();
  }

  await done;
}

async function replaceMarketDataSnapshot(
  db: IDBDatabase,
  snapshot: MarketDataSnapshot,
): Promise<void> {
  const transaction = db.transaction(
    [stockPrepStores.symbols, stockPrepStores.dailyPrices, stockPrepStores.exchangeRates],
    "readwrite",
  );
  const done = transactionDone(transaction);

  transaction.objectStore(stockPrepStores.symbols).clear();
  transaction.objectStore(stockPrepStores.dailyPrices).clear();
  transaction.objectStore(stockPrepStores.exchangeRates).clear();

  for (const symbol of snapshot.symbols) {
    transaction.objectStore(stockPrepStores.symbols).put(symbol);
  }

  for (const dailyPrice of snapshot.dailyPrices) {
    transaction.objectStore(stockPrepStores.dailyPrices).put(dailyPrice);
  }

  for (const exchangeRate of snapshot.exchangeRates) {
    transaction.objectStore(stockPrepStores.exchangeRates).put(exchangeRate);
  }

  await done;
}

async function replaceHoldingsSnapshot(db: IDBDatabase, snapshot: HoldingsSnapshot): Promise<void> {
  const transaction = db.transaction([stockPrepStores.holdings, stockPrepStores.cash], "readwrite");
  const done = transactionDone(transaction);

  transaction.objectStore(stockPrepStores.holdings).clear();
  transaction.objectStore(stockPrepStores.cash).clear();

  for (const holding of snapshot.holdings) {
    transaction.objectStore(stockPrepStores.holdings).put(holding);
  }

  for (const cashBalance of snapshot.cashBalances) {
    transaction.objectStore(stockPrepStores.cash).put(cashBalance);
  }

  await done;
}

async function getAll<T>(db: IDBDatabase, storeName: StockPrepStoreName): Promise<T[]> {
  const transaction = db.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const result = await requestToPromise<T[]>(transaction.objectStore(storeName).getAll());
  await done;
  return result;
}

async function getByIndex<T>(
  db: IDBDatabase,
  storeName: StockPrepStoreName,
  indexName: string,
  key: IDBValidKey,
): Promise<T | null> {
  const transaction = db.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const result = await requestToPromise<T | undefined>(
    transaction.objectStore(storeName).index(indexName).get(key),
  );
  await done;
  return result ?? null;
}

async function getByKey<T>(
  db: IDBDatabase,
  storeName: StockPrepStoreName,
  key: IDBValidKey,
): Promise<T | null> {
  const transaction = db.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const result = await requestToPromise<T | undefined>(transaction.objectStore(storeName).get(key));
  await done;
  return result ?? null;
}

async function putValue<T>(
  db: IDBDatabase,
  storeName: StockPrepStoreName,
  value: T,
): Promise<void> {
  const transaction = db.transaction(storeName, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(storeName).put(value);
  await done;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    };
    transaction.oncomplete = () => {
      resolve();
    };
  });
}

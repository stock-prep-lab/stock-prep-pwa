import type {
  CashBalance,
  DailyPriceBar,
  ExchangeRateBar,
  PortfolioHolding,
  StoredStockSymbol,
} from "@stock-prep/shared";

export const STOCK_PREP_DB_NAME = "stock-prep-lab";
export const STOCK_PREP_DB_VERSION = 1;

export const stockPrepStores = {
  cash: "cash",
  dailyPrices: "dailyPrices",
  exchangeRates: "exchangeRates",
  holdings: "holdings",
  symbols: "symbols",
} as const;

type StockPrepStoreName = (typeof stockPrepStores)[keyof typeof stockPrepStores];

export type StockPrepSnapshot = {
  cashBalances: CashBalance[];
  dailyPrices: DailyPriceBar[];
  exchangeRates: ExchangeRateBar[];
  holdings: PortfolioHolding[];
  symbols: StoredStockSymbol[];
};

export type StockPrepDbRepository = {
  clearAllStores: () => Promise<void>;
  close: () => void;
  getCashBalance: (currency: CashBalance["currency"]) => Promise<CashBalance | null>;
  getDailyPrice: (id: DailyPriceBar["id"]) => Promise<DailyPriceBar | null>;
  getExchangeRate: (id: ExchangeRateBar["id"]) => Promise<ExchangeRateBar | null>;
  getHolding: (id: PortfolioHolding["id"]) => Promise<PortfolioHolding | null>;
  getSymbol: (id: StoredStockSymbol["id"]) => Promise<StoredStockSymbol | null>;
  getSymbolByCodeRegion: (
    code: StoredStockSymbol["code"],
    region: StoredStockSymbol["region"],
  ) => Promise<StoredStockSymbol | null>;
  listCashBalances: () => Promise<CashBalance[]>;
  listDailyPrices: () => Promise<DailyPriceBar[]>;
  listExchangeRates: () => Promise<ExchangeRateBar[]>;
  listHoldings: () => Promise<PortfolioHolding[]>;
  listSymbols: () => Promise<StoredStockSymbol[]>;
  putCashBalance: (cashBalance: CashBalance) => Promise<void>;
  putDailyPrice: (price: DailyPriceBar) => Promise<void>;
  putExchangeRate: (rate: ExchangeRateBar) => Promise<void>;
  putHolding: (holding: PortfolioHolding) => Promise<void>;
  putSymbol: (symbol: StoredStockSymbol) => Promise<void>;
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
    getSymbolByCodeRegion: (code, region) =>
      getByIndex<StoredStockSymbol>(db, stockPrepStores.symbols, "by_code_region", [code, region]),
    listCashBalances: () => getAll<CashBalance>(db, stockPrepStores.cash),
    listDailyPrices: () => getAll<DailyPriceBar>(db, stockPrepStores.dailyPrices),
    listExchangeRates: () => getAll<ExchangeRateBar>(db, stockPrepStores.exchangeRates),
    listHoldings: () => getAll<PortfolioHolding>(db, stockPrepStores.holdings),
    listSymbols: () => getAll<StoredStockSymbol>(db, stockPrepStores.symbols),
    putCashBalance: (cashBalance) => putValue(db, stockPrepStores.cash, cashBalance),
    putDailyPrice: (price) => putValue(db, stockPrepStores.dailyPrices, price),
    putExchangeRate: (rate) => putValue(db, stockPrepStores.exchangeRates, rate),
    putHolding: (holding) => putValue(db, stockPrepStores.holdings, holding),
    putSymbol: (symbol) => putValue(db, stockPrepStores.symbols, symbol),
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

export const dummyStockPrepSnapshot: StockPrepSnapshot = {
  cashBalances: [
    {
      amount: 331000,
      currency: "JPY",
      updatedAt: "2026-04-17T15:00:00+09:00",
    },
  ],
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
    {
      close: 163,
      currency: "JPY",
      date: "2026-04-17",
      high: 166,
      id: "jp-9432-2026-04-17",
      low: 160,
      open: 162,
      region: "JP",
      sourceSymbol: "9432.jp",
      symbolId: "jp-9432",
      volume: 181000000,
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
  holdings: [
    {
      averagePrice: 2840,
      currency: "JPY",
      id: "holding-jp-7203",
      quantity: 200,
      symbolId: "jp-7203",
      updatedAt: "2026-04-17T15:00:00+09:00",
    },
  ],
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
    {
      code: "9432",
      currency: "JPY",
      id: "jp-9432",
      name: "日本電信電話",
      region: "JP",
      source: "stooq",
      sourceSymbol: "9432.jp",
    },
  ],
};

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
}

async function clearAllStores(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(Object.values(stockPrepStores), "readwrite");
  const done = transactionDone(transaction);

  for (const storeName of Object.values(stockPrepStores)) {
    transaction.objectStore(storeName).clear();
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

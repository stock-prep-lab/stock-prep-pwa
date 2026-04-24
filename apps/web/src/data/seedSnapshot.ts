import type { StockPrepSnapshot } from "@stock-prep/shared";

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

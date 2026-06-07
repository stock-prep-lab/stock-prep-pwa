import { describe, expect, it } from "vitest";

import type {
  CashBalance,
  HoldingsPayload,
  ImportJobsPayload,
  LatestSummaryPayload,
  StoredStockSymbol,
  StoredSyncState,
} from "@stock-prep/shared";

import { buildHomePageData } from "./homePageData";

const symbols: StoredStockSymbol[] = [
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
];

const latestSummary: LatestSummaryPayload = {
  datasetVersion: "market-data-2026-06-07T12:00:00.000Z",
  exchangeRates: [
    {
      baseCurrency: "USD",
      close: 150,
      date: "2026-06-06",
      pair: "USDJPY",
      quoteCurrency: "JPY",
    },
  ],
  generatedAt: "2026-06-07T12:05:00.000Z",
  symbols: [
    {
      code: "7203",
      currency: "JPY",
      id: "jp-7203",
      lastClose: 3200,
      lastCloseDate: "2026-06-06",
      name: "トヨタ自動車",
      region: "JP",
      securityType: "stock",
      sourceSymbol: "7203.jp",
    },
    {
      code: "AAPL",
      currency: "USD",
      id: "us-aapl",
      lastClose: 210,
      lastCloseDate: "2026-06-06",
      name: "Apple",
      region: "US",
      securityType: "stock",
      sourceSymbol: "aapl.us",
    },
  ],
};

const holdingsPayload: HoldingsPayload = {
  cashBalances: [
    {
      amount: 100000,
      currency: "JPY",
      updatedAt: "2026-06-07T12:00:00.000Z",
    },
  ],
  holdings: [
    {
      averagePrice: 2800,
      currency: "JPY",
      id: "holding-1",
      quantity: 100,
      symbolId: "jp-7203",
      updatedAt: "2026-06-07T12:00:00.000Z",
    },
    {
      averagePrice: 180,
      currency: "USD",
      id: "holding-2",
      quantity: 10,
      symbolId: "us-aapl",
      updatedAt: "2026-06-07T12:00:00.000Z",
    },
  ],
  updatedAt: "2026-06-07T12:00:00.000Z",
};

const importJobsPayload: ImportJobsPayload = {
  datasetVersion: latestSummary.datasetVersion,
  generatedAt: latestSummary.generatedAt,
  jobs: [
    {
      dailyPriceCount: 0,
      datasetVersion: latestSummary.datasetVersion,
      exchangeRateCount: 0,
      fileName: "d_jp_txt.zip",
      finishedAt: "2026-06-07T12:03:00.000Z",
      id: "job-1",
      scopeId: "JP",
      startedAt: "2026-06-07T12:01:00.000Z",
      status: "completed",
      symbolCount: 2,
    },
  ],
};

const syncStates: Partial<Record<StoredSyncState["id"], StoredSyncState | null>> = {
  holdings: {
    datasetVersion: "2026-06-07T12:00:00.000Z",
    id: "holdings",
    syncedAt: "2026-06-07T12:06:00.000Z",
  },
  "latest-summary": {
    datasetVersion: latestSummary.datasetVersion,
    id: "latest-summary",
    syncedAt: "2026-06-07T12:05:30.000Z",
  },
  "user-symbols": {
    datasetVersion: "2026-06-07T12:04:00.000Z",
    id: "user-symbols",
    syncedAt: "2026-06-07T12:06:30.000Z",
  },
};

const cashBalances: CashBalance[] = holdingsPayload.cashBalances;

describe("buildHomePageData", () => {
  it("builds portfolio summary from latest prices and FX", () => {
    const result = buildHomePageData({
      cashBalances,
      holdings: holdingsPayload.holdings,
      importJobsPayload,
      latestSummary,
      symbols,
      syncStates,
      userSymbols: {
        holdingSymbolIds: ["jp-7203", "us-aapl"],
        recentSymbols: [],
        watchSymbolIds: ["jp-7203"],
        watchlist: [],
      },
    });

    expect(result.importStatusLabel).toBe("最新データ同期済み");
    expect(result.portfolioSummary).not.toBeNull();
    expect(result.portfolioSummary?.totalValueLabel).toBe("￥735,000.0");
    expect(result.portfolioSummary?.cashRatioLabel).toBe("13.6%");
    expect(result.portfolioSummary?.stockRatioLabel).toBe("86.4%");
    expect(result.portfolioSummary?.topHoldingLabel).toBe("7203 トヨタ自動車");
  });

  it("prioritizes watched and recent symbols as today's candidates and enriches latest price", () => {
    const result = buildHomePageData({
      cashBalances,
      holdings: holdingsPayload.holdings,
      importJobsPayload,
      latestSummary,
      symbols,
      syncStates,
      userSymbols: {
        holdingSymbolIds: ["jp-7203", "us-aapl"],
        recentSymbols: [
          {
            isHeld: true,
            isWatched: true,
            symbol: symbols[0],
            timestamp: "2026-06-07T12:04:00.000Z",
          },
          {
            isHeld: true,
            isWatched: false,
            symbol: symbols[1],
            timestamp: "2026-06-07T12:02:00.000Z",
          },
        ],
        watchSymbolIds: ["jp-7203"],
        watchlist: [
          {
            isHeld: true,
            isWatched: true,
            symbol: symbols[0],
            timestamp: "2026-06-07T12:01:00.000Z",
          },
        ],
      },
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.id).toBe("jp-7203");
    expect(result.candidates[0]?.lastCloseLabel).toBe("￥3,200.0");
    expect(result.candidates[0]?.reason).toContain("保有中かつウォッチ中");
    expect(result.recentSymbols[0]?.latestStatusLabel).toBe("終値取得済み");
    expect(result.recentSymbols[0]?.lastCloseLabel).toBe("￥3,200.0");
  });
});

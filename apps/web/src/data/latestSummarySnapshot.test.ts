import { describe, expect, it } from "vitest";

import type {
  CashBalance,
  LatestSummaryPayload,
  PortfolioHolding,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { buildLatestSummaryMarketSnapshot } from "./latestSummarySnapshot";

describe("buildLatestSummaryMarketSnapshot", () => {
  it("builds lightweight daily prices and exchange rates from latest summary", () => {
    const localSnapshot = {
      cashBalances: [createCashBalance(100_000)],
      holdings: [createHolding("jp-7203")],
      symbols: [
        createSymbol({
          code: "7203",
          id: "jp-7203",
          name: "トヨタ自動車",
        }),
      ],
    };
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
      ],
    };

    const snapshot = buildLatestSummaryMarketSnapshot({
      latestSummary,
      localSnapshot,
    });

    expect(snapshot.dailyPrices).toEqual([
      expect.objectContaining({
        close: 3200,
        date: "2026-06-06",
        high: 3200,
        low: 3200,
        open: 3200,
        symbolId: "jp-7203",
        volume: 0,
      }),
    ]);
    expect(snapshot.exchangeRates).toEqual([
      expect.objectContaining({
        close: 150,
        date: "2026-06-06",
        pair: "USDJPY",
      }),
    ]);
    expect(snapshot.symbols[0]).toEqual(
      expect.objectContaining({
        code: "7203",
        id: "jp-7203",
        source: "stooq",
      }),
    );
  });

  it("keeps local symbols when latest summary is unavailable", () => {
    const localSymbol = createSymbol({
      code: "AAPL",
      currency: "USD",
      id: "us-aapl",
      name: "Apple",
      region: "US",
    });

    const snapshot = buildLatestSummaryMarketSnapshot({
      latestSummary: null,
      localSnapshot: {
        cashBalances: [],
        holdings: [],
        symbols: [localSymbol],
      },
    });

    expect(snapshot.symbols).toEqual([localSymbol]);
    expect(snapshot.dailyPrices).toEqual([]);
    expect(snapshot.exchangeRates).toEqual([]);
  });
});

function createSymbol({
  code,
  currency = "JPY",
  id,
  name,
  region = "JP",
}: {
  code: string;
  currency?: StoredStockSymbol["currency"];
  id: string;
  name: string;
  region?: StoredStockSymbol["region"];
}): StoredStockSymbol {
  return {
    code,
    currency,
    id,
    name,
    region,
    source: "stooq",
    sourceSymbol: `${code.toLowerCase()}.${region.toLowerCase()}`,
  };
}

function createHolding(symbolId: string): PortfolioHolding {
  return {
    averagePrice: 3000,
    currency: "JPY",
    id: `holding-${symbolId}`,
    quantity: 100,
    symbolId,
    updatedAt: "2026-06-07T12:00:00.000Z",
  };
}

function createCashBalance(amount: number): CashBalance {
  return {
    amount,
    currency: "JPY",
    updatedAt: "2026-06-07T12:00:00.000Z",
  };
}

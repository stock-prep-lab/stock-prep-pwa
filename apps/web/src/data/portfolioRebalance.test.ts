import { describe, expect, it } from "vitest";

import type {
  CashBalance,
  CurrencyCode,
  DailyPriceBar,
  ExchangeRateBar,
  PortfolioHolding,
  StoredStockSymbol,
} from "@stock-prep/shared";

import {
  buildPortfolioValuation,
  buildPurchaseSimulation,
  buildRebalancePlan,
} from "@stock-prep/domain";

describe("portfolio and rebalance calculation", () => {
  it("calculates portfolio value, allocation, cash, and unrealized profit in JPY", () => {
    const valuation = buildPortfolioValuation({
      cashBalances: [createCashBalance({ amount: 10_000 })],
      dailyPrices: [createPrice({ close: 120, date: "2026-04-17", symbolId: "jp-7203" })],
      holdings: [createHolding({ averagePrice: 100, quantity: 200, symbolId: "jp-7203" })],
      symbols: [createSymbol({ code: "7203", id: "jp-7203", name: "トヨタ自動車" })],
    });

    expect(valuation.totalHoldingsValueJpy).toBe(24_000);
    expect(valuation.totalCashValueJpy).toBe(10_000);
    expect(valuation.totalAssetValueJpy).toBe(34_000);
    expect(valuation.totalUnrealizedProfitJpy).toBe(4_000);
    expect(valuation.holdings[0]?.allocationRatio).toBeCloseTo(24_000 / 34_000);
    expect(valuation.issues).toEqual([]);
  });

  it("converts foreign holdings to JPY when exchange rates are available", () => {
    const valuation = buildPortfolioValuation({
      cashBalances: [],
      dailyPrices: [
        createPrice({
          close: 110,
          currency: "USD",
          date: "2026-04-17",
          region: "US",
          symbolId: "us-aapl",
        }),
      ],
      exchangeRates: [createExchangeRate({ close: 150, date: "2026-04-17", pair: "USDJPY" })],
      holdings: [
        createHolding({
          averagePrice: 100,
          currency: "USD",
          quantity: 10,
          symbolId: "us-aapl",
        }),
      ],
      symbols: [
        createSymbol({
          code: "AAPL",
          currency: "USD",
          id: "us-aapl",
          name: "Apple",
          region: "US",
        }),
      ],
    });

    expect(valuation.holdings[0]?.marketValueJpy).toBe(165_000);
    expect(valuation.holdings[0]?.costBasisJpy).toBe(150_000);
    expect(valuation.holdings[0]?.unrealizedProfitJpy).toBe(15_000);
  });

  it("marks foreign holdings as unvalued when exchange rates are missing", () => {
    const valuation = buildPortfolioValuation({
      cashBalances: [],
      dailyPrices: [
        createPrice({
          close: 110,
          currency: "USD",
          date: "2026-04-17",
          region: "US",
          symbolId: "us-aapl",
        }),
      ],
      holdings: [
        createHolding({
          averagePrice: 100,
          currency: "USD",
          quantity: 10,
          symbolId: "us-aapl",
        }),
      ],
      symbols: [
        createSymbol({
          code: "AAPL",
          currency: "USD",
          id: "us-aapl",
          name: "Apple",
          region: "US",
        }),
      ],
    });

    expect(valuation.holdings[0]?.status).toBe("missing-rate");
    expect(valuation.holdings[0]?.marketValueJpy).toBeNull();
    expect(valuation.issues[0]?.kind).toBe("missing-rate");
  });

  it("builds rebalance proposals from cash and screening candidates", () => {
    const plan = buildRebalancePlan({
      cashBalances: [createCashBalance({ amount: 120_000 })],
      dailyPrices: [
        ...createPriceSeries({
          closeForDay: () => 500,
          symbolId: "jp-7203",
        }),
        ...createPriceSeries({
          closeForDay: (day) => (day === 0 ? 100 : day === 126 ? 118 : day === 252 ? 145 : 150),
          symbolId: "jp-9432",
        }),
      ],
      holdings: [createHolding({ averagePrice: 450, quantity: 200, symbolId: "jp-7203" })],
      symbols: [
        createSymbol({ code: "7203", id: "jp-7203", name: "トヨタ自動車" }),
        createSymbol({ code: "9432", id: "jp-9432", name: "日本電信電話" }),
      ],
    });

    expect(plan.portfolio.totalCashValueJpy).toBe(120_000);
    expect(plan.proposals.length).toBeGreaterThan(0);
    expect(plan.proposals[0]?.purchaseAmountJpy).toBeGreaterThan(0);
    expect(plan.proposals[0]?.cashAfterJpy).toBeLessThan(120_000);
  });

  it("calculates before and after allocation for a purchase simulation", () => {
    const symbol = createSymbol({ code: "9432", id: "jp-9432", name: "日本電信電話" });
    const portfolio = buildPortfolioValuation({
      cashBalances: [createCashBalance({ amount: 100_000 })],
      dailyPrices: [
        createPrice({ close: 1_000, date: "2026-04-17", symbolId: "jp-7203" }),
        createPrice({ close: 100, date: "2026-04-17", symbolId: "jp-9432" }),
      ],
      holdings: [createHolding({ averagePrice: 900, quantity: 100, symbolId: "jp-7203" })],
      symbols: [createSymbol({ code: "7203", id: "jp-7203", name: "トヨタ自動車" }), symbol],
    });

    const simulation = buildPurchaseSimulation({
      portfolio,
      purchasePrice: 100,
      quantity: 500,
      symbol,
    });

    expect(simulation.status).toBe("ready");
    expect(simulation.purchaseAmountJpy).toBe(50_000);
    expect(simulation.cashBeforeJpy).toBe(100_000);
    expect(simulation.cashAfterJpy).toBe(50_000);
    expect(simulation.targetAllocationBeforeRatio).toBe(0);
    expect(simulation.targetAllocationAfterRatio).toBeCloseTo(50_000 / 200_000);
    expect(
      simulation.afterAllocations.find((item) => item.label === "日本電信電話")?.valueJpy,
    ).toBe(50_000);
  });

  it("converts foreign purchase simulations to JPY", () => {
    const symbol = createSymbol({
      code: "AAPL",
      currency: "USD",
      id: "us-aapl",
      name: "Apple",
      region: "US",
    });
    const portfolio = buildPortfolioValuation({
      cashBalances: [createCashBalance({ amount: 200_000 })],
      dailyPrices: [],
      holdings: [],
      symbols: [symbol],
    });

    const simulation = buildPurchaseSimulation({
      exchangeRates: [createExchangeRate({ close: 150, date: "2026-04-17", pair: "USDJPY" })],
      portfolio,
      purchasePrice: 100,
      quantity: 3,
      symbol,
    });

    expect(simulation.status).toBe("ready");
    expect(simulation.exchangeRateToJpy).toBe(150);
    expect(simulation.purchaseAmountOriginal).toBe(300);
    expect(simulation.purchaseAmountJpy).toBe(45_000);
    expect(simulation.cashAfterJpy).toBe(155_000);
  });

  it("marks purchase simulations as insufficient cash when the purchase exceeds cash", () => {
    const symbol = createSymbol({ code: "9432", id: "jp-9432", name: "日本電信電話" });
    const portfolio = buildPortfolioValuation({
      cashBalances: [createCashBalance({ amount: 10_000 })],
      dailyPrices: [],
      holdings: [],
      symbols: [symbol],
    });

    const simulation = buildPurchaseSimulation({
      portfolio,
      purchasePrice: 100,
      quantity: 200,
      symbol,
    });

    expect(simulation.status).toBe("insufficient-cash");
    expect(simulation.purchaseAmountJpy).toBe(20_000);
    expect(simulation.cashAfterJpy).toBe(-10_000);
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
  currency?: CurrencyCode;
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

function createHolding({
  averagePrice,
  currency = "JPY",
  quantity,
  symbolId,
}: {
  averagePrice: number;
  currency?: CurrencyCode;
  quantity: number;
  symbolId: string;
}): PortfolioHolding {
  return {
    averagePrice,
    currency,
    id: `holding-${symbolId}`,
    quantity,
    symbolId,
    updatedAt: "2026-04-17T15:00:00+09:00",
  };
}

function createCashBalance({
  amount,
  currency = "JPY",
}: {
  amount: number;
  currency?: CurrencyCode;
}): CashBalance {
  return {
    amount,
    currency,
    updatedAt: "2026-04-17T15:00:00+09:00",
  };
}

function createExchangeRate({
  close,
  date,
  pair,
}: {
  close: number;
  date: string;
  pair: ExchangeRateBar["pair"];
}): ExchangeRateBar {
  return {
    baseCurrency: pair.replace("JPY", "") as ExchangeRateBar["baseCurrency"],
    close,
    date,
    id: `${pair}-${date}`,
    pair,
    quoteCurrency: "JPY",
  };
}

function createPrice({
  close,
  currency = "JPY",
  date,
  region = "JP",
  symbolId,
}: {
  close: number;
  currency?: CurrencyCode;
  date: string;
  region?: DailyPriceBar["region"];
  symbolId: string;
}): DailyPriceBar {
  return {
    close,
    currency,
    date,
    high: close * 1.02,
    id: `${symbolId}-${date}`,
    low: close * 0.98,
    open: close,
    region,
    sourceSymbol: `${symbolId.replace("jp-", "")}.jp`,
    symbolId,
    volume: 1_000_000,
  };
}

function createPriceSeries({
  closeForDay,
  symbolId,
}: {
  closeForDay: (day: number) => number;
  symbolId: string;
}): DailyPriceBar[] {
  return Array.from({ length: 274 }, (_, day) => {
    const close = closeForDay(day);
    const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10);
    return createPrice({ close, date, symbolId });
  });
}

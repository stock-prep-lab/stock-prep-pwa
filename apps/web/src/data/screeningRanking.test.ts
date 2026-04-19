import { describe, expect, it } from "vitest";

import type {
  CurrencyCode,
  DailyPriceBar,
  ExchangeRateBar,
  StoredStockSymbol,
} from "@stock-prep/shared";

import {
  buildScreeningCandidates,
  calculateAverageVolume,
  calculateChangeRate,
  calculateHighProximity,
  calculateMomentum,
} from "@stock-prep/domain";

describe("screening momentum ranking", () => {
  it("calculates 12-1 style momentum by skipping recent trading days", () => {
    const prices = createPriceSeries({
      closeForDay: (day) => (day === 0 ? 100 : day === 252 ? 130 : 110),
      days: 274,
      symbolId: "jp-7203",
    });

    expect(
      calculateMomentum(prices, {
        lookbackTradingDays: 252,
        skipRecentTradingDays: 21,
      }),
    ).toBeCloseTo(30);
  });

  it("returns null when there is not enough history for momentum", () => {
    const prices = createPriceSeries({
      closeForDay: () => 100,
      days: 20,
      symbolId: "jp-7203",
    });

    expect(
      calculateMomentum(prices, {
        lookbackTradingDays: 126,
        skipRecentTradingDays: 21,
      }),
    ).toBeNull();
  });

  it("calculates short term metrics from available real price bars", () => {
    const prices = createPriceSeries({
      closeForDay: (day) => (day === 0 ? 100 : day === 1 ? 110 : 120),
      days: 3,
      highForDay: () => 125,
      symbolId: "jp-7203",
      volumeForDay: (day) => 1_000 + day * 100,
    });

    expect(calculateChangeRate(prices)).toBeCloseTo((120 / 110 - 1) * 100);
    expect(calculateHighProximity(prices)).toBeCloseTo(96);
    expect(calculateAverageVolume(prices)).toBeCloseTo(1_100);
  });

  it("ranks symbols by screening score using stored daily prices", () => {
    const candidates = buildScreeningCandidates({
      dailyPrices: [
        ...createPriceSeries({
          closeForDay: (day) => (day === 0 ? 100 : day === 126 ? 118 : day === 252 ? 145 : 150),
          days: 274,
          highForDay: () => 152,
          symbolId: "jp-7203",
          volumeForDay: () => 30_000_000,
        }),
        ...createPriceSeries({
          closeForDay: (day) => (day === 0 ? 100 : day === 126 ? 95 : day === 252 ? 90 : 88),
          days: 274,
          highForDay: () => 140,
          symbolId: "jp-9432",
          volumeForDay: () => 5_000_000,
        }),
      ],
      symbols: [
        createSymbol({ code: "7203", id: "jp-7203", name: "トヨタ自動車" }),
        createSymbol({ code: "9432", id: "jp-9432", name: "日本電信電話" }),
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.symbol.code).toBe("7203");
    expect(candidates[0]?.rank).toBe(1);
    expect(candidates[0]?.metrics.momentum12_1).toBeCloseTo(45);
    expect(candidates[1]?.rank).toBe(2);
  });

  it("converts foreign liquidity value to JPY when exchange rates are available", () => {
    const candidates = buildScreeningCandidates({
      dailyPrices: createPriceSeries({
        closeForDay: () => 100,
        currency: "USD",
        days: 274,
        region: "US",
        sourceSymbol: "aapl.us",
        symbolId: "us-aapl",
        volumeForDay: () => 1_000_000,
      }),
      exchangeRates: [createExchangeRate({ close: 150, date: "2026-04-17", pair: "USDJPY" })],
      symbols: [
        createSymbol({
          code: "AAPL",
          currency: "USD",
          id: "us-aapl",
          name: "Apple",
          region: "US",
          sourceSymbol: "aapl.us",
        }),
      ],
    });

    expect(candidates[0]?.metrics.liquidityValueJpy).toBe(15_000_000_000);
  });
});

function createSymbol({
  code,
  currency = "JPY",
  id,
  name,
  region = "JP",
  sourceSymbol = `${code}.jp`,
}: {
  code: string;
  currency?: CurrencyCode;
  id: string;
  name: string;
  region?: StoredStockSymbol["region"];
  sourceSymbol?: string;
}): StoredStockSymbol {
  return {
    code,
    currency,
    id,
    name,
    region,
    source: "stooq",
    sourceSymbol,
  };
}

function createPriceSeries({
  closeForDay,
  currency = "JPY",
  days,
  highForDay = closeForDay,
  region = "JP",
  sourceSymbol,
  symbolId,
  volumeForDay = () => 1_000_000,
}: {
  closeForDay: (day: number) => number;
  currency?: CurrencyCode;
  days: number;
  highForDay?: (day: number) => number;
  region?: DailyPriceBar["region"];
  sourceSymbol?: string;
  symbolId: string;
  volumeForDay?: (day: number) => number;
}): DailyPriceBar[] {
  return Array.from({ length: days }, (_, day) => {
    const close = closeForDay(day);
    const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10);

    return {
      close,
      currency,
      date,
      high: highForDay(day),
      id: `${symbolId}-${date}`,
      low: close * 0.98,
      open: close * 0.99,
      region,
      sourceSymbol: sourceSymbol ?? `${symbolId.replace("jp-", "")}.jp`,
      symbolId,
      volume: volumeForDay(day),
    };
  });
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

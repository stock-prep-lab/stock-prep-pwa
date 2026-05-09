import { describe, expect, it } from "vitest";

import type { StockDetailPayload } from "@stock-prep/shared";

import {
  buildStockDetailPageData,
  defaultStopLossRatio,
} from "./stockDetailData";

describe("stockDetailData", () => {
  it("builds moving averages and overlay lines from history", () => {
    const payload: StockDetailPayload = {
      datasetVersion: "market-data-2026-05-09",
      generatedAt: "2026-05-09T09:00:00.000Z",
      holding: {
        averagePrice: 100,
        currency: "JPY",
        id: "holding-jp-7203",
        quantity: 10,
        symbolId: "jp-7203",
        updatedAt: "2026-05-09T09:00:00.000Z",
      },
      importStatus: "ready",
      latestExchangeRate: null,
      priceHistory: Array.from({ length: 80 }, (_, index) => {
        const close = 100 + index;

        return {
          close,
          currency: "JPY" as const,
          date: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
          high: close + 3,
          id: `jp-7203-2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
          low: close - 2,
          open: close - 1,
          region: "JP" as const,
          sourceSymbol: "7203.jp",
          symbolId: "jp-7203",
          volume: 1_000 + index,
        };
      }).sort((left, right) => left.date.localeCompare(right.date)),
      symbol: {
        code: "7203",
        currency: "JPY",
        id: "jp-7203",
        lastClose: 179,
        lastCloseDate: "2026-03-28",
        name: "7203",
        region: "JP",
        securityType: "stock",
        sourceSymbol: "7203.jp",
      },
    };

    const detail = buildStockDetailPageData(payload);

    expect(detail.chartData.candlesticks).toHaveLength(80);
    expect(detail.chartData.ma25).toHaveLength(56);
    expect(detail.chartData.ma75).toHaveLength(6);
    expect(detail.chartData.buyPrice?.[0]?.value).toBe(100);
    expect(detail.chartData.stopLoss?.[0]?.value).toBe(100 * defaultStopLossRatio);
    expect(detail.chartData.recentHigh?.at(-1)?.value).toBeGreaterThan(0);
    expect(detail.trendSignals.map((signal) => signal.label)).toEqual([
      "25MA",
      "75MA",
      "RSI(14)",
      "MACD(12,26,9)",
      "ボリンジャー(20,±2σ)",
    ]);
    expect(detail.insightLines.length).toBeGreaterThan(0);
    expect(detail.priceMetrics[0]?.label).toBe("終値");
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  handleDatasetVersionRequest,
  handleGetHoldingsRequest,
  handleMarketDataRequest,
  handleUpsertHoldingRequest,
  resetStockPrepApiServerState,
} from "./stockPrepApiHandlers";

describe("stockPrepApiHandlers", () => {
  beforeEach(() => {
    resetStockPrepApiServerState();
  });

  it("returns shouldSync=false when the local dataset version is current", async () => {
    const current = await handleDatasetVersionRequest();

    await expect(
      handleDatasetVersionRequest({ localDatasetVersion: current.datasetVersion }),
    ).resolves.toEqual({
      datasetVersion: current.datasetVersion,
      generatedAt: current.generatedAt,
      shouldSync: false,
    });
  });

  it("returns market data seeded from the server state", async () => {
    const payload = await handleMarketDataRequest();

    expect(payload.symbols.length).toBeGreaterThan(0);
    expect(payload.dailyPrices.length).toBeGreaterThan(0);
    expect(payload.exchangeRates.length).toBeGreaterThan(0);
    expect(payload.datasetVersion).toBe("server-market-v1");
  });

  it("returns the current holdings payload", async () => {
    const payload = await handleGetHoldingsRequest();

    expect(payload.holdings).toHaveLength(1);
    expect(payload.cashBalances).toHaveLength(1);
    expect(payload.updatedAt).toMatch(/^2026-04-17/);
  });

  it("upserts a holding and returns the updated holdings payload", async () => {
    const payload = await handleUpsertHoldingRequest({
      averagePrice: 190,
      quantity: 300,
      symbolId: "jp-9432",
    });

    expect(payload.holdings).toHaveLength(2);
    expect(payload.holdings.find((holding) => holding.symbolId === "jp-9432")).toMatchObject({
      averagePrice: 190,
      currency: "JPY",
      quantity: 300,
      symbolId: "jp-9432",
    });
    expect(payload.updatedAt).not.toBe("2026-04-17T15:00:00+09:00");
  });
});

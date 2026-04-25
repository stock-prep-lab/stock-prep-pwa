import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";

import {
  handleDatasetVersionRequest,
  handleGetHoldingsRequest,
  handleImportMarketZipRequest,
  handleListImportJobsRequest,
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

  it("imports a JP ZIP and exposes the resulting import job state", async () => {
    const zip = new JSZip();
    zip.file(
      "data/daily/jp/tse stocks/1/7203.jp.txt",
      [
        "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
        "7203.JP,D,20260418,000000,3220,3250,3210,3242,30000000,0",
      ].join("\n"),
    );
    const zipBytes = await zip.generateAsync({ type: "uint8array" });

    const job = await handleImportMarketZipRequest({
      fileName: "d_jp_txt.zip",
      scopeId: "JP",
      zipBytes,
    });
    const jobsPayload = await handleListImportJobsRequest();
    const marketDataPayload = await handleMarketDataRequest();

    expect(job.status).toBe("succeeded");
    expect(jobsPayload.jobs[0]).toMatchObject({
      fileName: "d_jp_txt.zip",
      scopeId: "JP",
      status: "succeeded",
      symbolCount: 1,
    });
    expect(marketDataPayload.datasetVersion).toContain("market-data-");
    expect(marketDataPayload.symbols.find((symbol) => symbol.id === "jp-7203")).toMatchObject({
      code: "7203",
      securityType: "stock",
    });
  });
});

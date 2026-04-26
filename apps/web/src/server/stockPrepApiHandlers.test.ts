import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";

import {
  handleCreateImportUploadSessionRequest,
  handleDatasetVersionRequest,
  handleGetHoldingsRequest,
  handleImportMarketZipRequest,
  handleListImportJobsRequest,
  handleMarketDataRequest,
  handleUpsertHoldingRequest,
  resetStockPrepApiServerState,
} from "./stockPrepApiHandlers";

describe("stockPrepApiHandlers", () => {
  const originalEnv = {
    STOCK_PREP_R2_ACCOUNT_ID: process.env.STOCK_PREP_R2_ACCOUNT_ID,
    STOCK_PREP_R2_ACCESS_KEY_ID: process.env.STOCK_PREP_R2_ACCESS_KEY_ID,
    STOCK_PREP_R2_BUCKET: process.env.STOCK_PREP_R2_BUCKET,
    STOCK_PREP_R2_SECRET_ACCESS_KEY: process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY,
    STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY: process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY,
    STOCK_PREP_SUPABASE_URL: process.env.STOCK_PREP_SUPABASE_URL,
  };

  beforeEach(() => {
    resetStockPrepApiServerState();
    clearRemoteEnv();
  });

  it("returns a direct R2 upload session when remote env is configured", async () => {
    process.env.STOCK_PREP_SUPABASE_URL = "https://example.supabase.co";
    process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.STOCK_PREP_R2_ACCOUNT_ID = "account-id";
    process.env.STOCK_PREP_R2_ACCESS_KEY_ID = "access-key-id";
    process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY = "secret-access-key";
    process.env.STOCK_PREP_R2_BUCKET = "bucket-name";

    try {
      const session = await handleCreateImportUploadSessionRequest({
        contentType: "application/zip",
        fileName: "d_jp_txt.zip",
        fileSize: 1024,
        scopeId: "JP",
      });

      expect(session.mode).toBe("direct-r2");

      if (session.mode === "direct-r2") {
        expect(session.uploadMethod).toBe("PUT");
        expect(session.uploadHeaders["Content-Type"]).toBe("application/zip");
        expect(session.uploadUrl).toContain("/incoming/jp/");
        expect(session.finalizeToken).toContain(".");
      }
    } finally {
      restoreRemoteEnv(originalEnv);
    }
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

    expect(job.status).toBe("completed");
    expect(jobsPayload.jobs[0]).toMatchObject({
      fileName: "d_jp_txt.zip",
      scopeId: "JP",
      status: "completed",
      symbolCount: 1,
    });
    expect(marketDataPayload.datasetVersion).toContain("market-data-");
    expect(marketDataPayload.symbols.find((symbol) => symbol.id === "jp-7203")).toMatchObject({
      code: "7203",
      securityType: "stock",
    });
  });
});

function clearRemoteEnv() {
  delete process.env.STOCK_PREP_SUPABASE_URL;
  delete process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STOCK_PREP_R2_ACCOUNT_ID;
  delete process.env.STOCK_PREP_R2_ACCESS_KEY_ID;
  delete process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY;
  delete process.env.STOCK_PREP_R2_BUCKET;
}

function restoreRemoteEnv(env: Record<string, string | undefined>) {
  process.env.STOCK_PREP_SUPABASE_URL = env.STOCK_PREP_SUPABASE_URL;
  process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY = env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY;
  process.env.STOCK_PREP_R2_ACCOUNT_ID = env.STOCK_PREP_R2_ACCOUNT_ID;
  process.env.STOCK_PREP_R2_ACCESS_KEY_ID = env.STOCK_PREP_R2_ACCESS_KEY_ID;
  process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY = env.STOCK_PREP_R2_SECRET_ACCESS_KEY;
  process.env.STOCK_PREP_R2_BUCKET = env.STOCK_PREP_R2_BUCKET;
}

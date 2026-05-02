import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type { ImportJobRecord, MarketDataPayload } from "@stock-prep/shared";

import {
  processClaimedImportJob,
  runStockPrepImportWorker,
  type StockPrepImportWorkerStore,
} from "./stockPrepImportWorker";

describe("stockPrepImportWorker", () => {
  it("claims a queued job and marks it completed", async () => {
    const job = createQueuedJob();
    const store = createFakeWorkerStore({
      currentMarketData: {
        dailyPrices: [],
        datasetVersion: "market-data-empty",
        exchangeRates: [],
        generatedAt: new Date(0).toISOString(),
        symbols: [],
      },
      jobs: [job],
      rawZipByKey: new Map([[job.rawObjectKey, await createZipBytes()]]),
    });

    const result = await runStockPrepImportWorker({
      maxJobs: 1,
      store,
    });

    expect(result.processedJobs).toBe(1);
    expect(result.completedJobs).toHaveLength(1);
    expect(result.failedJobs).toHaveLength(0);
    expect(store.completedJobs[0]).toMatchObject({
      scopeId: "JP",
      status: "completed",
      symbolCount: 1,
    });
    expect(store.datasetStateStatuses).toEqual(["importing"]);
    expect(store.deletedRawZipKeys).toEqual([job.rawObjectKey]);
    expect(store.persistedArtifacts).toHaveLength(1);
  });

  it("marks the job failed when import processing throws", async () => {
    const job = createQueuedJob();
    const store = createFakeWorkerStore({
      currentMarketData: {
        dailyPrices: [],
        datasetVersion: "market-data-empty",
        exchangeRates: [],
        generatedAt: new Date(0).toISOString(),
        symbols: [],
      },
      jobs: [job],
      rawZipByKey: new Map([[job.rawObjectKey, new Uint8Array([1, 2, 3])]]),
    });

    const failedJob = await processClaimedImportJob({
      job,
      now: () => "2026-04-26T12:00:00.000Z",
      store,
    });

    expect(failedJob.status).toBe("failed");
    expect(store.failedJobs[0]?.errorMessage).toBeDefined();
    expect(store.datasetStateStatuses).toEqual(["importing", "failed"]);
    expect(store.deletedRawZipKeys).toEqual([job.rawObjectKey]);
  });

  it("touches heartbeat while a job is processing", async () => {
    const job = createQueuedJob();
    const store = createFakeWorkerStore({
      currentMarketData: {
        dailyPrices: [],
        datasetVersion: "market-data-empty",
        exchangeRates: [],
        generatedAt: new Date(0).toISOString(),
        symbols: [],
      },
      jobs: [job],
      loadRawZipDelayMs: 20,
      rawZipByKey: new Map([[job.rawObjectKey, await createZipBytes()]]),
    });

    await processClaimedImportJob({
      heartbeatIntervalMs: 5,
      job,
      store,
    });

    expect(store.heartbeatTouches).toContain(job.id);
  });

  it("emits progress logs while processing a job", async () => {
    const job = createQueuedJob();
    const store = createFakeWorkerStore({
      currentMarketData: {
        dailyPrices: [],
        datasetVersion: "market-data-empty",
        exchangeRates: [],
        generatedAt: new Date(0).toISOString(),
        symbols: [],
      },
      jobs: [job],
      rawZipByKey: new Map([[job.rawObjectKey, await createZipBytes()]]),
    });
    const messages: string[] = [];

    await processClaimedImportJob({
      job,
      logger: {
        error(message) {
          messages.push(`error:${message}`);
        },
        info(message) {
          messages.push(`info:${message}`);
        },
      },
      store,
    });

    expect(messages.some((message) => message.includes("current artifact と raw ZIP を読み込みます"))).toBe(true);
    expect(messages.some((message) => message.includes("ZIP を正規化します"))).toBe(true);
    expect(messages.some((message) => message.includes("既存 artifact を cleanup します"))).toBe(true);
    expect(messages.some((message) => message.includes("新しい artifact を保存します"))).toBe(true);
    expect(messages.some((message) => message.includes("完了しました"))).toBe(true);
  });
});

function createFakeWorkerStore({
  currentMarketData,
  jobs,
  loadRawZipDelayMs,
  rawZipByKey,
}: {
  currentMarketData: MarketDataPayload;
  jobs: Array<ImportJobRecord & { rawObjectKey: string }>;
  loadRawZipDelayMs?: number;
  rawZipByKey: Map<string, Uint8Array>;
}): StockPrepImportWorkerStore & {
  completedJobs: ImportJobRecord[];
  datasetStateStatuses: string[];
  deletedRawZipKeys: string[];
  failedJobs: ImportJobRecord[];
  heartbeatTouches: string[];
  persistedArtifacts: Array<{
    generatedAt: string;
    marketData: MarketDataPayload;
  }>;
} {
  const queue = [...jobs];
  const completedJobs: ImportJobRecord[] = [];
  const failedJobs: ImportJobRecord[] = [];
  const datasetStateStatuses: string[] = [];
  const deletedRawZipKeys: string[] = [];
  const heartbeatTouches: string[] = [];
  const persistedArtifacts: Array<{
    generatedAt: string;
    marketData: MarketDataPayload;
  }> = [];

  return {
    completedJobs,
    datasetStateStatuses,
    deletedRawZipKeys,
    async deleteCurrentArtifacts() {
      return;
    },
    async deleteRawZip(rawObjectKey) {
      deletedRawZipKeys.push(rawObjectKey);
      rawZipByKey.delete(rawObjectKey);
    },
    failedJobs,
    heartbeatTouches,
    async claimNextQueuedJob() {
      return queue.shift() ?? null;
    },
    async loadCurrentArtifacts() {
      return {
        manifest: null,
        marketData: currentMarketData,
      };
    },
    async loadRawZip(rawObjectKey) {
      if (loadRawZipDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, loadRawZipDelayMs));
      }

      const bytes = rawZipByKey.get(rawObjectKey);

      if (!bytes) {
        throw new Error(`missing raw zip: ${rawObjectKey}`);
      }

      return bytes;
    },
    async markDatasetStateFailed() {
      datasetStateStatuses.push("failed");
    },
    async markDatasetStateImporting() {
      datasetStateStatuses.push("importing");
    },
    async markJobCompleted(job) {
      completedJobs.push(job);
    },
    async markJobFailed(job) {
      failedJobs.push(job);
    },
    persistedArtifacts,
    async persistCurrentArtifacts({ generatedAt, marketData }) {
      persistedArtifacts.push({
        generatedAt,
        marketData,
      });
      currentMarketData = marketData;
    },
    async touchJobHeartbeat(jobId) {
      heartbeatTouches.push(jobId);
    },
  };
}

async function createZipBytes(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "data/daily/jp/tse stocks/1/7203.jp.txt",
    [
      "<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>",
      "7203.JP,D,20260418,000000,3220,3250,3210,3242,30000000,0",
    ].join("\n"),
  );

  return zip.generateAsync({ type: "uint8array" });
}

function createQueuedJob(): ImportJobRecord & { rawObjectKey: string } {
  return {
    dailyPriceCount: 0,
    datasetVersion: undefined,
    errorMessage: undefined,
    exchangeRateCount: 0,
    fileName: "d_jp_txt.zip",
    id: "job-jp-1",
    manifestKey: undefined,
    rawObjectKey: "incoming/jp/job-jp-1-d_jp_txt.zip",
    scopeId: "JP",
    startedAt: "2026-04-26T10:00:00.000Z",
    status: "processing",
    symbolCount: 0,
  };
}

import type { ImportJobRecord, MarketDataPayload } from "@stock-prep/shared";

import {
  claimNextQueuedImportJob,
  createSupabaseAdminClient,
  getImportJobHeartbeatIntervalMs,
  loadLatestDatasetState,
  persistDatasetState,
  touchImportJobHeartbeat,
  updateDatasetStateStatus,
  updateImportJob,
  type QueuedImportJob,
} from "./stockPrepBackend.js";
import {
  buildLatestSummaryPayload,
  createEmptyMarketDataPayload,
  importBulkScopeFromZip,
  type StockPrepMarketDataManifest,
} from "./stockPrepImport.js";
import { forEachWithConcurrency } from "./asyncConcurrency.js";
import { loadPersistedMarketData, planPersistedMarketData } from "./stockPrepMarketDataStorage.js";
import {
  createR2Client,
  deleteObject,
  getBinaryObject,
  getJsonObject,
  putJsonObject,
} from "./stockPrepR2.js";

const currentManifestKey = "current/manifest.json";
const currentMarketDataKey = "current/market-data.json";
const currentLatestSummaryKey = "current/latest-summary.json";
const artifactDeleteConcurrency = 4;

type PersistedCurrentArtifacts = {
  manifest: StockPrepMarketDataManifest | null;
  marketData: MarketDataPayload;
};

export type StockPrepImportWorkerStore = {
  claimNextQueuedJob(): Promise<QueuedImportJob | null>;
  deleteCurrentArtifacts(): Promise<void>;
  deleteRawZip(rawObjectKey: string): Promise<void>;
  loadCurrentArtifacts(): Promise<PersistedCurrentArtifacts>;
  loadRawZip(rawObjectKey: string): Promise<Uint8Array>;
  markDatasetStateFailed(): Promise<void>;
  markDatasetStateImporting(): Promise<void>;
  markJobCompleted(job: ImportJobRecord): Promise<void>;
  markJobFailed(job: ImportJobRecord): Promise<void>;
  persistCurrentArtifacts(args: {
    generatedAt: string;
    manifest: StockPrepMarketDataManifest;
    marketData: MarketDataPayload;
  }): Promise<void>;
  touchJobHeartbeat(jobId: string): Promise<void>;
};

export type StockPrepImportWorkerRunResult = {
  completedJobs: ImportJobRecord[];
  failedJobs: ImportJobRecord[];
  processedJobs: number;
};

export async function runStockPrepImportWorker({
  maxJobs = Number.POSITIVE_INFINITY,
  store = createRemoteStockPrepImportWorkerStore(),
}: {
  maxJobs?: number;
  store?: StockPrepImportWorkerStore;
} = {}): Promise<StockPrepImportWorkerRunResult> {
  const completedJobs: ImportJobRecord[] = [];
  const failedJobs: ImportJobRecord[] = [];
  let processedJobs = 0;

  while (processedJobs < maxJobs) {
    const claimedJob = await store.claimNextQueuedJob();

    if (!claimedJob) {
      break;
    }

    processedJobs += 1;

    const finishedJob = await processClaimedImportJob({
      job: claimedJob,
      store,
    });

    if (finishedJob.status === "completed") {
      completedJobs.push(finishedJob);
    } else {
      failedJobs.push(finishedJob);
    }
  }

  return {
    completedJobs,
    failedJobs,
    processedJobs,
  };
}

export async function processClaimedImportJob({
  heartbeatIntervalMs = getImportJobHeartbeatIntervalMs(),
  job,
  now = () => new Date().toISOString(),
  store,
}: {
  heartbeatIntervalMs?: number;
  job: QueuedImportJob;
  now?: () => string;
  store: StockPrepImportWorkerStore;
}): Promise<ImportJobRecord> {
  await store.markDatasetStateImporting().catch(() => undefined);
  const heartbeatHandle = setInterval(() => {
    void store.touchJobHeartbeat(job.id).catch(() => undefined);
  }, heartbeatIntervalMs);
  heartbeatHandle.unref?.();

  try {
    const [currentArtifacts, zipBytes] = await Promise.all([
      store.loadCurrentArtifacts(),
      store.loadRawZip(job.rawObjectKey),
    ]);
    const generatedAt = now();
    const importResult = await importBulkScopeFromZip({
      currentMarketData: currentArtifacts.marketData,
      generatedAt,
      referenceSymbols: currentArtifacts.marketData.symbols,
      scopeId: job.scopeId,
      zipBytes,
    });
    const manifest: StockPrepMarketDataManifest = {
      datasetVersion: importResult.marketData.datasetVersion,
      generatedAt,
      latestSummaryKey: currentLatestSummaryKey,
      marketDataKey: currentMarketDataKey,
      runId: `${generatedAt.replace(/[:.]/g, "-")}-${job.scopeId.toLowerCase()}`,
      scopeSummaries: {
        ...(currentArtifacts.manifest?.scopeSummaries ?? {}),
        [job.scopeId]: importResult.summary,
      },
    };

    await store.deleteCurrentArtifacts();
    await store.persistCurrentArtifacts({
      generatedAt,
      manifest,
      marketData: importResult.marketData,
    });

    const completedJob: ImportJobRecord = {
      dailyPriceCount: importResult.summary.dailyPriceCount,
      datasetVersion: importResult.marketData.datasetVersion,
      errorMessage: undefined,
      exchangeRateCount: importResult.summary.exchangeRateCount,
      fileName: job.fileName,
      finishedAt: generatedAt,
      id: job.id,
      manifestKey: currentManifestKey,
      scopeId: job.scopeId,
      startedAt: job.startedAt,
      status: "completed",
      symbolCount: importResult.summary.symbolCount,
    };

    await store.markJobCompleted(completedJob);
    await store.deleteRawZip(job.rawObjectKey).catch(() => undefined);

    return completedJob;
  } catch (error) {
    const failedAt = now();
    const failedJob: ImportJobRecord = {
      dailyPriceCount: 0,
      datasetVersion: undefined,
      errorMessage: error instanceof Error ? error.message : "Import worker failed.",
      exchangeRateCount: 0,
      fileName: job.fileName,
      finishedAt: failedAt,
      id: job.id,
      manifestKey: undefined,
      scopeId: job.scopeId,
      startedAt: job.startedAt,
      status: "failed",
      symbolCount: 0,
    };

    await store.markJobFailed(failedJob).catch(() => undefined);
    await store.markDatasetStateFailed().catch(() => undefined);
    await store.deleteRawZip(job.rawObjectKey).catch(() => undefined);

    return failedJob;
  } finally {
    clearInterval(heartbeatHandle);
  }
}

export function createRemoteStockPrepImportWorkerStore(): StockPrepImportWorkerStore {
  const supabase = createSupabaseAdminClient();
  const r2 = createR2Client();
  let currentArtifactKeys: string[] = [];

  return {
    async claimNextQueuedJob() {
      return claimNextQueuedImportJob({ supabase });
    },
    async deleteCurrentArtifacts() {
      const keys = [
        currentManifestKey,
        currentLatestSummaryKey,
        ...currentArtifactKeys,
      ];
      currentArtifactKeys = [];

      await forEachWithConcurrency({
        concurrency: artifactDeleteConcurrency,
        items: [...new Set(keys)],
        worker: async (key) => {
          await deleteObject({ key, r2 }).catch(() => undefined);
        },
      });
    },
    async deleteRawZip(rawObjectKey) {
      await deleteObject({
        key: rawObjectKey,
        r2,
      });
    },
    async loadCurrentArtifacts() {
      try {
        const latestState = await loadLatestDatasetState({ supabase });

        if (!latestState) {
          return {
            manifest: null,
            marketData: createEmptyMarketDataPayload(),
          };
        }

        const manifest = await getJsonObject<StockPrepMarketDataManifest>({
          key: latestState.latest_manifest_key,
          r2,
        });
        const persisted = await loadPersistedMarketData({
          key: manifest.marketDataKey,
          readJson: (key) => getJsonObject({ key, r2 }),
        });
        currentArtifactKeys = persisted.artifactKeys;

        return {
          manifest,
          marketData: persisted.marketData,
        };
      } catch {
        currentArtifactKeys = [];
        return {
          manifest: null,
          marketData: createEmptyMarketDataPayload(),
        };
      }
    },
    async loadRawZip(rawObjectKey) {
      return getBinaryObject({
        key: rawObjectKey,
        r2,
      });
    },
    async markDatasetStateFailed() {
      await updateDatasetStateStatus({
        status: "failed",
        supabase,
      });
    },
    async markDatasetStateImporting() {
      await updateDatasetStateStatus({
        status: "importing",
        supabase,
      });
    },
    async markJobCompleted(job) {
      await updateImportJob({
        job,
        supabase,
      });
    },
    async markJobFailed(job) {
      await updateImportJob({
        job,
        supabase,
      });
    },
    async persistCurrentArtifacts({ generatedAt, manifest, marketData }) {
      const persisted = planPersistedMarketData({
        baseKey: currentMarketDataKey,
        marketData,
      });

      for (const object of persisted.objects) {
        await putJsonObject({
          body: object.body,
          key: object.key,
          r2,
        });
      }

      await putJsonObject({
        body: buildLatestSummaryPayload(marketData),
        key: currentLatestSummaryKey,
        r2,
      });
      await putJsonObject({
        body: manifest,
        key: currentManifestKey,
        r2,
      });
      await persistDatasetState({
        generatedAt,
        manifestKey: currentManifestKey,
        marketDataKey: currentMarketDataKey,
        status: "ready",
        supabase,
        version: marketData.datasetVersion,
      });
      currentArtifactKeys = persisted.artifactKeys;
    },
    async touchJobHeartbeat(jobId) {
      await touchImportJobHeartbeat({
        jobId,
        supabase,
      });
    },
  };
}

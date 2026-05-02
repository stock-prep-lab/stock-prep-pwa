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

type StockPrepImportWorkerLogger = {
  error(message: string, error?: unknown): void;
  info(message: string): void;
};

type PersistedCurrentArtifacts = {
  manifest: StockPrepMarketDataManifest | null;
  marketData: MarketDataPayload;
};

export type StockPrepImportWorkerStore = {
  claimNextQueuedJob(): Promise<QueuedImportJob | null>;
  deleteCurrentArtifacts(scopeId: QueuedImportJob["scopeId"]): Promise<void>;
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
  logger = createDefaultWorkerLogger(),
  maxJobs = Number.POSITIVE_INFINITY,
  store = createRemoteStockPrepImportWorkerStore(),
}: {
  logger?: StockPrepImportWorkerLogger;
  maxJobs?: number;
  store?: StockPrepImportWorkerStore;
} = {}): Promise<StockPrepImportWorkerRunResult> {
  const completedJobs: ImportJobRecord[] = [];
  const failedJobs: ImportJobRecord[] = [];
  let processedJobs = 0;

  while (processedJobs < maxJobs) {
    logger.info("import worker: queue から次の job を取得します");
    const claimedJob = await store.claimNextQueuedJob();

    if (!claimedJob) {
      logger.info("import worker: 処理対象の job はありません");
      break;
    }

    processedJobs += 1;
    logger.info(
      `import worker: job を取得しました id=${claimedJob.id} scope=${claimedJob.scopeId} file=${claimedJob.fileName}`,
    );

    const finishedJob = await processClaimedImportJob({
      job: claimedJob,
      logger,
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
  logger = createDefaultWorkerLogger(),
  now = () => new Date().toISOString(),
  store,
}: {
  heartbeatIntervalMs?: number;
  job: QueuedImportJob;
  logger?: StockPrepImportWorkerLogger;
  now?: () => string;
  store: StockPrepImportWorkerStore;
}): Promise<ImportJobRecord> {
  let stage = "dataset_state:importing";
  await store.markDatasetStateImporting().catch(() => undefined);
  const heartbeatHandle = setInterval(() => {
    void store.touchJobHeartbeat(job.id).catch(() => undefined);
  }, heartbeatIntervalMs);
  heartbeatHandle.unref?.();

  try {
    stage = "load:current-artifacts-and-zip";
    logger.info(`import worker: job=${job.id} scope=${job.scopeId} current artifact と raw ZIP を読み込みます`);
    const [currentArtifacts, zipBytes] = await Promise.all([
      store.loadCurrentArtifacts(),
      store.loadRawZip(job.rawObjectKey),
    ]);
    logger.info(
      `import worker: job=${job.id} scope=${job.scopeId} raw ZIP を読み込みました bytes=${zipBytes.byteLength}`,
    );
    const generatedAt = now();
    stage = "normalize:zip";
    logger.info(`import worker: job=${job.id} scope=${job.scopeId} ZIP を正規化します`);
    const importResult = await importBulkScopeFromZip({
      currentMarketData: currentArtifacts.marketData,
      generatedAt,
      referenceSymbols: currentArtifacts.marketData.symbols,
      scopeId: job.scopeId,
      zipBytes,
    });
    logger.info(
      `import worker: job=${job.id} scope=${job.scopeId} 正規化完了 symbols=${importResult.summary.symbolCount} dailyPrices=${importResult.summary.dailyPriceCount} exchangeRates=${importResult.summary.exchangeRateCount}`,
    );
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

    stage = "cleanup:scope-artifacts";
    logger.info(`import worker: job=${job.id} scope=${job.scopeId} 既存 artifact を cleanup します`);
    await store.deleteCurrentArtifacts(job.scopeId);
    stage = "persist:scope-artifacts";
    logger.info(`import worker: job=${job.id} scope=${job.scopeId} 新しい artifact を保存します`);
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

    stage = "complete:update-job";
    await store.markJobCompleted(completedJob);
    stage = "cleanup:raw-zip";
    await store.deleteRawZip(job.rawObjectKey).catch(() => undefined);
    logger.info(`import worker: job=${job.id} scope=${job.scopeId} 完了しました`);

    return completedJob;
  } catch (error) {
    const failedAt = now();
    logger.error(
      `import worker: job=${job.id} scope=${job.scopeId} 失敗しました stage=${stage}`,
      error,
    );
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
  let currentArtifactKeysByScope: Partial<Record<QueuedImportJob["scopeId"], string[]>> = {};

  return {
    async claimNextQueuedJob() {
      return claimNextQueuedImportJob({ supabase });
    },
    async deleteCurrentArtifacts(scopeId) {
      const scopeKeys = currentArtifactKeysByScope[scopeId];
      const keys = scopeKeys && scopeKeys.length > 0 ? scopeKeys : currentArtifactKeys;
      currentArtifactKeysByScope = {
        ...currentArtifactKeysByScope,
        [scopeId]: [],
      };

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
        currentArtifactKeysByScope = persisted.artifactKeysByScope;

        return {
          manifest,
          marketData: persisted.marketData,
        };
      } catch {
        currentArtifactKeys = [];
        currentArtifactKeysByScope = {};
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
      currentArtifactKeysByScope = persisted.artifactKeysByScope;
    },
    async touchJobHeartbeat(jobId) {
      await touchImportJobHeartbeat({
        jobId,
        supabase,
      });
    },
  };
}

function createDefaultWorkerLogger(): StockPrepImportWorkerLogger {
  return {
    error(message, error) {
      if (error === undefined) {
        console.error(message);
        return;
      }

      console.error(message, error);
    },
    info(message) {
      console.log(message);
    },
  };
}

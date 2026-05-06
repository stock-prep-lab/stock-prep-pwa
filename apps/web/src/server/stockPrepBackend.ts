import { createHmac, timingSafeEqual } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CashBalance,
  CreateImportUploadSessionRequest,
  DatasetVersionPayload,
  FinalizeImportUploadRequest,
  HoldingsPayload,
  ImportJobRecord,
  ImportJobsPayload,
  ImportUploadSessionPayload,
  LatestSummaryPayload,
  MarketDataPayload,
  PortfolioHolding,
  UpsertHoldingRequest,
} from "@stock-prep/shared";

import { dummyStockPrepSnapshot } from "../data/seedSnapshot.js";
import type { StockPrepMarketDataManifest } from "./stockPrepImport.js";
import { buildLatestSummaryPayload } from "./stockPrepImport.js";
import { loadPersistedMarketData } from "./stockPrepMarketDataStorage.js";
import {
  assertObjectExists,
  createPresignedUploadUrl,
  createR2Client,
  deleteObject,
  getJsonObject,
  putBinaryObject,
} from "./stockPrepR2.js";

type StockPrepServerState = {
  holdingsPayload: HoldingsPayload;
  importJobs: ImportJobRecord[];
  marketDataPayload: MarketDataPayload;
  rawZipByJobId: Map<string, { rawObjectKey: string; zipBytes: Uint8Array }>;
};

export type DatasetStateRow = {
  dataset_version: string;
  generated_at: string;
  id: string;
  latest_manifest_key: string;
  market_data_key: string;
  status: "failed" | "importing" | "ready";
  updated_at: string;
};

export type ImportJobRow = {
  attempt_count: number;
  daily_price_count: number;
  dataset_version: string | null;
  error_message: string | null;
  exchange_rate_count: number;
  file_name: string;
  finished_at: string | null;
  heartbeat_at: string | null;
  id: string;
  manifest_key: string | null;
  processing_started_at: string | null;
  raw_object_key: string | null;
  scope_id: ImportJobRecord["scopeId"];
  started_at: string;
  status: ImportJobRecord["status"];
  symbol_count: number;
};

type HoldingRow = {
  average_price: number;
  currency: PortfolioHolding["currency"];
  id: string;
  quantity: number;
  symbol_id: string;
  updated_at: string;
};

type CashBalanceRow = {
  amount: number;
  currency: CashBalance["currency"];
  updated_at: string;
};

export type QueuedImportJob = ImportJobRecord & {
  rawObjectKey: string;
};

type StockPrepServerBackend = {
  createImportUploadSession(
    request: CreateImportUploadSessionRequest,
  ): Promise<ImportUploadSessionPayload>;
  finalizeImportUpload(request: FinalizeImportUploadRequest): Promise<ImportJobRecord>;
  getDatasetVersionPayload(args?: {
    localDatasetVersion?: string | null;
  }): Promise<DatasetVersionPayload>;
  getHoldingsPayload(): Promise<HoldingsPayload>;
  getImportJobsPayload(): Promise<ImportJobsPayload>;
  getLatestSummaryPayload(): Promise<LatestSummaryPayload>;
  getMarketDataPayload(): Promise<MarketDataPayload>;
  importMarketZip(args: {
    fileName: string;
    scopeId: ImportJobRecord["scopeId"];
    zipBytes: Uint8Array;
  }): Promise<ImportJobRecord>;
  upsertHolding(request: UpsertHoldingRequest): Promise<HoldingsPayload>;
};

type GlobalWithStockPrepServerState = typeof globalThis & {
  __stockPrepServerState__?: StockPrepServerState;
};

const defaultGeneratedAt = "2026-04-17T15:35:00+09:00";
const defaultMarketDatasetVersion = "server-market-v1";
const importUploadTokenTtlSeconds = 15 * 60;
const importJobHeartbeatIntervalMs = 60 * 1000;
const importJobStaleAfterMs = 10 * 60 * 1000;
const latestDatasetStateId = "latest";
const schemaGuidePath = "docs/setup/supabase-import-tables.sql";

const supabaseTableNames = {
  cashBalances: "stock_prep_cash_balances",
  datasetState: "stock_prep_dataset_state",
  holdings: "stock_prep_holdings",
  importJobs: "stock_prep_import_jobs",
} as const;

export function getStockPrepServerBackend(): StockPrepServerBackend {
  if (hasRemoteMarketDataEnv()) {
    return createRemoteBackend();
  }

  return createInMemoryBackend();
}

export function resetStockPrepServerBackendState(): void {
  const globalState = globalThis as GlobalWithStockPrepServerState;
  globalState.__stockPrepServerState__ = createDefaultServerState();
}

function createInMemoryBackend(): StockPrepServerBackend {
  return {
    async createImportUploadSession() {
      return {
        mode: "server-proxy",
        reason: "ローカル fallback ではサーバー経由アップロードを使います。",
      };
    },
    async finalizeImportUpload() {
      throw new Error("ローカル fallback では finalizeImportUpload を使いません。");
    },
    async getDatasetVersionPayload({ localDatasetVersion } = {}) {
      const { marketDataPayload } = getInMemoryState();

      return {
        datasetVersion: marketDataPayload.datasetVersion,
        generatedAt: marketDataPayload.generatedAt,
        shouldSync: localDatasetVersion !== marketDataPayload.datasetVersion,
      };
    },
    async getHoldingsPayload() {
      return structuredClone(getInMemoryState().holdingsPayload);
    },
    async getImportJobsPayload() {
      const { importJobs, marketDataPayload } = getInMemoryState();

      return {
        datasetVersion: marketDataPayload.datasetVersion,
        generatedAt: marketDataPayload.generatedAt,
        jobs: structuredClone(importJobs),
      };
    },
    async getLatestSummaryPayload() {
      return buildLatestSummaryPayload(structuredClone(getInMemoryState().marketDataPayload));
    },
    async getMarketDataPayload() {
      return structuredClone(getInMemoryState().marketDataPayload);
    },
    async importMarketZip({ fileName, scopeId, zipBytes }) {
      const state = getInMemoryState();
      const startedAt = new Date().toISOString();
      const runningJob = createImportJob({
        fileName,
        scopeId,
        startedAt,
        status: "processing",
      });

      state.importJobs = [runningJob, ...state.importJobs].slice(0, 20);

      try {
        const { importBulkScopeFromZip } = await import("./stockPrepImport.js");
        const result = await importBulkScopeFromZip({
          currentMarketData: state.marketDataPayload,
          generatedAt: startedAt,
          scopeId,
          zipBytes,
        });
        const manifestKey = `memory/runs/${result.marketData.datasetVersion}/manifest.json`;
        const completedJob = {
          ...runningJob,
          dailyPriceCount: result.summary.dailyPriceCount,
          datasetVersion: result.marketData.datasetVersion,
          exchangeRateCount: result.summary.exchangeRateCount,
          finishedAt: startedAt,
          manifestKey,
          status: "completed" as const,
          symbolCount: result.summary.symbolCount,
        };

        state.marketDataPayload = result.marketData;
        state.importJobs = replaceImportJob(state.importJobs, completedJob);

        return completedJob;
      } catch (error) {
        const failedJob = {
          ...runningJob,
          errorMessage: error instanceof Error ? error.message : "Import failed.",
          finishedAt: startedAt,
          status: "failed" as const,
        };

        state.importJobs = replaceImportJob(state.importJobs, failedJob);
        throw error;
      }
    },
    async upsertHolding(request) {
      validateHoldingRequest(request);

      const state = getInMemoryState();
      const symbol = state.marketDataPayload.symbols.find(
        (candidate) => candidate.id === request.symbolId,
      );

      if (!symbol) {
        throw new Error("保存対象の銘柄がサーバー側に存在しません。");
      }

      const updatedAt = new Date().toISOString();
      const nextHolding: PortfolioHolding = {
        averagePrice: request.averagePrice,
        currency: symbol.currency,
        id: `holding-${symbol.id}`,
        quantity: request.quantity,
        symbolId: symbol.id,
        updatedAt,
      };

      const filteredHoldings = state.holdingsPayload.holdings.filter(
        (holding) => holding.symbolId !== request.symbolId,
      );

      state.holdingsPayload = {
        ...state.holdingsPayload,
        holdings: [...filteredHoldings, nextHolding].sort((left, right) =>
          left.symbolId.localeCompare(right.symbolId),
        ),
        updatedAt,
      };

      return structuredClone(state.holdingsPayload);
    },
  };
}

function createRemoteBackend(): StockPrepServerBackend {
  const supabase = createSupabaseAdminClient();
  const r2 = createR2Client();
  const backend: StockPrepServerBackend = {
    async createImportUploadSession({ contentType, fileName, scopeId }) {
      const startedAt = new Date().toISOString();
      const jobId = crypto.randomUUID();
      const rawZipKey = buildRawZipKey({ fileName, jobId, scopeId });
      const normalizedContentType = normalizeZipContentType(contentType);
      const finalizeToken = createImportUploadFinalizeToken({
        fileName,
        jobId,
        rawObjectKey: rawZipKey,
        scopeId,
        startedAt,
      });
      const uploadUrl = await createPresignedUploadUrl({
        contentType: normalizedContentType,
        expiresInSeconds: importUploadTokenTtlSeconds,
        key: rawZipKey,
        r2,
      });

      return {
        expiresAt: new Date(Date.now() + importUploadTokenTtlSeconds * 1000).toISOString(),
        fileName,
        finalizeToken,
        jobId,
        mode: "direct-r2",
        scopeId,
        uploadHeaders: {
          "Content-Type": normalizedContentType,
        },
        uploadMethod: "PUT",
        uploadUrl,
      };
    },
    async finalizeImportUpload({ finalizeToken }) {
      const tokenPayload = parseImportUploadFinalizeToken(finalizeToken);
      const queuedJob = createImportJob({
        fileName: tokenPayload.fileName,
        id: tokenPayload.jobId,
        scopeId: tokenPayload.scopeId,
        startedAt: tokenPayload.startedAt,
        status: "queued",
      });

      try {
        await assertObjectExists({
          key: tokenPayload.rawObjectKey,
          r2,
        });
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `R2 へのアップロード確認に失敗しました: ${error.message}`
            : "R2 へのアップロード確認に失敗しました。",
        );
      }

      try {
        await insertImportJob({
          job: queuedJob,
          rawObjectKey: tokenPayload.rawObjectKey,
          supabase,
        });
      } catch (error) {
        await deleteObject({
          key: tokenPayload.rawObjectKey,
          r2,
        }).catch(() => undefined);
        throw wrapSupabaseSchemaError(error);
      }

      return queuedJob;
    },
    async getDatasetVersionPayload({ localDatasetVersion } = {}) {
      const latestState = await loadLatestDatasetState({ supabase }).catch(() => null);

      if (!latestState) {
        return createInMemoryBackend().getDatasetVersionPayload({ localDatasetVersion });
      }

      return {
        datasetVersion: latestState.dataset_version,
        generatedAt: latestState.generated_at,
        shouldSync: localDatasetVersion !== latestState.dataset_version,
      };
    },
    async getHoldingsPayload() {
      const [cashBalances, holdings] = await Promise.all([
        loadCashBalances({ supabase }).catch((error) => {
          throw wrapSupabaseSchemaError(error);
        }),
        loadHoldings({ supabase }).catch((error) => {
          throw wrapSupabaseSchemaError(error);
        }),
      ]);

      if (cashBalances.length === 0 && holdings.length === 0) {
        return createInMemoryBackend().getHoldingsPayload();
      }

      const resolvedCashBalances =
        cashBalances.length > 0
          ? cashBalances
          : structuredClone(dummyStockPrepSnapshot.cashBalances);
      const updatedAt = [
        ...resolvedCashBalances.map((cash) => cash.updatedAt),
        ...holdings.map((h) => h.updatedAt),
      ]
        .sort((left, right) => right.localeCompare(left))
        .at(0);

      return {
        cashBalances: resolvedCashBalances,
        holdings,
        updatedAt: updatedAt ?? defaultGeneratedAt,
      };
    },
    async getImportJobsPayload() {
      const [datasetState, importJobs] = await Promise.all([
        loadLatestDatasetState({ supabase }).catch((error) => {
          throw wrapSupabaseSchemaError(error);
        }),
        loadImportJobs({ supabase }).catch((error) => {
          throw wrapSupabaseSchemaError(error);
        }),
      ]);

      return {
        datasetVersion: datasetState?.dataset_version ?? null,
        generatedAt: datasetState?.generated_at ?? null,
        jobs: importJobs,
      };
    },
    async getLatestSummaryPayload() {
      try {
        const latestState = await loadLatestDatasetState({ supabase });

        if (!latestState) {
          return createInMemoryBackend().getLatestSummaryPayload();
        }

        const manifest = await getJsonObject<StockPrepMarketDataManifest>({
          key: latestState.latest_manifest_key,
          r2,
        });

        return getJsonObject<LatestSummaryPayload>({
          key: manifest.latestSummaryKey,
          r2,
        });
      } catch (error) {
        console.error(
          "Falling back to dummy latest summary because remote latest summary load failed.",
          error,
        );
        return createInMemoryBackend().getLatestSummaryPayload();
      }
    },
    async getMarketDataPayload() {
      try {
        const latestState = await loadLatestDatasetState({ supabase });

        if (!latestState) {
          return createInMemoryBackend().getMarketDataPayload();
        }

        const manifest = await getJsonObject<StockPrepMarketDataManifest>({
          key: latestState.latest_manifest_key,
          r2,
        });
        const persisted = await loadPersistedMarketData({
          key: manifest.marketDataKey,
          readJson: (key) => getJsonObject({ key, r2 }),
        });

        return persisted.marketData;
      } catch (error) {
        console.error(
          "Falling back to dummy market data because remote market data load failed.",
          error,
        );
        return createInMemoryBackend().getMarketDataPayload();
      }
    },
    async importMarketZip({ fileName, scopeId, zipBytes }) {
      const startedAt = new Date().toISOString();
      const jobId = crypto.randomUUID();
      const rawZipKey = buildRawZipKey({ fileName, jobId, scopeId });
      const queuedJob = createImportJob({
        fileName,
        id: jobId,
        scopeId,
        startedAt,
        status: "queued",
      });

      await putBinaryObject({
        body: zipBytes,
        contentType: "application/zip",
        key: rawZipKey,
        r2,
      });

      try {
        await insertImportJob({
          job: queuedJob,
          rawObjectKey: rawZipKey,
          supabase,
        });
      } catch (error) {
        await deleteObject({
          key: rawZipKey,
          r2,
        }).catch(() => undefined);
        throw wrapSupabaseSchemaError(error);
      }

      return queuedJob;
    },
    async upsertHolding(request) {
      validateHoldingRequest(request);

      const marketData = await this.getMarketDataPayload();
      const symbol = marketData.symbols.find((candidate) => candidate.id === request.symbolId);

      if (!symbol) {
        throw new Error("保存対象の銘柄がサーバー側に存在しません。");
      }

      const updatedAt = new Date().toISOString();
      await upsertHoldingRow({
        holding: {
          averagePrice: request.averagePrice,
          currency: symbol.currency,
          id: `holding-${symbol.id}`,
          quantity: request.quantity,
          symbolId: symbol.id,
          updatedAt,
        },
        supabase,
      }).catch((error) => {
        throw wrapSupabaseSchemaError(error);
      });

      return this.getHoldingsPayload();
    },
  };

  return backend;
}

function getInMemoryState(): StockPrepServerState {
  const globalState = globalThis as GlobalWithStockPrepServerState;

  if (!globalState.__stockPrepServerState__) {
    globalState.__stockPrepServerState__ = createDefaultServerState();
  }

  return globalState.__stockPrepServerState__;
}

function createDefaultServerState(): StockPrepServerState {
  return {
    holdingsPayload: {
      cashBalances: structuredClone(dummyStockPrepSnapshot.cashBalances),
      holdings: structuredClone(dummyStockPrepSnapshot.holdings),
      updatedAt: getLatestHoldingUpdatedAt(),
    },
    importJobs: [],
    marketDataPayload: {
      dailyPrices: structuredClone(dummyStockPrepSnapshot.dailyPrices),
      datasetVersion: defaultMarketDatasetVersion,
      exchangeRates: structuredClone(dummyStockPrepSnapshot.exchangeRates),
      generatedAt: defaultGeneratedAt,
      symbols: structuredClone(dummyStockPrepSnapshot.symbols),
    },
    rawZipByJobId: new Map(),
  };
}

function getLatestHoldingUpdatedAt(): string {
  return (
    dummyStockPrepSnapshot.holdings
      .map((holding) => holding.updatedAt)
      .sort((left, right) => right.localeCompare(left))
      .at(0) ?? defaultGeneratedAt
  );
}

function createImportJob({
  fileName,
  id = crypto.randomUUID(),
  scopeId,
  startedAt,
  status,
}: {
  fileName: string;
  id?: string;
  scopeId: ImportJobRecord["scopeId"];
  startedAt: string;
  status: ImportJobRecord["status"];
}): ImportJobRecord {
  return {
    dailyPriceCount: 0,
    datasetVersion: undefined,
    exchangeRateCount: 0,
    fileName,
    id,
    scopeId,
    startedAt,
    status,
    symbolCount: 0,
  };
}

function replaceImportJob(jobs: ImportJobRecord[], job: ImportJobRecord): ImportJobRecord[] {
  return [job, ...jobs.filter((candidate) => candidate.id !== job.id)].slice(0, 20);
}

export function hasRemoteMarketDataEnv(): boolean {
  return Boolean(
    process.env.STOCK_PREP_SUPABASE_URL &&
    process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY &&
    process.env.STOCK_PREP_R2_ACCOUNT_ID &&
    process.env.STOCK_PREP_R2_ACCESS_KEY_ID &&
    process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY &&
    process.env.STOCK_PREP_R2_BUCKET,
  );
}

export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.STOCK_PREP_SUPABASE_URL;
  const key = process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase 環境変数が不足しています。");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function loadLatestDatasetState({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<DatasetStateRow | null> {
  const { data, error } = await supabase
    .from(supabaseTableNames.datasetState)
    .select("*")
    .eq("id", latestDatasetStateId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DatasetStateRow | null;
}

async function loadImportJobs({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<ImportJobRecord[]> {
  const { data, error } = await supabase
    .from(supabaseTableNames.importJobs)
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ImportJobRow[]).map(mapImportJobRow);
}

async function loadHoldings({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<PortfolioHolding[]> {
  const { data, error } = await supabase
    .from(supabaseTableNames.holdings)
    .select("*")
    .order("symbol_id", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as HoldingRow[]).map(mapHoldingRow);
}

async function loadCashBalances({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<CashBalance[]> {
  const { data, error } = await supabase
    .from(supabaseTableNames.cashBalances)
    .select("*")
    .order("currency", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as CashBalanceRow[]).map(mapCashBalanceRow);
}

export async function claimNextQueuedImportJob({
  supabase,
}: {
  supabase: SupabaseClient;
}): Promise<QueuedImportJob | null> {
  while (true) {
    const { data, error } = await supabase
      .from(supabaseTableNames.importJobs)
      .select("*")
      .in("status", ["queued", "processing"])
      .order("started_at", { ascending: true })
      .limit(20);

    if (error) {
      throw error;
    }

    const row = findClaimableImportJobRow((data ?? []) as ImportJobRow[]);

    if (!row) {
      return null;
    }

    const claimedAt = new Date().toISOString();
    const nextAttemptCount = (row.attempt_count ?? 0) + 1;
    let updateQuery = supabase
      .from(supabaseTableNames.importJobs)
      .update({
        attempt_count: nextAttemptCount,
        error_message: null,
        finished_at: null,
        heartbeat_at: claimedAt,
        processing_started_at: claimedAt,
        status: "processing",
      })
      .eq("id", row.id)
      .eq("status", row.status);

    if (row.status === "queued") {
      updateQuery = updateQuery.eq("attempt_count", row.attempt_count ?? 0);
    } else {
      updateQuery =
        row.heartbeat_at === null
          ? updateQuery.is("heartbeat_at", null)
          : updateQuery.eq("heartbeat_at", row.heartbeat_at);
    }

    const claimResult = await updateQuery
      .select("*")
      .maybeSingle();

    if (claimResult.error) {
      throw claimResult.error;
    }

    if (!claimResult.data) {
      continue;
    }

    const mappedRow = claimResult.data as ImportJobRow;

    if (!mappedRow.raw_object_key) {
      throw new Error(`import job に raw_object_key がありません: ${mappedRow.id}`);
    }

    return {
      ...mapImportJobRow(mappedRow),
      rawObjectKey: mappedRow.raw_object_key,
    };
  }
}

export async function touchImportJobHeartbeat({
  jobId,
  supabase,
}: {
  jobId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase
    .from(supabaseTableNames.importJobs)
    .update({
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing");

  if (error) {
    throw error;
  }
}

export async function updateDatasetStateStatus({
  status,
  supabase,
}: {
  status: DatasetStateRow["status"];
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase
    .from(supabaseTableNames.datasetState)
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", latestDatasetStateId);

  if (error) {
    throw error;
  }
}

async function insertImportJob({
  job,
  rawObjectKey,
  supabase,
}: {
  job: ImportJobRecord;
  rawObjectKey?: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase
    .from(supabaseTableNames.importJobs)
    .insert(mapImportJobRecord(job, { rawObjectKey }));

  if (error) {
    throw error;
  }
}

export async function updateImportJob({
  job,
  supabase,
}: {
  job: ImportJobRecord;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase
    .from(supabaseTableNames.importJobs)
    .update(mapImportJobRecord(job))
    .eq("id", job.id);

  if (error) {
    throw error;
  }
}

export async function persistDatasetState({
  generatedAt,
  manifestKey,
  marketDataKey,
  status = "ready",
  supabase,
  version,
}: {
  generatedAt: string;
  manifestKey: string;
  marketDataKey: string;
  status?: DatasetStateRow["status"];
  supabase: SupabaseClient;
  version: string;
}): Promise<void> {
  const { error } = await supabase.from(supabaseTableNames.datasetState).upsert({
    dataset_version: version,
    generated_at: generatedAt,
    id: latestDatasetStateId,
    latest_manifest_key: manifestKey,
    market_data_key: marketDataKey,
    status,
    updated_at: generatedAt,
  });

  if (error) {
    throw error;
  }
}

async function upsertHoldingRow({
  holding,
  supabase,
}: {
  holding: PortfolioHolding;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase
    .from(supabaseTableNames.holdings)
    .upsert(mapHoldingRecord(holding));

  if (error) {
    throw error;
  }
}

function mapImportJobRecord(
  job: ImportJobRecord,
  { rawObjectKey }: { rawObjectKey?: string } = {},
): Omit<
  ImportJobRow,
  "attempt_count" | "heartbeat_at" | "processing_started_at"
> {
  return {
    daily_price_count: job.dailyPriceCount,
    dataset_version: job.datasetVersion ?? null,
    error_message: job.errorMessage ?? null,
    exchange_rate_count: job.exchangeRateCount,
    file_name: job.fileName,
    finished_at: job.finishedAt ?? null,
    id: job.id,
    manifest_key: job.manifestKey ?? null,
    raw_object_key: rawObjectKey ?? null,
    scope_id: job.scopeId,
    started_at: job.startedAt,
    status: job.status,
    symbol_count: job.symbolCount,
  };
}

function mapImportJobRow(row: ImportJobRow): ImportJobRecord {
  return {
    dailyPriceCount: row.daily_price_count,
    datasetVersion: row.dataset_version ?? undefined,
    errorMessage: row.error_message ?? undefined,
    exchangeRateCount: row.exchange_rate_count,
    fileName: row.file_name,
    finishedAt: row.finished_at ?? undefined,
    id: row.id,
    manifestKey: row.manifest_key ?? undefined,
    scopeId: row.scope_id,
    startedAt: row.started_at,
    status: row.status,
    symbolCount: row.symbol_count,
  };
}

export function findClaimableImportJobRow(
  rows: readonly ImportJobRow[],
  now = new Date(),
): ImportJobRow | null {
  for (const row of rows) {
    if (row.status === "queued") {
      return row;
    }

    if (isStaleImportJobRow(row, now)) {
      return row;
    }
  }

  return null;
}

export function isStaleImportJobRow(
  row: Pick<ImportJobRow, "heartbeat_at" | "processing_started_at" | "started_at" | "status">,
  now = new Date(),
): boolean {
  if (row.status !== "processing") {
    return false;
  }

  const leaseTimestamp = row.heartbeat_at ?? row.processing_started_at ?? row.started_at;
  const leaseTime = Date.parse(leaseTimestamp);

  if (!Number.isFinite(leaseTime)) {
    return false;
  }

  return leaseTime <= now.getTime() - importJobStaleAfterMs;
}

export function getImportJobHeartbeatIntervalMs(): number {
  return importJobHeartbeatIntervalMs;
}

function mapHoldingRecord(holding: PortfolioHolding): HoldingRow {
  return {
    average_price: holding.averagePrice,
    currency: holding.currency,
    id: holding.id,
    quantity: holding.quantity,
    symbol_id: holding.symbolId,
    updated_at: holding.updatedAt,
  };
}

function mapHoldingRow(row: HoldingRow): PortfolioHolding {
  return {
    averagePrice: row.average_price,
    currency: row.currency,
    id: row.id,
    quantity: row.quantity,
    symbolId: row.symbol_id,
    updatedAt: row.updated_at,
  };
}

function mapCashBalanceRow(row: CashBalanceRow): CashBalance {
  return {
    amount: row.amount,
    currency: row.currency,
    updatedAt: row.updated_at,
  };
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

type ImportUploadFinalizeTokenPayload = {
  exp: number;
  fileName: string;
  jobId: string;
  rawObjectKey: string;
  scopeId: ImportJobRecord["scopeId"];
  startedAt: string;
};

function createImportUploadFinalizeToken(
  payload: Omit<ImportUploadFinalizeTokenPayload, "exp">,
): string {
  const encodedPayload = encodeImportUploadTokenPayload({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + importUploadTokenTtlSeconds,
  });
  const signature = createImportUploadTokenSignature(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseImportUploadFinalizeToken(token: string): ImportUploadFinalizeTokenPayload {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("アップロード完了トークンの形式が不正です。");
  }

  const expectedSignature = createImportUploadTokenSignature(encodedPayload);

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new Error("アップロード完了トークンの署名が不正です。");
  }

  const payload = decodeImportUploadTokenPayload(encodedPayload);

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("アップロード完了トークンの有効期限が切れています。");
  }

  return payload;
}

function encodeImportUploadTokenPayload(payload: ImportUploadFinalizeTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeImportUploadTokenPayload(tokenPayload: string): ImportUploadFinalizeTokenPayload {
  try {
    return JSON.parse(
      Buffer.from(tokenPayload, "base64url").toString("utf8"),
    ) as ImportUploadFinalizeTokenPayload;
  } catch {
    throw new Error("アップロード完了トークンの本文を復元できませんでした。");
  }
}

function createImportUploadTokenSignature(tokenPayload: string): string {
  return createHmac("sha256", getImportUploadTokenSecret())
    .update(tokenPayload)
    .digest("base64url");
}

function getImportUploadTokenSecret(): string {
  return (
    process.env.STOCK_PREP_IMPORT_UPLOAD_SECRET ??
    process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY ??
    "local-stock-prep-import-upload-secret"
  );
}

function normalizeZipContentType(contentType: string): string {
  return contentType.trim() || "application/zip";
}

export function buildRawZipKey({
  fileName,
  jobId,
  scopeId,
}: {
  fileName: string;
  jobId: string;
  scopeId: ImportJobRecord["scopeId"];
}): string {
  return `incoming/${scopeId.toLowerCase()}/${jobId}-${sanitizePathSegment(fileName)}`;
}

export function wrapSupabaseSchemaError(error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Supabase schema error.";

  if (
    message.includes("Could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist")
  ) {
    return new Error(
      `Supabase の取り込み用テーブルが見つかりません。${schemaGuidePath} を SQL Editor で実行してください。`,
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function validateHoldingRequest(request: UpsertHoldingRequest): void {
  if (!request.symbolId) {
    throw new Error("symbolId が必要です。");
  }

  if (!Number.isFinite(request.quantity) || request.quantity <= 0) {
    throw new Error("quantity は 0 より大きい数値で指定してください。");
  }

  if (!Number.isFinite(request.averagePrice) || request.averagePrice <= 0) {
    throw new Error("averagePrice は 0 より大きい数値で指定してください。");
  }
}

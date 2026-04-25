import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DatasetVersionPayload,
  HoldingsPayload,
  ImportJobRecord,
  ImportJobsPayload,
  MarketDataPayload,
  PortfolioHolding,
  StoredStockSymbol,
  UpsertHoldingRequest,
} from "@stock-prep/shared";

import { dummyStockPrepSnapshot } from "../data/seedSnapshot";
import type { ImportedSymbolSnapshot, StockPrepMarketDataManifest } from "./stockPrepImport";

type StockPrepServerState = {
  holdingsPayload: HoldingsPayload;
  importJobs: ImportJobRecord[];
  marketDataPayload: MarketDataPayload;
};

type DatasetStateRow = {
  dataset_version: string;
  generated_at: string;
  id: string;
  latest_manifest_key: string;
  market_data_key: string;
  updated_at: string;
};

type ImportJobRow = {
  daily_price_count: number;
  dataset_version: string | null;
  error_message: string | null;
  exchange_rate_count: number;
  file_name: string;
  finished_at: string | null;
  id: string;
  manifest_key: string | null;
  scope_id: ImportJobRecord["scopeId"];
  started_at: string;
  status: ImportJobRecord["status"];
  symbol_count: number;
};

type ScreeningSnapshotRow = {
  candidate_count: number;
  candidates: unknown[];
  dataset_version: string;
  generated_at: string;
  updated_at?: string;
};

type SymbolSnapshotRow = {
  code: string;
  currency: StoredStockSymbol["currency"];
  dataset_version: string;
  id: string;
  import_status: ImportedSymbolSnapshot["importStatus"];
  last_close: number | null;
  last_close_date: string | null;
  name: string;
  region: StoredStockSymbol["region"];
  security_type: StoredStockSymbol["securityType"];
  source: StoredStockSymbol["source"];
  source_symbol: string;
  stooq_category: string | null;
  unsupported_reason: string | null;
  updated_at: string;
};

type StockPrepServerBackend = {
  getDatasetVersionPayload(args?: {
    localDatasetVersion?: string | null;
  }): Promise<DatasetVersionPayload>;
  getHoldingsPayload(): Promise<HoldingsPayload>;
  getImportJobsPayload(): Promise<ImportJobsPayload>;
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
const latestDatasetStateId = "latest";
const schemaGuidePath = "docs/setup/supabase-slice17.sql";

const supabaseTableNames = {
  datasetState: "stock_prep_dataset_state",
  importJobs: "stock_prep_import_jobs",
  screeningSnapshots: "stock_prep_screening_snapshots",
  symbolSnapshots: "stock_prep_symbol_snapshots",
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
        status: "running",
      });

      state.importJobs = [runningJob, ...state.importJobs].slice(0, 20);

      try {
        const { importBulkScopeFromZip } = await import("./stockPrepImport");
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
          status: "succeeded" as const,
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
      const symbol = state.marketDataPayload.symbols.find((candidate) => candidate.id === request.symbolId);

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

  return {
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
      return createInMemoryBackend().getHoldingsPayload();
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
        const marketData = await getJsonObject<MarketDataPayload>({
          key: manifest.marketDataKey,
          r2,
        });

        return marketData;
      } catch (error) {
        console.error("Falling back to dummy market data because remote market data load failed.", error);
        return createInMemoryBackend().getMarketDataPayload();
      }
    },
    async importMarketZip({ fileName, scopeId, zipBytes }) {
      const startedAt = new Date().toISOString();
      const jobId = crypto.randomUUID();

      await insertImportJob({
        job: createImportJob({
          fileName,
          id: jobId,
          scopeId,
          startedAt,
          status: "running",
        }),
        supabase,
      }).catch((error) => {
        throw wrapSupabaseSchemaError(error);
      });

      try {
        const { createEmptyMarketDataPayload, importBulkScopeFromZip } = await import("./stockPrepImport");
        const [latestManifest, currentMarketData] = await Promise.all([
          loadLatestDatasetState({ supabase })
            .then(async (state) =>
              state
                ? getJsonObject<StockPrepMarketDataManifest>({
                    key: state.latest_manifest_key,
                    r2,
                  })
                : null,
            )
            .catch(() => null),
          this.getMarketDataPayload(),
        ]);
        const importResult = await importBulkScopeFromZip({
          currentMarketData:
            currentMarketData.datasetVersion === defaultMarketDatasetVersion
              ? createEmptyMarketDataPayload()
              : currentMarketData,
          generatedAt: startedAt,
          referenceSymbols: currentMarketData.symbols,
          scopeId,
          zipBytes,
        });
        const runId = buildRunId({ generatedAt: startedAt, scopeId });
        const marketDataKey = `runs/${runId}/market-data.json`;
        const manifestKey = `runs/${runId}/manifest.json`;
        const manifest: StockPrepMarketDataManifest = {
          datasetVersion: importResult.marketData.datasetVersion,
          generatedAt: startedAt,
          marketDataKey,
          runId,
          scopeSummaries: {
            ...(latestManifest?.scopeSummaries ?? {}),
            [scopeId]: importResult.summary,
          },
        };

        await putJsonObject({
          body: importResult.marketData,
          key: marketDataKey,
          r2,
        });
        await putJsonObject({
          body: manifest,
          key: manifestKey,
          r2,
        });
        await putJsonObject({
          body: manifest,
          key: "latest/manifest.json",
          r2,
        });
        await persistDatasetState({
          generatedAt: startedAt,
          manifestKey: "latest/manifest.json",
          marketDataKey,
          supabase,
          version: importResult.marketData.datasetVersion,
        });
        await persistImportedSymbols({
          datasetVersion: importResult.marketData.datasetVersion,
          generatedAt: startedAt,
          scopeId,
          supabase,
          symbols: importResult.symbols,
        });
        await persistScreeningSnapshot({
          datasetVersion: importResult.marketData.datasetVersion,
          screening: importResult.screening,
          supabase,
        });

        const completedJob: ImportJobRecord = {
          dailyPriceCount: importResult.summary.dailyPriceCount,
          datasetVersion: importResult.marketData.datasetVersion,
          errorMessage: undefined,
          exchangeRateCount: importResult.summary.exchangeRateCount,
          fileName,
          finishedAt: startedAt,
          id: jobId,
          manifestKey,
          scopeId,
          startedAt,
          status: "succeeded",
          symbolCount: importResult.summary.symbolCount,
        };

        await updateImportJob({
          job: completedJob,
          supabase,
        });

        return completedJob;
      } catch (error) {
        const failedJob: ImportJobRecord = {
          dailyPriceCount: 0,
          datasetVersion: undefined,
          errorMessage: error instanceof Error ? error.message : "Import failed.",
          exchangeRateCount: 0,
          fileName,
          finishedAt: startedAt,
          id: jobId,
          manifestKey: undefined,
          scopeId,
          startedAt,
          status: "failed",
          symbolCount: 0,
        };

        await updateImportJob({
          job: failedJob,
          supabase,
        }).catch(() => undefined);

        throw error;
      }
    },
    async upsertHolding(request) {
      return createInMemoryBackend().upsertHolding(request);
    },
  };
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

function hasRemoteMarketDataEnv(): boolean {
  return Boolean(
    process.env.STOCK_PREP_SUPABASE_URL &&
      process.env.STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY &&
      process.env.STOCK_PREP_R2_ACCOUNT_ID &&
      process.env.STOCK_PREP_R2_ACCESS_KEY_ID &&
      process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY &&
      process.env.STOCK_PREP_R2_BUCKET,
  );
}

function createSupabaseAdminClient(): SupabaseClient {
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

function createR2Client(): S3Client {
  const accountId = process.env.STOCK_PREP_R2_ACCOUNT_ID;
  const accessKeyId = process.env.STOCK_PREP_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STOCK_PREP_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 環境変数が不足しています。");
  }

  return new S3Client({
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });
}

async function loadLatestDatasetState({
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

async function insertImportJob({
  job,
  supabase,
}: {
  job: ImportJobRecord;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase.from(supabaseTableNames.importJobs).insert(mapImportJobRecord(job));

  if (error) {
    throw error;
  }
}

async function updateImportJob({
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

async function persistDatasetState({
  generatedAt,
  manifestKey,
  marketDataKey,
  supabase,
  version,
}: {
  generatedAt: string;
  manifestKey: string;
  marketDataKey: string;
  supabase: SupabaseClient;
  version: string;
}): Promise<void> {
  const { error } = await supabase.from(supabaseTableNames.datasetState).upsert({
    dataset_version: version,
    generated_at: generatedAt,
    id: latestDatasetStateId,
    latest_manifest_key: manifestKey,
    market_data_key: marketDataKey,
    updated_at: generatedAt,
  });

  if (error) {
    throw error;
  }
}

async function persistImportedSymbols({
  datasetVersion,
  generatedAt,
  scopeId,
  supabase,
  symbols,
}: {
  datasetVersion: string;
  generatedAt: string;
  scopeId: ImportJobRecord["scopeId"];
  supabase: SupabaseClient;
  symbols: ImportedSymbolSnapshot[];
}): Promise<void> {
  if (scopeId !== "FX") {
    const region = scopeId;

    const { error: deleteError } = await supabase
      .from(supabaseTableNames.symbolSnapshots)
      .delete()
      .eq("region", region);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (symbols.length === 0) {
    return;
  }

  const rows: SymbolSnapshotRow[] = symbols.map((symbol) => ({
    code: symbol.code,
    currency: symbol.currency,
    dataset_version: datasetVersion,
    id: symbol.id,
    import_status: symbol.importStatus,
    last_close: symbol.lastClose,
    last_close_date: symbol.lastCloseDate,
    name: symbol.name,
    region: symbol.region,
    security_type: symbol.securityType ?? "stock",
    source: symbol.source,
    source_symbol: symbol.sourceSymbol,
    stooq_category: symbol.stooqCategory,
    unsupported_reason: symbol.unsupportedReason ?? null,
    updated_at: generatedAt,
  }));

  const { error } = await supabase.from(supabaseTableNames.symbolSnapshots).upsert(rows);

  if (error) {
    throw error;
  }
}

async function persistScreeningSnapshot({
  datasetVersion,
  screening,
  supabase,
}: {
  datasetVersion: string;
  screening: {
    candidateCount: number;
    generatedAt: string;
    topCandidates: unknown[];
  };
  supabase: SupabaseClient;
}): Promise<void> {
  const row: ScreeningSnapshotRow = {
    candidate_count: screening.candidateCount,
    candidates: screening.topCandidates,
    dataset_version: datasetVersion,
    generated_at: screening.generatedAt,
    updated_at: screening.generatedAt,
  };

  const { error } = await supabase
    .from(supabaseTableNames.screeningSnapshots)
    .upsert(row);

  if (error) {
    throw error;
  }
}

function buildRunId({
  generatedAt,
  scopeId,
}: {
  generatedAt: string;
  scopeId: ImportJobRecord["scopeId"];
}): string {
  return `${generatedAt.replace(/[:.]/g, "-")}-${scopeId.toLowerCase()}`;
}

function mapImportJobRecord(job: ImportJobRecord): ImportJobRow {
  return {
    daily_price_count: job.dailyPriceCount,
    dataset_version: job.datasetVersion ?? null,
    error_message: job.errorMessage ?? null,
    exchange_rate_count: job.exchangeRateCount,
    file_name: job.fileName,
    finished_at: job.finishedAt ?? null,
    id: job.id,
    manifest_key: job.manifestKey ?? null,
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

async function putJsonObject({
  body,
  key,
  r2,
}: {
  body: unknown;
  key: string;
  r2: S3Client;
}): Promise<void> {
  const bucket = process.env.STOCK_PREP_R2_BUCKET;

  if (!bucket) {
    throw new Error("R2 bucket 名が設定されていません。");
  }

  await r2.send(
    new PutObjectCommand({
      Body: JSON.stringify(body),
      Bucket: bucket,
      ContentType: "application/json; charset=utf-8",
      Key: key,
    }),
  );
}

async function getJsonObject<T>({
  key,
  r2,
}: {
  key: string;
  r2: S3Client;
}): Promise<T> {
  const bucket = process.env.STOCK_PREP_R2_BUCKET;

  if (!bucket) {
    throw new Error("R2 bucket 名が設定されていません。");
  }

  try {
    const response = await r2.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const text = await response.Body?.transformToString();

    if (!text) {
      throw new Error(`R2 object was empty: ${key}`);
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error || "$metadata" in error) &&
      ((error as { name?: string }).name === "NoSuchKey" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
    ) {
      throw new Error(`R2 object was not found: ${key}`);
    }

    throw error;
  }
}

function wrapSupabaseSchemaError(error: unknown): Error {
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
      `Supabase の Slice 17 用テーブルが見つかりません。${schemaGuidePath} を SQL Editor で実行してください。`,
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

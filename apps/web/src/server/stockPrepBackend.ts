import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CashBalance,
  DatasetVersionPayload,
  HoldingsPayload,
  ImportJobRecord,
  ImportJobsPayload,
  MarketDataPayload,
  PortfolioHolding,
  UpsertHoldingRequest,
} from "@stock-prep/shared";

import { dummyStockPrepSnapshot } from "../data/seedSnapshot";
import type { StockPrepMarketDataManifest } from "./stockPrepImport";

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
  const backend: StockPrepServerBackend = {
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
        cashBalances.length > 0 ? cashBalances : structuredClone(dummyStockPrepSnapshot.cashBalances);
      const updatedAt = [...resolvedCashBalances.map((cash) => cash.updatedAt), ...holdings.map((h) => h.updatedAt)]
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
      const rawZipKey = `uploads/${buildRunId({ generatedAt: startedAt, scopeId })}/${sanitizePathSegment(fileName)}`;

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
        await putBinaryObject({
          body: zipBytes,
          contentType: "application/zip",
          key: rawZipKey,
          r2,
        });
        const { buildLatestSummaryPayload, createEmptyMarketDataPayload, importBulkScopeFromZip } =
          await import("./stockPrepImport");
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
        const latestSummary = buildLatestSummaryPayload(importResult.marketData);
        const latestSummaryKey = `runs/${runId}/latest-summary.json`;
        const marketDataKey = `runs/${runId}/market-data.json`;
        const manifestKey = `runs/${runId}/manifest.json`;
        const manifest: StockPrepMarketDataManifest = {
          datasetVersion: importResult.marketData.datasetVersion,
          generatedAt: startedAt,
          latestSummaryKey,
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
          body: latestSummary,
          key: latestSummaryKey,
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
      } finally {
        await deleteObject({
          key: rawZipKey,
          r2,
        }).catch(() => undefined);
      }
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

async function upsertHoldingRow({
  holding,
  supabase,
}: {
  holding: PortfolioHolding;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await supabase.from(supabaseTableNames.holdings).upsert(mapHoldingRecord(holding));

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

async function putBinaryObject({
  body,
  contentType,
  key,
  r2,
}: {
  body: Uint8Array;
  contentType: string;
  key: string;
  r2: S3Client;
}): Promise<void> {
  const bucket = process.env.STOCK_PREP_R2_BUCKET;

  if (!bucket) {
    throw new Error("R2 bucket 名が設定されていません。");
  }

  await r2.send(
    new PutObjectCommand({
      Body: body,
      Bucket: bucket,
      ContentType: contentType,
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

async function deleteObject({
  key,
  r2,
}: {
  key: string;
  r2: S3Client;
}): Promise<void> {
  const bucket = process.env.STOCK_PREP_R2_BUCKET;

  if (!bucket) {
    throw new Error("R2 bucket 名が設定されていません。");
  }

  await r2.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
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

import type {
  CurrencyCode,
  DailyPriceBar,
  ExchangeRateBar,
  RegionCode,
  StoredStockSymbol,
} from "@stock-prep/shared";

export const STOOQ_CSV_BASE_URL = "https://stooq.com/q/d/l/";
export const STOOQ_API_KEY_GUIDE_BASE_URL = "https://stooq.com/q/d/";

export const stooqSourceSuffixByRegion = {
  HK: "hk",
  JP: "jp",
  UK: "uk",
  US: "us",
} as const satisfies Record<RegionCode, string>;

export const stooqCurrencyByRegion = {
  HK: "HKD",
  JP: "JPY",
  UK: "GBP",
  US: "USD",
} as const satisfies Record<RegionCode, CurrencyCode>;

export const stooqExchangeRatePairs = ["USDJPY", "GBPJPY", "HKDJPY"] as const;

export type StooqExchangeRatePair = (typeof stooqExchangeRatePairs)[number];

export type StooqEquityImportTarget = {
  code: string;
  name: string;
  region: RegionCode;
  currency: CurrencyCode;
  sourceSymbol: string;
};

export const stooqEquityImportTargets: StooqEquityImportTarget[] = [
  {
    code: "7203",
    currency: "JPY",
    name: "トヨタ自動車",
    region: "JP",
    sourceSymbol: buildStooqSourceSymbol({ code: "7203", region: "JP" }),
  },
  {
    code: "AAPL",
    currency: "USD",
    name: "Apple",
    region: "US",
    sourceSymbol: buildStooqSourceSymbol({ code: "AAPL", region: "US" }),
  },
  {
    code: "HSBA",
    currency: "GBP",
    name: "HSBC Holdings",
    region: "UK",
    sourceSymbol: buildStooqSourceSymbol({ code: "HSBA", region: "UK" }),
  },
  {
    code: "0700",
    currency: "HKD",
    name: "Tencent Holdings",
    region: "HK",
    sourceSymbol: buildStooqSourceSymbol({ code: "0700", region: "HK" }),
  },
];

export type StooqApiEnv = {
  VITE_STOOQ_API_KEY?: string;
};

export type StooqClient = {
  fetchDailyPrices: (target: StooqEquityImportTarget) => Promise<DailyPriceBar[]>;
  fetchExchangeRates: (pair: StooqExchangeRatePair) => Promise<ExchangeRateBar[]>;
};

export type StooqClientOptions = {
  apiKey?: string | null;
  baseUrl?: string;
  fetcher?: typeof fetch;
  fromDate?: string;
  toDate?: string;
};

type StooqCsvRow = {
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
  volume: number;
};

const expectedStooqPriceCsvHeader = ["date", "open", "high", "low", "close", "volume"] as const;
const expectedStooqExchangeRateCsvHeader = ["date", "open", "high", "low", "close"] as const;

export class StooqApiKeyMissingError extends Error {
  constructor(message = "Stooq API key is not configured.") {
    super(message);
    this.name = "StooqApiKeyMissingError";
  }
}

export class StooqUnsupportedDataError extends Error {
  constructor(
    public readonly sourceSymbol: string,
    message = `Stooq data is not available for ${sourceSymbol}.`,
  ) {
    super(message);
    this.name = "StooqUnsupportedDataError";
  }
}

export function resolveStooqApiKey(
  env: StooqApiEnv = import.meta.env as StooqApiEnv,
): string | null {
  const apiKey = env.VITE_STOOQ_API_KEY?.trim();
  return apiKey ? apiKey : null;
}

export function buildStooqSourceSymbol({
  code,
  region,
}: {
  code: string;
  region: RegionCode;
}): string {
  const normalizedCode =
    region === "HK" ? code.trim().replace(/^0+/, "").toLowerCase() : code.trim().toLowerCase();
  return `${normalizedCode}.${stooqSourceSuffixByRegion[region]}`;
}

export function buildStooqCsvUrl({
  apiKey,
  baseUrl = STOOQ_CSV_BASE_URL,
  fromDate,
  sourceSymbol,
  toDate,
}: {
  apiKey: string;
  baseUrl?: string;
  fromDate?: string;
  sourceSymbol: string;
  toDate?: string;
}): URL {
  const url = new URL(baseUrl);
  url.searchParams.set("s", sourceSymbol);
  url.searchParams.set("i", "d");
  if (fromDate) {
    url.searchParams.set("f", fromDate);
  }
  if (toDate) {
    url.searchParams.set("t", toDate);
  }
  url.searchParams.set("apikey", apiKey);
  return url;
}

export function buildStooqApiKeyGuideUrl({
  baseUrl = STOOQ_API_KEY_GUIDE_BASE_URL,
  sourceSymbol,
}: {
  baseUrl?: string;
  sourceSymbol: string;
}): URL {
  const url = new URL(baseUrl);
  url.searchParams.set("s", sourceSymbol);
  url.search += "&get_apikey";
  return url;
}

export function createStooqClient({
  apiKey = resolveStooqApiKey(),
  baseUrl = STOOQ_CSV_BASE_URL,
  fetcher = fetch,
  fromDate,
  toDate,
}: StooqClientOptions = {}): StooqClient {
  if (!apiKey) {
    throw new StooqApiKeyMissingError();
  }

  return {
    fetchDailyPrices: async (target) => {
      const csv = await fetchStooqCsv({
        apiKey,
        baseUrl,
        fetcher,
        fromDate,
        sourceSymbol: target.sourceSymbol,
        toDate,
      });

      return parseStooqDailyPriceCsv(csv, target);
    },
    fetchExchangeRates: async (pair) => {
      const csv = await fetchStooqCsv({
        apiKey,
        baseUrl,
        fetcher,
        fromDate,
        sourceSymbol: pair.toLowerCase(),
        toDate,
      });

      return parseStooqExchangeRateCsv(csv, pair);
    },
  };
}

export function toStoredStockSymbol(target: StooqEquityImportTarget): StoredStockSymbol {
  return {
    code: target.code,
    currency: target.currency,
    id: buildStooqSymbolId(target),
    name: target.name,
    region: target.region,
    source: "stooq",
    sourceSymbol: target.sourceSymbol,
  };
}

export function parseStooqDailyPriceCsv(
  csv: string,
  target: StooqEquityImportTarget,
): DailyPriceBar[] {
  return parseStooqCsvRows(csv, target.sourceSymbol, expectedStooqPriceCsvHeader).map((row) => ({
    close: row.close,
    currency: target.currency,
    date: row.date,
    high: row.high,
    id: `${buildStooqSymbolId(target)}-${row.date}`,
    low: row.low,
    open: row.open,
    region: target.region,
    sourceSymbol: target.sourceSymbol,
    symbolId: buildStooqSymbolId(target),
    volume: row.volume,
  }));
}

export function parseStooqExchangeRateCsv(
  csv: string,
  pair: StooqExchangeRatePair,
): ExchangeRateBar[] {
  return parseStooqCsvRows(csv, pair.toLowerCase(), expectedStooqExchangeRateCsvHeader).map(
    (row) => ({
      baseCurrency: pair.slice(0, 3) as Exclude<CurrencyCode, "JPY">,
      close: row.close,
      date: row.date,
      id: `${pair}-${row.date}`,
      pair,
      quoteCurrency: "JPY",
    }),
  );
}

async function fetchStooqCsv({
  apiKey,
  baseUrl,
  fetcher,
  fromDate,
  sourceSymbol,
  toDate,
}: {
  apiKey: string;
  baseUrl: string;
  fetcher: typeof fetch;
  fromDate?: string;
  sourceSymbol: string;
  toDate?: string;
}): Promise<string> {
  const response = await fetcher(
    buildStooqCsvUrl({ apiKey, baseUrl, fromDate, sourceSymbol, toDate }),
  );
  const text = await response.text();

  if (text.toLowerCase().includes("get your apikey")) {
    throw new StooqApiKeyMissingError(
      `Stooq API key is missing or was rejected by Stooq. Get it manually at ${buildStooqApiKeyGuideUrl(
        { sourceSymbol },
      ).toString()}.`,
    );
  }

  if (!response.ok) {
    throw new StooqUnsupportedDataError(sourceSymbol, `Stooq request failed for ${sourceSymbol}.`);
  }

  return text;
}

function parseStooqCsvRows(
  csv: string,
  sourceSymbol: string,
  expectedHeader: readonly string[],
): StooqCsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new StooqUnsupportedDataError(sourceSymbol);
  }

  if (!isExpectedStooqCsvHeader(lines[0], expectedHeader)) {
    throw new StooqUnsupportedDataError(
      sourceSymbol,
      `Unexpected Stooq CSV columns for ${sourceSymbol}.`,
    );
  }

  const rows = lines.slice(1).map(parseStooqCsvRow).filter(isStooqCsvRow);

  if (rows.length === 0) {
    throw new StooqUnsupportedDataError(sourceSymbol);
  }

  return rows;
}

function parseStooqCsvRow(line: string): StooqCsvRow | null {
  const [date, open, high, low, close, volume] = line.split(",").map((value) => value.trim());

  if (!date || !open || !high || !low || !close) {
    return null;
  }

  return {
    close: Number(close),
    date,
    high: Number(high),
    low: Number(low),
    open: Number(open),
    volume: Number(volume ?? 0),
  };
}

function isStooqCsvRow(row: StooqCsvRow | null): row is StooqCsvRow {
  return (
    row !== null &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close) &&
    Number.isFinite(row.volume)
  );
}

function isExpectedStooqCsvHeader(headerLine: string, expectedHeader: readonly string[]): boolean {
  const columns = headerLine.split(",").map((column) => column.trim().toLowerCase());
  return (
    columns.length === expectedHeader.length &&
    expectedHeader.every((column, index) => columns[index] === column)
  );
}

function buildStooqSymbolId(target: Pick<StooqEquityImportTarget, "code" | "region">): string {
  return `${target.region.toLowerCase()}-${target.code.trim().toLowerCase()}`;
}

import type { CurrencyCode, DailyPriceBar, RegionCode } from "@stock-prep/shared";

export const STOOQ_BULK_BASE_URL = "https://stooq.com/db/d/";

export type StooqInstrumentType = "etf" | "reit" | "stock";

export type StooqImportStatus = "failed" | "imported" | "noData" | "unsupported";

export type StooqBulkImportScope = {
  bundleCode: string;
  id: "HK" | "JP" | "UK" | "US" | "FX";
  label: string;
};

export type StooqBulkImportTarget = {
  code: string;
  currency: CurrencyCode;
  instrumentType: StooqInstrumentType;
  name: string;
  region: RegionCode;
  sourceSymbol: string;
};

export type StooqNormalizedSymbol = StooqBulkImportTarget & {
  id: string;
  importStatus: StooqImportStatus;
  lastImportError?: string;
  source: "stooq";
};

export type StooqNormalizedPriceHistoryFile = {
  bars: DailyPriceBar[];
  currency: CurrencyCode;
  instrumentType: StooqInstrumentType;
  region: RegionCode;
  sourceSymbol: string;
  symbolId: string;
};

export type StooqBulkFailure = {
  path: string;
  reason: string;
  sourceSymbol: string;
};

export type StooqBulkNormalizationResult = {
  failures: StooqBulkFailure[];
  histories: StooqNormalizedPriceHistoryFile[];
  symbols: StooqNormalizedSymbol[];
};

export type StooqBulkNormalizationAccumulator = {
  failures: StooqBulkFailure[];
  histories: StooqNormalizedPriceHistoryFile[];
  symbolsBySourceSymbol: Map<string, StooqNormalizedSymbol>;
  targetsBySourceSymbol: Map<string, StooqBulkImportTarget>;
};

export type StooqBulkFile = {
  content: string;
  path: string;
};

type StooqAsciiRow = {
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
  volume: number;
};

type SupportedBulkCategoryRule = {
  instrumentType: StooqInstrumentType;
  kind: "supported";
  pathFragment: string;
  region: RegionCode;
};

type UnsupportedBulkCategoryRule = {
  kind: "unsupported";
  pathFragment: string;
  reason: string;
};

type StooqBulkCategoryRule = SupportedBulkCategoryRule | UnsupportedBulkCategoryRule;

const expectedAsciiRowLength = 6;
const expectedAsciiRowLengthWithOpenInterest = 7;
const expectedStooqBulkRowLength = 10;

export const stooqBulkImportScopes: readonly StooqBulkImportScope[] = [
  {
    bundleCode: "d_jp_txt",
    id: "JP",
    label: "Japan daily ASCII",
  },
  {
    bundleCode: "d_us_txt",
    id: "US",
    label: "U.S. daily ASCII",
  },
  {
    bundleCode: "d_uk_txt",
    id: "UK",
    label: "U.K. daily ASCII",
  },
  {
    bundleCode: "d_hk_txt",
    id: "HK",
    label: "Hong Kong daily ASCII",
  },
  {
    bundleCode: "d_world_txt",
    id: "FX",
    label: "World daily ASCII",
  },
] as const;

const stooqBulkCategoryRules: readonly StooqBulkCategoryRule[] = [
  { instrumentType: "stock", kind: "supported", pathFragment: "tse stocks", region: "JP" },
  { instrumentType: "etf", kind: "supported", pathFragment: "tse etfs", region: "JP" },
  { instrumentType: "stock", kind: "supported", pathFragment: "nasdaq stocks", region: "US" },
  { instrumentType: "etf", kind: "supported", pathFragment: "nasdaq etfs", region: "US" },
  { instrumentType: "stock", kind: "supported", pathFragment: "nyse stocks", region: "US" },
  { instrumentType: "etf", kind: "supported", pathFragment: "nyse etfs", region: "US" },
  { instrumentType: "stock", kind: "supported", pathFragment: "nysemkt stocks", region: "US" },
  { instrumentType: "etf", kind: "supported", pathFragment: "nysemkt etfs", region: "US" },
  {
    kind: "unsupported",
    pathFragment: "lse stocks intl",
    reason: "LSE international stocks are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "hkex reits",
    reason: "Hong Kong REIT products are outside the MVP universe.",
  },
  { instrumentType: "stock", kind: "supported", pathFragment: "lse stocks", region: "UK" },
  { instrumentType: "etf", kind: "supported", pathFragment: "lse etfs", region: "UK" },
  { instrumentType: "stock", kind: "supported", pathFragment: "hkex stocks", region: "HK" },
  { instrumentType: "etf", kind: "supported", pathFragment: "hkex etfs", region: "HK" },
  {
    kind: "unsupported",
    pathFragment: "futures",
    reason: "Futures are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "options",
    reason: "Options are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "bonds",
    reason: "Bonds are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "indices",
    reason: "Indices are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "cryptocurrencies",
    reason: "Cryptocurrencies are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "structured products",
    reason: "Structured products are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "cbbcs",
    reason: "CBBC products are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "dws",
    reason: "Derivative warrants are outside the MVP universe.",
  },
  {
    kind: "unsupported",
    pathFragment: "drs",
    reason: "DRS products are outside the MVP universe.",
  },
] as const;

export function buildStooqBulkDownloadUrl(scope: StooqBulkImportScope): URL {
  const url = new URL(STOOQ_BULK_BASE_URL);
  url.searchParams.set("b", scope.bundleCode);
  return url;
}

export function normalizeStooqBulkData({
  files,
  targets,
}: {
  files: StooqBulkFile[];
  targets: readonly StooqBulkImportTarget[];
}): StooqBulkNormalizationResult {
  const accumulator = createStooqBulkNormalizationAccumulator({ targets });

  for (const file of files) {
    appendStooqBulkFileToAccumulator({ accumulator, file });
  }

  return finalizeStooqBulkNormalizationAccumulator(accumulator);
}

export function createStooqBulkNormalizationAccumulator({
  targets,
}: {
  targets: readonly StooqBulkImportTarget[];
}): StooqBulkNormalizationAccumulator {
  const symbolsBySourceSymbol = new Map<string, StooqNormalizedSymbol>();
  const targetsBySourceSymbol = new Map(
    targets.map((target) => [normalizeSourceSymbol(target.sourceSymbol), target]),
  );

  for (const target of targets) {
    symbolsBySourceSymbol.set(normalizeSourceSymbol(target.sourceSymbol), {
      ...target,
      id: buildBulkSymbolId(target),
      importStatus: "unsupported",
      source: "stooq",
    });
  }

  return {
    failures: [],
    histories: [],
    symbolsBySourceSymbol,
    targetsBySourceSymbol,
  };
}

export function appendStooqBulkFileToAccumulator({
  accumulator,
  file,
}: {
  accumulator: StooqBulkNormalizationAccumulator;
  file: StooqBulkFile;
}): void {
  const sourceSymbol = normalizeSourceSymbol(resolveSourceSymbolFromPath(file.path));
  const matchedTarget = accumulator.targetsBySourceSymbol.get(sourceSymbol);
  const rule = resolveBulkCategoryRule(file.path);

  if (!matchedTarget && (!rule || rule.kind === "unsupported")) {
    return;
  }

  if (rule?.kind === "unsupported") {
    if (matchedTarget) {
      accumulator.symbolsBySourceSymbol.set(sourceSymbol, {
        ...matchedTarget,
        id: buildBulkSymbolId(matchedTarget),
        importStatus: "unsupported",
        lastImportError: rule.reason,
        source: "stooq",
      });
    }
    return;
  }

  if (!matchedTarget) {
    accumulator.failures.push({
      path: file.path,
      reason: `No import target was registered for ${sourceSymbol}.`,
      sourceSymbol,
    });
    return;
  }

  try {
    const bars = parseStooqAsciiDailyPriceText(file.content, matchedTarget);

    if (bars.length === 0) {
      accumulator.symbolsBySourceSymbol.set(sourceSymbol, {
        ...matchedTarget,
        id: buildBulkSymbolId(matchedTarget),
        importStatus: "noData",
        source: "stooq",
      });
      return;
    }

    accumulator.histories.push({
      bars,
      currency: matchedTarget.currency,
      instrumentType: resolveInstrumentTypeFromRule(rule, matchedTarget),
      region: matchedTarget.region,
      sourceSymbol: matchedTarget.sourceSymbol,
      symbolId: buildBulkSymbolId(matchedTarget),
    });
    accumulator.symbolsBySourceSymbol.set(sourceSymbol, {
      ...matchedTarget,
      id: buildBulkSymbolId(matchedTarget),
      importStatus: "imported",
      source: "stooq",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown bulk parsing error.";
    accumulator.failures.push({
      path: file.path,
      reason,
      sourceSymbol,
    });
    accumulator.symbolsBySourceSymbol.set(sourceSymbol, {
      ...matchedTarget,
      id: buildBulkSymbolId(matchedTarget),
      importStatus: "failed",
      lastImportError: reason,
      source: "stooq",
    });
  }
}

export function finalizeStooqBulkNormalizationAccumulator(
  accumulator: StooqBulkNormalizationAccumulator,
): StooqBulkNormalizationResult {
  return {
    failures: accumulator.failures,
    histories: accumulator.histories.sort((left, right) =>
      left.sourceSymbol.localeCompare(right.sourceSymbol),
    ),
    symbols: [...accumulator.symbolsBySourceSymbol.values()].sort((left, right) =>
      left.sourceSymbol.localeCompare(right.sourceSymbol),
    ),
  };
}

export function parseStooqAsciiDailyPriceText(
  content: string,
  target: Pick<StooqBulkImportTarget, "code" | "currency" | "region" | "sourceSymbol">,
): DailyPriceBar[] {
  const rawLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return [];
  }

  const lines = isAsciiHeaderLine(rawLines[0]) ? rawLines.slice(1) : rawLines;

  if (lines.length === 0) {
    return [];
  }

  return lines
    .map((line) => parseAsciiRow(line, target))
    .filter(isAsciiRow)
    .map((row) => ({
      close: row.close,
      currency: target.currency,
      date: row.date,
      high: row.high,
      id: `${buildBulkSymbolId(target)}-${row.date}`,
      low: row.low,
      open: row.open,
      region: target.region,
      sourceSymbol: target.sourceSymbol,
      symbolId: buildBulkSymbolId(target),
      volume: row.volume,
    }));
}

export function resolveBulkCategoryRule(path: string): StooqBulkCategoryRule | null {
  const normalizedPath = path.trim().toLowerCase().replace(/\\/g, "/");
  return stooqBulkCategoryRules.find((rule) => normalizedPath.includes(rule.pathFragment)) ?? null;
}

function buildBulkSymbolId(target: Pick<StooqBulkImportTarget, "code" | "region">): string {
  return `${target.region.toLowerCase()}-${target.code.trim().toLowerCase()}`;
}

function parseAsciiRow(
  line: string,
  target: Pick<StooqBulkImportTarget, "sourceSymbol">,
): StooqAsciiRow | null {
  const columns = line
    .split(line.includes(";") ? ";" : ",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (
    columns.length !== expectedAsciiRowLength &&
    columns.length !== expectedAsciiRowLengthWithOpenInterest &&
    columns.length !== expectedStooqBulkRowLength
  ) {
    throw new Error(`Unexpected ASCII columns for ${target.sourceSymbol}.`);
  }

  const [date, open, high, low, close, volume] =
    columns.length === expectedStooqBulkRowLength
      ? [columns[2], columns[4], columns[5], columns[6], columns[7], columns[8]]
      : columns;

  if (!date || !open || !high || !low || !close || !volume) {
    throw new Error(`Incomplete ASCII row for ${target.sourceSymbol}.`);
  }

  const parsed = {
    close: Number(close),
    date: normalizeAsciiDate(date),
    high: Number(high),
    low: Number(low),
    open: Number(open),
    volume: Number(volume),
  };

  if (!isAsciiRow(parsed)) {
    throw new Error(`Unexpected ASCII values for ${target.sourceSymbol}.`);
  }

  return parsed;
}

function isAsciiRow(row: StooqAsciiRow | null): row is StooqAsciiRow {
  return (
    row !== null &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close) &&
    Number.isFinite(row.volume)
  );
}

function isAsciiHeaderLine(line: string): boolean {
  const columns = line
    .split(line.includes(";") ? ";" : ",")
    .map((value) => value.trim().toLowerCase());

  return (
    (columns.length >= expectedAsciiRowLength &&
      columns[0] === "date" &&
      columns[1] === "open" &&
      columns[2] === "high" &&
      columns[3] === "low" &&
      columns[4] === "close") ||
    (columns.length >= expectedStooqBulkRowLength &&
      columns[0] === "<ticker>" &&
      columns[2] === "<date>" &&
      columns[4] === "<open>" &&
      columns[7] === "<close>")
  );
}

function normalizeAsciiDate(rawDate: string): string {
  if (/^\d{8}$/.test(rawDate)) {
    return `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
  }

  return rawDate;
}

function normalizeSourceSymbol(sourceSymbol: string): string {
  return sourceSymbol.trim().toLowerCase();
}

function resolveInstrumentTypeFromRule(
  _rule: SupportedBulkCategoryRule | null,
  target: StooqBulkImportTarget,
): StooqInstrumentType {
  return target.instrumentType;
}

export function resolveSourceSymbolFromPath(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/").trim();
  const fileName = normalizedPath.split("/").at(-1) ?? normalizedPath;
  return fileName.replace(/\.(csv|txt)$/i, "");
}

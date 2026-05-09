import type {
  DailyPriceBar,
  PortfolioHolding,
  RegionCode,
  StockDetailPayload,
  StockDetailRequest,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";
import { fetchStockDetail } from "./syncApi";

export const defaultStopLossRatio = 0.92;

export type StockDetailChartVisibility = {
  buyPrice: boolean;
  ma25: boolean;
  ma75: boolean;
  recentHigh: boolean;
  stopLoss: boolean;
};

export const defaultStockDetailChartVisibility: StockDetailChartVisibility = {
  buyPrice: true,
  ma25: true,
  ma75: true,
  recentHigh: false,
  stopLoss: false,
};

export type StockDetailMetric = {
  label: string;
  note?: string;
  value: string;
};

export type StockDetailTrendSignal = {
  description: string;
  label: string;
  tone: "positive" | "neutral" | "warning";
  value: string;
};

export type StockDetailChartPoint = {
  time: string;
  value: number;
};

export type StockDetailCandlestickPoint = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: string;
};

export type StockDetailVolumePoint = {
  color: string;
  time: string;
  value: number;
};

export type StockDetailChartData = {
  buyPrice: StockDetailChartPoint[] | null;
  candlesticks: StockDetailCandlestickPoint[];
  ma25: StockDetailChartPoint[];
  ma75: StockDetailChartPoint[];
  recentHigh: StockDetailChartPoint[] | null;
  stopLoss: StockDetailChartPoint[] | null;
  volume: StockDetailVolumePoint[];
};

export type StockDetailPageData = {
  chartData: StockDetailChartData;
  datasetVersion: string;
  generatedAt: string;
  holding: PortfolioHolding | null;
  importStatusLabel: string;
  insightLines: string[];
  latestBar: DailyPriceBar | null;
  marketLabel: string;
  priceMetrics: StockDetailMetric[];
  symbol: StockDetailPayload["symbol"];
  trendSignals: StockDetailTrendSignal[];
};

export async function loadStockDetailPageData(
  request: StockDetailRequest,
): Promise<StockDetailPageData | null> {
  const cachedSymbol = await loadCachedSymbol(request);

  try {
    const payload = await fetchStockDetail(
      {
        region: request.region ?? cachedSymbol?.region ?? null,
        symbolCode: request.symbolCode,
      },
      { activity: "background" },
    );

    return buildStockDetailPageData(payload);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }

    throw error;
  }
}

export function buildStockDetailPageData(payload: StockDetailPayload): StockDetailPageData {
  const history = sortPriceHistory(payload.priceHistory);
  const latestBar = history.at(-1) ?? null;
  const previousBar = history.at(-2) ?? null;
  const currentClose = latestBar?.close ?? payload.symbol.lastClose;
  const priceChange = latestBar && previousBar ? latestBar.close - previousBar.close : null;
  const priceChangeRate =
    priceChange !== null && previousBar && previousBar.close > 0
      ? (priceChange / previousBar.close) * 100
      : null;
  const trailingHistory = history.slice(-252);
  const week52High = getMaxValue(trailingHistory.map((bar) => bar.high));
  const week52Low = getMinValue(trailingHistory.map((bar) => bar.low));
  const ma25Values = calculateSimpleMovingAverage(history, 25);
  const ma75Values = calculateSimpleMovingAverage(history, 75);
  const ma25Latest = ma25Values.at(-1)?.value ?? null;
  const ma25Previous = ma25Values.at(-2)?.value ?? null;
  const ma75Latest = ma75Values.at(-1)?.value ?? null;
  const recentHighValue = getMaxValue(trailingHistory.map((bar) => bar.high));
  const buyPrice = payload.holding?.averagePrice ?? null;
  const stopLossPrice = buyPrice ? roundToPriceTick(buyPrice * defaultStopLossRatio) : null;
  const chartData = buildChartData({
    buyPrice,
    history,
    ma25Values,
    ma75Values,
    recentHighValue,
    stopLossPrice,
  });

  return {
    chartData,
    datasetVersion: payload.datasetVersion,
    generatedAt: payload.generatedAt,
    holding: payload.holding,
    importStatusLabel: payload.importStatus === "ready" ? "終値取得済み" : "終値未取得",
    insightLines: buildInsightLines({
      buyPrice,
      currency: payload.symbol.currency,
      currentClose,
      ma25Latest,
      priceChangeRate,
      recentHighValue,
      stopLossPrice,
    }),
    latestBar,
    marketLabel: regionLabelMap[payload.symbol.region],
    priceMetrics: [
      {
        label: "終値",
        note: payload.symbol.lastCloseDate ?? undefined,
        value:
          currentClose !== null
            ? formatCurrency(currentClose, payload.symbol.currency)
            : "終値未取得",
      },
      {
        label: "前日比",
        note:
          priceChange !== null && priceChangeRate !== null
            ? `${formatSignedCurrency(priceChange, payload.symbol.currency)} / ${formatSignedPercent(
                priceChangeRate,
              )}`
            : undefined,
        value:
          priceChangeRate !== null
            ? formatSignedPercent(priceChangeRate)
            : "前日値なし",
      },
      {
        label: "高値 / 安値",
        value:
          latestBar !== null
            ? `${formatCurrency(latestBar.high, payload.symbol.currency)} / ${formatCurrency(
                latestBar.low,
                payload.symbol.currency,
              )}`
            : "-",
      },
      {
        label: "出来高",
        value: latestBar !== null ? formatVolume(latestBar.volume) : "-",
      },
      {
        label: "52週高値 / 安値",
        value:
          week52High !== null && week52Low !== null
            ? `${formatCurrency(week52High, payload.symbol.currency)} / ${formatCurrency(
                week52Low,
                payload.symbol.currency,
              )}`
            : "-",
      },
      {
        label: "為替 / 状態",
        note: payload.latestExchangeRate?.date ?? undefined,
        value: payload.latestExchangeRate
          ? `${payload.latestExchangeRate.pair} ${formatDecimal(payload.latestExchangeRate.close)}`
          : payload.symbol.currency === "JPY"
            ? "JPY建て"
            : payload.importStatus === "ready"
              ? "為替未取得"
              : "終値未取得",
      },
    ],
    symbol: payload.symbol,
    trendSignals: [
      {
        description:
          ma25Latest === null
            ? "25営業日分のデータがまだ足りません。"
            : ma25Previous !== null && ma25Latest > ma25Previous
              ? "25MA が上向きで、短期トレンドは改善中です。"
              : "25MA は横ばい〜下向きで、勢いはまだ限定的です。",
        label: "25MA",
        tone:
          ma25Latest !== null && currentClose !== null && currentClose >= ma25Latest ? "positive" : "warning",
        value:
          ma25Latest !== null && currentClose !== null && currentClose >= ma25Latest ? "上回り" : "下回り",
      },
      {
        description:
          ma75Latest === null
            ? "75営業日分のデータがまだ足りません。"
            : currentClose !== null && currentClose >= ma75Latest
              ? "75MA の上で推移していて、中期トレンドは維持されています。"
              : "75MA を下回っていて、中期トレンドは慎重に見たい状態です。",
        label: "75MA",
        tone:
          ma75Latest !== null && currentClose !== null && currentClose >= ma75Latest ? "positive" : "neutral",
        value:
          ma75Latest !== null && currentClose !== null && currentClose >= ma75Latest ? "上回り" : "下回り",
      },
      {
        description:
          recentHighValue !== null && currentClose !== null
            ? "直近高値にどれだけ近いかを見て、追いかけすぎを避けます。"
            : "直近高値を計算できるだけの履歴がまだありません。",
        label: "高値接近率",
        tone:
          recentHighValue !== null && currentClose !== null && currentClose / recentHighValue >= 0.95
            ? "warning"
            : "neutral",
        value:
          recentHighValue !== null && currentClose !== null
            ? `${Math.round((currentClose / recentHighValue) * 100)}%`
            : "-",
      },
    ],
  };
}

function buildChartData({
  buyPrice,
  history,
  ma25Values,
  ma75Values,
  recentHighValue,
  stopLossPrice,
}: {
  buyPrice: number | null;
  history: DailyPriceBar[];
  ma25Values: StockDetailChartPoint[];
  ma75Values: StockDetailChartPoint[];
  recentHighValue: number | null;
  stopLossPrice: number | null;
}): StockDetailChartData {
  const times = history.map((bar) => bar.date);

  return {
    buyPrice: buyPrice !== null ? buildConstantLine(times, buyPrice) : null,
    candlesticks: history.map((bar) => ({
      close: bar.close,
      high: bar.high,
      low: bar.low,
      open: bar.open,
      time: bar.date,
    })),
    ma25: ma25Values,
    ma75: ma75Values,
    recentHigh: recentHighValue !== null ? buildConstantLine(times, recentHighValue) : null,
    stopLoss: stopLossPrice !== null ? buildConstantLine(times, stopLossPrice) : null,
    volume: history.map((bar) => ({
      color: bar.close >= bar.open ? "#0f766e" : "#d97706",
      time: bar.date,
      value: bar.volume,
    })),
  };
}

function buildConstantLine(times: string[], value: number): StockDetailChartPoint[] {
  return times.map((time) => ({ time, value }));
}

function buildInsightLines({
  buyPrice,
  currency,
  currentClose,
  ma25Latest,
  priceChangeRate,
  recentHighValue,
  stopLossPrice,
}: {
  buyPrice: number | null;
  currency: StockDetailPayload["symbol"]["currency"];
  currentClose: number | null;
  ma25Latest: number | null;
  priceChangeRate: number | null;
  recentHighValue: number | null;
  stopLossPrice: number | null;
}): string[] {
  const lines: string[] = [];

  if (currentClose !== null && ma25Latest !== null) {
    lines.push(
      currentClose >= ma25Latest
        ? "終値は 25MA の上にあり、短期の勢いは保たれています。"
        : "終値は 25MA の下にあり、反発確認までは慎重に見ます。",
    );
  }

  if (currentClose !== null && recentHighValue !== null) {
    const ratio = currentClose / recentHighValue;
    if (ratio >= 0.97) {
      lines.push("直近高値圏にあり、追いかけ買いにならないかを確認したい場面です。");
    } else if (ratio >= 0.9) {
      lines.push("直近高値から大きく離れておらず、押し目候補として見やすい位置です。");
    }
  }

  if (buyPrice !== null && stopLossPrice !== null && currentClose !== null) {
    lines.push(
      `保有買値 ${formatCurrency(buyPrice, currency)} に対して、損切り目安を ${formatCurrency(
        stopLossPrice,
        currency,
      )} に置いて確認できます。`,
    );
  } else {
    lines.push("保有を登録すると、買値ラインと損切りラインをチャートに重ねて確認できます。");
  }

  if (priceChangeRate !== null) {
    lines.push(
      priceChangeRate >= 0
        ? `前日比は ${formatSignedPercent(priceChangeRate)} で引けています。`
        : `前日比は ${formatSignedPercent(priceChangeRate)} で、押し目か失速かを見分けたい場面です。`,
    );
  }

  return lines.slice(0, 3);
}

function calculateSimpleMovingAverage(
  history: DailyPriceBar[],
  windowSize: number,
): StockDetailChartPoint[] {
  const values: StockDetailChartPoint[] = [];
  let rollingSum = 0;

  for (let index = 0; index < history.length; index += 1) {
    rollingSum += history[index]!.close;

    if (index >= windowSize) {
      rollingSum -= history[index - windowSize]!.close;
    }

    if (index >= windowSize - 1) {
      values.push({
        time: history[index]!.date,
        value: roundToPriceTick(rollingSum / windowSize),
      });
    }
  }

  return values;
}

async function loadCachedSymbol(
  request: StockDetailRequest,
): Promise<StoredStockSymbol | null> {
  const db = await openStockPrepDb();

  try {
    const repository = createStockPrepDbRepository(db);

    if (request.region) {
      return repository.getSymbolByCodeRegion(request.symbolCode, request.region);
    }

    const symbols = await repository.listSymbols();

    return (
      symbols.find((symbol) => symbol.code === request.symbolCode) ??
      symbols.find((symbol) => symbol.sourceSymbol.startsWith(request.symbolCode.toLowerCase())) ??
      null
    );
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function sortPriceHistory(history: DailyPriceBar[]): DailyPriceBar[] {
  return [...history].sort((left, right) => left.date.localeCompare(right.date));
}

function getMaxValue(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function getMinValue(values: number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

function roundToPriceTick(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number, currency: StockDetailPayload["symbol"]["currency"]): string {
  return new Intl.NumberFormat("ja-JP", {
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatSignedCurrency(
  value: number,
  currency: StockDetailPayload["symbol"]["currency"],
): string {
  const formatted = formatCurrency(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatVolume(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}株`;
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

const regionLabelMap: Record<RegionCode, string> = {
  HK: "香港",
  JP: "日本",
  US: "米国",
};

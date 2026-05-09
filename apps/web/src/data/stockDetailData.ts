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
  bollinger: boolean;
  buyPrice: boolean;
  macd: boolean;
  ma25: boolean;
  ma75: boolean;
  recentHigh: boolean;
  rsi: boolean;
  stopLoss: boolean;
};

export const defaultStockDetailChartVisibility: StockDetailChartVisibility = {
  bollinger: false,
  buyPrice: true,
  macd: false,
  ma25: true,
  ma75: true,
  recentHigh: false,
  rsi: false,
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

export type StockDetailHistogramPoint = {
  color: string;
  time: string;
  value: number;
};

export type StockDetailChartData = {
  bollingerLower: StockDetailChartPoint[];
  bollingerMiddle: StockDetailChartPoint[];
  bollingerUpper: StockDetailChartPoint[];
  buyPrice: StockDetailChartPoint[] | null;
  candlesticks: StockDetailCandlestickPoint[];
  macdHistogram: StockDetailHistogramPoint[];
  macdLine: StockDetailChartPoint[];
  macdSignal: StockDetailChartPoint[];
  ma25: StockDetailChartPoint[];
  ma75: StockDetailChartPoint[];
  recentHigh: StockDetailChartPoint[] | null;
  rsi: StockDetailChartPoint[];
  rsiLowerBand: StockDetailChartPoint[];
  rsiUpperBand: StockDetailChartPoint[];
  stopLoss: StockDetailChartPoint[] | null;
  volume: StockDetailVolumePoint[];
};

type BollingerBandPoint = {
  lower: number;
  middle: number;
  time: string;
  upper: number;
};

type MacdPoint = {
  histogram: number;
  macd: number;
  signal: number;
  time: string;
};

type TrendContext = "downtrend" | "range" | "uptrend";

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
  const rsi14Values = calculateRsi(history, 14);
  const bollinger20Values = calculateBollingerBands(history, 20, 2);
  const macdValues = calculateMacd(history, 12, 26, 9);
  const ma25Latest = ma25Values.at(-1)?.value ?? null;
  const ma25Previous = ma25Values.at(-2)?.value ?? null;
  const ma75Latest = ma75Values.at(-1)?.value ?? null;
  const rsi14Latest = rsi14Values.at(-1)?.value ?? null;
  const rsi14Previous = rsi14Values.at(-2)?.value ?? null;
  const latestBollinger = bollinger20Values.at(-1) ?? null;
  const latestMacd = macdValues.at(-1) ?? null;
  const previousMacd = macdValues.at(-2) ?? null;
  const recentHighValue = getMaxValue(trailingHistory.map((bar) => bar.high));
  const buyPrice = payload.holding?.averagePrice ?? null;
  const stopLossPrice = buyPrice ? roundToPriceTick(buyPrice * defaultStopLossRatio) : null;
  const trendContext = resolveTrendContext({
    currentClose,
    ma25Latest,
    ma25Previous,
    ma75Latest,
  });
  const chartData = buildChartData({
    bollingerValues: bollinger20Values,
    buyPrice,
    history,
    macdValues,
    ma25Values,
    ma75Values,
    recentHighValue,
    rsi14Values,
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
      bollinger: latestBollinger,
      currency: payload.symbol.currency,
      currentClose,
      latestMacd,
      ma25Latest,
      previousMacd,
      priceChangeRate,
      recentHighValue,
      rsi14Latest,
      rsi14Previous,
      stopLossPrice,
      trendContext,
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
        description: buildRsiDescription({
          previousRsi: rsi14Previous,
          rsi: rsi14Latest,
          trendContext,
        }),
        label: "RSI(14)",
        tone: resolveRsiTone({
          previousRsi: rsi14Previous,
          rsi: rsi14Latest,
          trendContext,
        }),
        value: formatRsiValue(rsi14Latest),
      },
      {
        description: buildMacdDescription({
          latest: latestMacd,
          previous: previousMacd,
        }),
        label: "MACD(12,26,9)",
        tone: resolveMacdTone({
          latest: latestMacd,
          previous: previousMacd,
        }),
        value: formatMacdValue(latestMacd),
      },
      {
        description: buildBollingerDescription({
          bollinger: latestBollinger,
          currentClose,
          trendContext,
        }),
        label: "ボリンジャー(20,±2σ)",
        tone: resolveBollingerTone({
          bollinger: latestBollinger,
          currentClose,
          trendContext,
        }),
        value: formatBollingerValue({
          bollinger: latestBollinger,
          currentClose,
          recentHighValue,
        }),
      },
    ],
  };
}

function buildChartData({
  bollingerValues,
  buyPrice,
  history,
  macdValues,
  ma25Values,
  ma75Values,
  recentHighValue,
  rsi14Values,
  stopLossPrice,
}: {
  bollingerValues: BollingerBandPoint[];
  buyPrice: number | null;
  history: DailyPriceBar[];
  macdValues: MacdPoint[];
  ma25Values: StockDetailChartPoint[];
  ma75Values: StockDetailChartPoint[];
  recentHighValue: number | null;
  rsi14Values: StockDetailChartPoint[];
  stopLossPrice: number | null;
}): StockDetailChartData {
  const times = history.map((bar) => bar.date);

  return {
    bollingerLower: bollingerValues.map((point) => ({ time: point.time, value: point.lower })),
    bollingerMiddle: bollingerValues.map((point) => ({ time: point.time, value: point.middle })),
    bollingerUpper: bollingerValues.map((point) => ({ time: point.time, value: point.upper })),
    buyPrice: buyPrice !== null ? buildConstantLine(times, buyPrice) : null,
    candlesticks: history.map((bar) => ({
      close: bar.close,
      high: bar.high,
      low: bar.low,
      open: bar.open,
      time: bar.date,
    })),
    macdHistogram: macdValues.map((point) => ({
      color: point.histogram >= 0 ? "#0f766e" : "#d97706",
      time: point.time,
      value: point.histogram,
    })),
    macdLine: macdValues.map((point) => ({ time: point.time, value: point.macd })),
    macdSignal: macdValues.map((point) => ({ time: point.time, value: point.signal })),
    ma25: ma25Values,
    ma75: ma75Values,
    recentHigh: recentHighValue !== null ? buildConstantLine(times, recentHighValue) : null,
    rsi: rsi14Values,
    rsiLowerBand: buildConstantLine(times, 30),
    rsiUpperBand: buildConstantLine(times, 70),
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
  bollinger,
  currency,
  currentClose,
  latestMacd,
  ma25Latest,
  previousMacd,
  priceChangeRate,
  recentHighValue,
  rsi14Latest,
  rsi14Previous,
  stopLossPrice,
  trendContext,
}: {
  buyPrice: number | null;
  bollinger: BollingerBandPoint | null;
  currency: StockDetailPayload["symbol"]["currency"];
  currentClose: number | null;
  latestMacd: MacdPoint | null;
  ma25Latest: number | null;
  previousMacd: MacdPoint | null;
  priceChangeRate: number | null;
  recentHighValue: number | null;
  rsi14Latest: number | null;
  rsi14Previous: number | null;
  stopLossPrice: number | null;
  trendContext: TrendContext;
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

  const rsiLine = buildRsiInsightLine({
    previousRsi: rsi14Previous,
    rsi: rsi14Latest,
    trendContext,
  });

  if (rsiLine !== null) {
    lines.push(rsiLine);
  }

  const bollingerLine = buildBollingerInsightLine({
    bollinger,
    currentClose,
    trendContext,
  });

  if (bollingerLine !== null) {
    lines.push(bollingerLine);
  }

  const macdLine = buildMacdInsightLine({
    latest: latestMacd,
    previous: previousMacd,
  });

  if (macdLine !== null) {
    lines.push(macdLine);
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

  return lines.slice(0, 5);
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

function calculateRsi(history: DailyPriceBar[], period: number): StockDetailChartPoint[] {
  if (history.length <= period) {
    return [];
  }

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const diff = history[index]!.close - history[index - 1]!.close;
    averageGain += diff > 0 ? diff : 0;
    averageLoss += diff < 0 ? Math.abs(diff) : 0;
  }

  averageGain /= period;
  averageLoss /= period;

  const values: StockDetailChartPoint[] = [
    {
      time: history[period]!.date,
      value: roundToPriceTick(resolveRsiValue(averageGain, averageLoss)),
    },
  ];

  for (let index = period + 1; index < history.length; index += 1) {
    const diff = history[index]!.close - history[index - 1]!.close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;

    values.push({
      time: history[index]!.date,
      value: roundToPriceTick(resolveRsiValue(averageGain, averageLoss)),
    });
  }

  return values;
}

function resolveRsiValue(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateBollingerBands(
  history: DailyPriceBar[],
  period: number,
  standardDeviationMultiplier: number,
): BollingerBandPoint[] {
  const values: BollingerBandPoint[] = [];

  for (let index = period - 1; index < history.length; index += 1) {
    const window = history.slice(index - period + 1, index + 1);
    const closes = window.map((bar) => bar.close);
    const middle = closes.reduce((sum, close) => sum + close, 0) / closes.length;
    const variance =
      closes.reduce((sum, close) => sum + (close - middle) ** 2, 0) / closes.length;
    const deviation = Math.sqrt(variance);

    values.push({
      lower: roundToPriceTick(middle - standardDeviationMultiplier * deviation),
      middle: roundToPriceTick(middle),
      time: history[index]!.date,
      upper: roundToPriceTick(middle + standardDeviationMultiplier * deviation),
    });
  }

  return values;
}

function calculateMacd(
  history: DailyPriceBar[],
  shortPeriod: number,
  longPeriod: number,
  signalPeriod: number,
): MacdPoint[] {
  const shortEma = calculateExponentialMovingAverage(history, shortPeriod);
  const longEma = calculateExponentialMovingAverage(history, longPeriod);
  const shortMap = new Map(shortEma.map((point) => [point.time, point.value]));

  const macdBase = longEma.flatMap((point) => {
    const shortValue = shortMap.get(point.time);

    return shortValue === undefined
      ? []
      : [
          {
            time: point.time,
            value: roundToPriceTick(shortValue - point.value),
          },
        ];
  });

  const signalSeries = calculateExponentialMovingAverageFromPoints(macdBase, signalPeriod);
  const signalMap = new Map(signalSeries.map((point) => [point.time, point.value]));

  return macdBase.flatMap((point) => {
    const signal = signalMap.get(point.time);

    return signal === undefined
      ? []
      : [
          {
            histogram: roundToPriceTick(point.value - signal),
            macd: point.value,
            signal,
            time: point.time,
          },
        ];
  });
}

function calculateExponentialMovingAverage(
  history: DailyPriceBar[],
  period: number,
): StockDetailChartPoint[] {
  return calculateExponentialMovingAverageFromPoints(
    history.map((bar) => ({ time: bar.date, value: bar.close })),
    period,
  );
}

function calculateExponentialMovingAverageFromPoints(
  points: StockDetailChartPoint[],
  period: number,
): StockDetailChartPoint[] {
  if (points.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  let ema = points.slice(0, period).reduce((sum, point) => sum + point.value, 0) / period;
  const values: StockDetailChartPoint[] = [
    {
      time: points[period - 1]!.time,
      value: roundToPriceTick(ema),
    },
  ];

  for (let index = period; index < points.length; index += 1) {
    ema = (points[index]!.value - ema) * multiplier + ema;
    values.push({
      time: points[index]!.time,
      value: roundToPriceTick(ema),
    });
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

function resolveTrendContext({
  currentClose,
  ma25Latest,
  ma25Previous,
  ma75Latest,
}: {
  currentClose: number | null;
  ma25Latest: number | null;
  ma25Previous: number | null;
  ma75Latest: number | null;
}): TrendContext {
  if (
    currentClose !== null &&
    ma25Latest !== null &&
    ma25Previous !== null &&
    ma75Latest !== null &&
    currentClose >= ma25Latest &&
    ma25Latest >= ma75Latest &&
    ma25Latest > ma25Previous
  ) {
    return "uptrend";
  }

  if (
    currentClose !== null &&
    ma25Latest !== null &&
    ma25Previous !== null &&
    ma75Latest !== null &&
    currentClose <= ma25Latest &&
    ma25Latest <= ma75Latest &&
    ma25Latest < ma25Previous
  ) {
    return "downtrend";
  }

  return "range";
}

function buildRsiDescription({
  previousRsi,
  rsi,
  trendContext,
}: {
  previousRsi: number | null;
  rsi: number | null;
  trendContext: TrendContext;
}): string {
  if (rsi === null) {
    return "14営業日分のデータがまだ足りず、RSI を計算できません。";
  }

  if (trendContext === "uptrend" && rsi >= 40 && rsi <= 50 && previousRsi !== null && rsi > previousRsi) {
    return "上昇トレンド中に RSI が 40〜50 付近で反発していて、押し目候補として見やすい状態です。";
  }

  if (
    trendContext === "downtrend" &&
    rsi >= 50 &&
    rsi <= 60 &&
    previousRsi !== null &&
    rsi < previousRsi
  ) {
    return "下落トレンド中に RSI が 50〜60 付近で跳ね返されていて、戻り売り候補として見やすい状態です。";
  }

  if (trendContext === "range") {
    if (rsi <= 30) {
      return "レンジ相場の下限寄りで、RSI 30 付近からの反発を確認したい場面です。";
    }

    if (rsi >= 70) {
      return "レンジ相場の上限寄りで、RSI 70 付近からの失速を警戒したい場面です。";
    }
  }

  return rsi >= 50 ? "RSI は 50 を上回り、上方向の勢いがやや優勢です。" : "RSI は 50 を下回り、勢いはまだ慎重に見たい状態です。";
}

function resolveRsiTone({
  previousRsi,
  rsi,
  trendContext,
}: {
  previousRsi: number | null;
  rsi: number | null;
  trendContext: TrendContext;
}): StockDetailTrendSignal["tone"] {
  if (rsi === null) {
    return "neutral";
  }

  if (trendContext === "uptrend" && rsi >= 40 && rsi <= 50 && previousRsi !== null && rsi > previousRsi) {
    return "positive";
  }

  if (
    trendContext === "downtrend" &&
    rsi >= 50 &&
    rsi <= 60 &&
    previousRsi !== null &&
    rsi < previousRsi
  ) {
    return "warning";
  }

  if (rsi >= 70) {
    return "warning";
  }

  if (rsi <= 30) {
    return "positive";
  }

  return "neutral";
}

function formatRsiValue(value: number | null): string {
  return value !== null ? value.toFixed(1) : "-";
}

function buildMacdDescription({
  latest,
  previous,
}: {
  latest: MacdPoint | null;
  previous: MacdPoint | null;
}): string {
  if (latest === null) {
    return "MACD を計算できるだけの履歴がまだ足りません。";
  }

  const crossover =
    previous !== null && previous.macd <= previous.signal && latest.macd > latest.signal
      ? "MACD がシグナルを上抜け、買いシグナル候補です。"
      : previous !== null && previous.macd >= previous.signal && latest.macd < latest.signal
        ? "MACD がシグナルを下抜け、売りシグナル候補です。"
        : latest.macd >= latest.signal
          ? "MACD はシグナル線の上にあり、勢いは上向き寄りです。"
          : "MACD はシグナル線の下にあり、勢いは慎重に見たい状態です。";

  const baseline =
    latest.macd >= 0
      ? "0ラインの上で推移していて、上昇基調の見方を維持しやすいです。"
      : "0ラインの下で推移していて、下落基調の見方が優勢です。";

  const histogram =
    previous !== null
      ? Math.abs(latest.histogram) > Math.abs(previous.histogram)
        ? "ヒストグラムは拡大していて、勢いが強まっています。"
        : "ヒストグラムは縮小していて、勢いはやや落ち着いています。"
      : "ヒストグラムの変化は次回更新を見て確認します。";

  return `${crossover} ${baseline} ${histogram}`;
}

function resolveMacdTone({
  latest,
  previous,
}: {
  latest: MacdPoint | null;
  previous: MacdPoint | null;
}): StockDetailTrendSignal["tone"] {
  if (latest === null) {
    return "neutral";
  }

  if (previous !== null && previous.macd <= previous.signal && latest.macd > latest.signal) {
    return "positive";
  }

  if (previous !== null && previous.macd >= previous.signal && latest.macd < latest.signal) {
    return "warning";
  }

  return latest.macd >= 0 ? "positive" : "neutral";
}

function formatMacdValue(value: MacdPoint | null): string {
  if (value === null) {
    return "-";
  }

  return `${value.macd.toFixed(2)} / ${value.signal.toFixed(2)}`;
}

function buildBollingerDescription({
  bollinger,
  currentClose,
  trendContext,
}: {
  bollinger: BollingerBandPoint | null;
  currentClose: number | null;
  trendContext: TrendContext;
}): string {
  if (bollinger === null || currentClose === null) {
    return "ボリンジャーバンドを計算できるだけの履歴がまだ足りません。";
  }

  if (trendContext === "uptrend" && currentClose >= bollinger.upper * 0.99) {
    return "上側バンドに沿って上昇していて、強い上昇トレンドのバンドウォークを意識したい状態です。";
  }

  if (trendContext === "downtrend" && currentClose <= bollinger.lower * 1.01) {
    return "下側バンドに沿って下落していて、強い下落トレンドのバンドウォークを警戒したい状態です。";
  }

  if (trendContext === "range") {
    if (currentClose >= bollinger.upper * 0.98) {
      return "レンジ上限寄りで、上側バンド付近の行き過ぎ感を確認したい場面です。";
    }

    if (currentClose <= bollinger.lower * 1.02) {
      return "レンジ下限寄りで、下側バンド付近からの反発余地を見たい場面です。";
    }
  }

  return currentClose >= bollinger.middle
    ? "中心線の上で推移していて、平均より強い位置を保っています。"
    : "中心線の下で推移していて、平均回帰できるかを見たい状態です。";
}

function resolveBollingerTone({
  bollinger,
  currentClose,
  trendContext,
}: {
  bollinger: BollingerBandPoint | null;
  currentClose: number | null;
  trendContext: TrendContext;
}): StockDetailTrendSignal["tone"] {
  if (bollinger === null || currentClose === null) {
    return "neutral";
  }

  if (trendContext === "uptrend" && currentClose >= bollinger.upper * 0.99) {
    return "positive";
  }

  if (trendContext === "downtrend" && currentClose <= bollinger.lower * 1.01) {
    return "warning";
  }

  if (trendContext === "range" && currentClose >= bollinger.upper * 0.98) {
    return "warning";
  }

  if (trendContext === "range" && currentClose <= bollinger.lower * 1.02) {
    return "positive";
  }

  return "neutral";
}

function formatBollingerValue({
  bollinger,
  currentClose,
  recentHighValue,
}: {
  bollinger: BollingerBandPoint | null;
  currentClose: number | null;
  recentHighValue: number | null;
}): string {
  if (bollinger === null || currentClose === null) {
    return recentHighValue !== null && currentClose !== null
      ? `${Math.round((currentClose / recentHighValue) * 100)}%`
      : "-";
  }

  const upperDistance = ((bollinger.upper - currentClose) / currentClose) * 100;
  const lowerDistance = ((currentClose - bollinger.lower) / currentClose) * 100;

  return `上 +${upperDistance.toFixed(1)}% / 下 -${lowerDistance.toFixed(1)}%`;
}

function buildRsiInsightLine({
  previousRsi,
  rsi,
  trendContext,
}: {
  previousRsi: number | null;
  rsi: number | null;
  trendContext: TrendContext;
}): string | null {
  if (rsi === null) {
    return null;
  }

  if (trendContext === "uptrend" && rsi >= 40 && rsi <= 50 && previousRsi !== null && rsi > previousRsi) {
    return "RSI(14) は 40〜50 付近から反発していて、上昇トレンド中の押し目候補として見やすいです。";
  }

  if (
    trendContext === "downtrend" &&
    rsi >= 50 &&
    rsi <= 60 &&
    previousRsi !== null &&
    rsi < previousRsi
  ) {
    return "RSI(14) は 50〜60 付近で跳ね返されていて、下落トレンド中の戻り売り候補を意識したいです。";
  }

  if (trendContext === "range" && rsi <= 30) {
    return "RSI(14) は 30 付近で、レンジ下限からの反発候補として見やすい位置です。";
  }

  if (trendContext === "range" && rsi >= 70) {
    return "RSI(14) は 70 付近で、レンジ上限の行き過ぎを警戒したい位置です。";
  }

  return null;
}

function buildBollingerInsightLine({
  bollinger,
  currentClose,
  trendContext,
}: {
  bollinger: BollingerBandPoint | null;
  currentClose: number | null;
  trendContext: TrendContext;
}): string | null {
  if (bollinger === null || currentClose === null) {
    return null;
  }

  if (trendContext === "uptrend" && currentClose >= bollinger.upper * 0.99) {
    return "ボリンジャーバンド上側に沿った上昇で、強いトレンド継続かどうかを見たい場面です。";
  }

  if (trendContext === "downtrend" && currentClose <= bollinger.lower * 1.01) {
    return "ボリンジャーバンド下側に沿った下落で、弱い流れが続いていないかを警戒したいです。";
  }

  if (trendContext === "range" && currentClose >= bollinger.upper * 0.98) {
    return "上側バンド付近で、レンジ相場なら高すぎ候補として一度落ち着きを見たい位置です。";
  }

  if (trendContext === "range" && currentClose <= bollinger.lower * 1.02) {
    return "下側バンド付近で、レンジ相場なら安すぎ候補として反発確認を待ちたい位置です。";
  }

  return null;
}

function buildMacdInsightLine({
  latest,
  previous,
}: {
  latest: MacdPoint | null;
  previous: MacdPoint | null;
}): string | null {
  if (latest === null || previous === null) {
    return null;
  }

  if (previous.macd <= previous.signal && latest.macd > latest.signal) {
    return "MACD がシグナル線を上抜けていて、勢いの改善を確認したい買いシグナル候補です。";
  }

  if (previous.macd >= previous.signal && latest.macd < latest.signal) {
    return "MACD がシグナル線を下抜けていて、勢いの鈍化を警戒したい売りシグナル候補です。";
  }

  if (Math.abs(latest.histogram) > Math.abs(previous.histogram)) {
    return latest.histogram > 0
      ? "MACD ヒストグラムは拡大していて、上方向の勢いが強まっています。"
      : "MACD ヒストグラムは拡大していて、下方向の勢いが強まっています。";
  }

  return "MACD ヒストグラムは縮小していて、直近の勢いは少し落ち着いています。";
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

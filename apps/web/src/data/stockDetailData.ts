import type {
  DailyPriceBar,
  PortfolioHolding,
  RegionCode,
  StockDetailPayload,
  StockDetailRequest,
  StoredStockSymbol,
} from "@stock-prep/shared";

import { formatPriceCurrency } from "./priceFormat";
import { createStockPrepDbRepository, openStockPrepDb } from "../storage/stockPrepDb";
import { fetchStockDetail } from "./syncApi";

export const defaultStopLossRatio = 0.92;

export type StockDetailChartVisibility = {
  bollinger: boolean;
  buyPrice: boolean;
  ichimoku: boolean;
  macd: boolean;
  ma25: boolean;
  ma75: boolean;
  recentHigh: boolean;
  rsi: boolean;
  stopLoss: boolean;
  stochastic: boolean;
};

export const defaultStockDetailChartVisibility: StockDetailChartVisibility = {
  bollinger: false,
  buyPrice: true,
  ichimoku: false,
  macd: false,
  ma25: true,
  ma75: true,
  recentHigh: false,
  rsi: false,
  stopLoss: false,
  stochastic: false,
};

export type StockDetailMetric = {
  label: string;
  note?: string;
  value: string;
};

export type StockDetailSignalGroup = "oscillator" | "trend";

export type StockDetailTrendSignal = {
  description: string;
  group: StockDetailSignalGroup;
  label: string;
  tone: "positive" | "neutral" | "warning";
  value: string;
};

export type StockDetailInsightSection = {
  lines: string[];
  title: string;
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
  ichimokuBase: StockDetailChartPoint[];
  ichimokuConversion: StockDetailChartPoint[];
  ichimokuSpanA: StockDetailChartPoint[];
  ichimokuSpanB: StockDetailChartPoint[];
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
  stochasticD: StockDetailChartPoint[];
  stochasticK: StockDetailChartPoint[];
  stochasticLowerBand: StockDetailChartPoint[];
  stochasticUpperBand: StockDetailChartPoint[];
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

type StochasticPoint = {
  d: number;
  k: number;
  time: string;
};

type IchimokuPointSet = {
  base: StockDetailChartPoint[];
  conversion: StockDetailChartPoint[];
  spanA: StockDetailChartPoint[];
  spanB: StockDetailChartPoint[];
};

type TrendContext = "downtrend" | "range" | "uptrend";

type ResolvedIchimokuState = {
  base: number | null;
  cloudLower: number | null;
  cloudUpper: number | null;
  conversion: number | null;
  pricePosition: "above-cloud" | "below-cloud" | "inside-cloud" | "unknown";
};

export type StockDetailPageData = {
  chartData: StockDetailChartData;
  datasetVersion: string;
  generatedAt: string;
  holding: PortfolioHolding | null;
  importStatusLabel: string;
  insightSections: StockDetailInsightSection[];
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
  const ichimokuValues = calculateIchimoku(history);
  const rsi14Values = calculateRsi(history, 14);
  const stochastic14Values = calculateStochastics(history, 14, 3);
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
  const latestStochastic = stochastic14Values.at(-1) ?? null;
  const previousStochastic = stochastic14Values.at(-2) ?? null;
  const latestIchimoku = resolveLatestIchimokuState({
    currentClose,
    history,
  });
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
    ichimokuValues,
    macdValues,
    ma25Values,
    ma75Values,
    recentHighValue,
    rsi14Values,
    stopLossPrice,
    stochasticValues: stochastic14Values,
  });

  return {
    chartData,
    datasetVersion: payload.datasetVersion,
    generatedAt: payload.generatedAt,
    holding: payload.holding,
    importStatusLabel: payload.importStatus === "ready" ? "終値取得済み" : "終値未取得",
    insightSections: buildInsightSections({
      buyPrice,
      bollinger: latestBollinger,
      currency: payload.symbol.currency,
      currentClose,
      ichimoku: latestIchimoku,
      latestMacd,
      ma25Latest,
      previousMacd,
      priceChangeRate,
      recentHighValue,
      rsi14Latest,
      rsi14Previous,
      stopLossPrice,
      stochastic: latestStochastic,
      previousStochastic,
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
        group: "trend",
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
        group: "trend",
        label: "75MA",
        tone:
          ma75Latest !== null && currentClose !== null && currentClose >= ma75Latest ? "positive" : "neutral",
        value:
          ma75Latest !== null && currentClose !== null && currentClose >= ma75Latest ? "上回り" : "下回り",
      },
      {
        description: buildIchimokuDescription({
          ichimoku: latestIchimoku,
        }),
        group: "trend",
        label: "一目均衡表",
        tone: resolveIchimokuTone({
          ichimoku: latestIchimoku,
        }),
        value: formatIchimokuValue(latestIchimoku),
      },
      {
        description: buildRsiDescription({
          previousRsi: rsi14Previous,
          rsi: rsi14Latest,
          trendContext,
        }),
        group: "oscillator",
        label: "RSI(14)",
        tone: resolveRsiTone({
          previousRsi: rsi14Previous,
          rsi: rsi14Latest,
          trendContext,
        }),
        value: formatRsiValue(rsi14Latest),
      },
      {
        description: buildStochasticDescription({
          latest: latestStochastic,
          previous: previousStochastic,
          trendContext,
        }),
        group: "oscillator",
        label: "ストキャスティクス",
        tone: resolveStochasticTone({
          latest: latestStochastic,
          previous: previousStochastic,
          trendContext,
        }),
        value: formatStochasticValue(latestStochastic),
      },
      {
        description: buildMacdDescription({
          latest: latestMacd,
          previous: previousMacd,
        }),
        group: "trend",
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
        group: "trend",
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
  ichimokuValues,
  macdValues,
  ma25Values,
  ma75Values,
  recentHighValue,
  rsi14Values,
  stopLossPrice,
  stochasticValues,
}: {
  bollingerValues: BollingerBandPoint[];
  buyPrice: number | null;
  history: DailyPriceBar[];
  ichimokuValues: IchimokuPointSet;
  macdValues: MacdPoint[];
  ma25Values: StockDetailChartPoint[];
  ma75Values: StockDetailChartPoint[];
  recentHighValue: number | null;
  rsi14Values: StockDetailChartPoint[];
  stopLossPrice: number | null;
  stochasticValues: StochasticPoint[];
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
    ichimokuBase: ichimokuValues.base,
    ichimokuConversion: ichimokuValues.conversion,
    ichimokuSpanA: ichimokuValues.spanA,
    ichimokuSpanB: ichimokuValues.spanB,
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
    stochasticD: stochasticValues.map((point) => ({ time: point.time, value: point.d })),
    stochasticK: stochasticValues.map((point) => ({ time: point.time, value: point.k })),
    stochasticLowerBand: buildConstantLine(times, 20),
    stochasticUpperBand: buildConstantLine(times, 80),
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

function buildInsightSections({
  buyPrice,
  bollinger,
  currency,
  currentClose,
  ichimoku,
  latestMacd,
  ma25Latest,
  previousMacd,
  priceChangeRate,
  recentHighValue,
  rsi14Latest,
  rsi14Previous,
  stopLossPrice,
  stochastic,
  previousStochastic,
  trendContext,
}: {
  buyPrice: number | null;
  bollinger: BollingerBandPoint | null;
  currency: StockDetailPayload["symbol"]["currency"];
  currentClose: number | null;
  ichimoku: ResolvedIchimokuState | null;
  latestMacd: MacdPoint | null;
  ma25Latest: number | null;
  previousMacd: MacdPoint | null;
  priceChangeRate: number | null;
  recentHighValue: number | null;
  rsi14Latest: number | null;
  rsi14Previous: number | null;
  stopLossPrice: number | null;
  stochastic: StochasticPoint | null;
  previousStochastic: StochasticPoint | null;
  trendContext: TrendContext;
}): StockDetailInsightSection[] {
  const trendLines: string[] = [];
  const oscillatorLines: string[] = [];
  const holdingLines: string[] = [];

  if (currentClose !== null && ma25Latest !== null) {
    trendLines.push(
      currentClose >= ma25Latest
        ? "終値は 25MA の上にあり、短期の勢いは保たれています。"
        : "終値は 25MA の下にあり、反発確認までは慎重に見ます。",
    );
  }

  if (currentClose !== null && recentHighValue !== null) {
    const ratio = currentClose / recentHighValue;
    if (ratio >= 0.97) {
      trendLines.push("直近高値圏にあり、追いかけ買いにならないかを確認したい場面です。");
    } else if (ratio >= 0.9) {
      trendLines.push("直近高値から大きく離れておらず、押し目候補として見やすい位置です。");
    }
  }

  const ichimokuLine = buildIchimokuInsightLine(ichimoku);

  if (ichimokuLine !== null) {
    trendLines.push(ichimokuLine);
  }

  const rsiLine = buildRsiInsightLine({
    previousRsi: rsi14Previous,
    rsi: rsi14Latest,
    trendContext,
  });

  if (rsiLine !== null) {
    oscillatorLines.push(rsiLine);
  }

  const stochasticLine = buildStochasticInsightLine({
    latest: stochastic,
    previous: previousStochastic,
    trendContext,
  });

  if (stochasticLine !== null) {
    oscillatorLines.push(stochasticLine);
  }

  const bollingerLine = buildBollingerInsightLine({
    bollinger,
    currentClose,
    trendContext,
  });

  if (bollingerLine !== null) {
    trendLines.push(bollingerLine);
  }

  const macdLine = buildMacdInsightLine({
    latest: latestMacd,
    previous: previousMacd,
  });

  if (macdLine !== null) {
    trendLines.push(macdLine);
  }

  if (buyPrice !== null && stopLossPrice !== null && currentClose !== null) {
    holdingLines.push(
      `保有買値 ${formatCurrency(buyPrice, currency)} に対して、損切り目安を ${formatCurrency(
        stopLossPrice,
        currency,
      )} に置いて確認できます。`,
    );
  } else {
    holdingLines.push(
      "保有を登録すると、買値ラインと損切りラインをチャートに重ねて確認できます。",
    );
  }

  if (priceChangeRate !== null) {
    holdingLines.push(
      priceChangeRate >= 0
        ? `前日比は ${formatSignedPercent(priceChangeRate)} で引けています。`
        : `前日比は ${formatSignedPercent(priceChangeRate)} で、押し目か失速かを見分けたい場面です。`,
    );
  }

  return [
    { lines: trendLines.slice(0, 3), title: "トレンド分析" },
    { lines: oscillatorLines.slice(0, 2), title: "オシレーター分析" },
    { lines: holdingLines.slice(0, 2), title: "保有 / 価格メモ" },
  ].filter((section) => section.lines.length > 0);
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

function calculateIchimoku(history: DailyPriceBar[]): IchimokuPointSet {
  const conversionBase = calculateHighLowMidpoint(history, 9);
  const baseBase = calculateHighLowMidpoint(history, 26);
  const spanBBase = calculateHighLowMidpoint(history, 52);
  const conversionMap = new Map(conversionBase.map((point) => [point.time, point.value]));
  const spanASeed = baseBase.flatMap((point) => {
    const conversion = conversionMap.get(point.time);

    return conversion === undefined
      ? []
      : [{ time: point.time, value: roundToPriceTick((conversion + point.value) / 2) }];
  });

  return {
    base: baseBase,
    conversion: conversionBase,
    spanA: shiftForwardPoints(history, spanASeed, 26),
    spanB: shiftForwardPoints(history, spanBBase, 26),
  };
}

function calculateStochastics(
  history: DailyPriceBar[],
  period: number,
  signalPeriod: number,
): StochasticPoint[] {
  if (history.length < period) {
    return [];
  }

  const kValues: StockDetailChartPoint[] = [];

  for (let index = period - 1; index < history.length; index += 1) {
    const window = history.slice(index - period + 1, index + 1);
    const highestHigh = Math.max(...window.map((bar) => bar.high));
    const lowestLow = Math.min(...window.map((bar) => bar.low));
    const denominator = highestHigh - lowestLow;
    const kValue =
      denominator === 0 ? 50 : ((history[index]!.close - lowestLow) / denominator) * 100;

    kValues.push({
      time: history[index]!.date,
      value: roundToPriceTick(kValue),
    });
  }

  const dValues = calculateSimpleMovingAverageFromPoints(kValues, signalPeriod);
  const dMap = new Map(dValues.map((point) => [point.time, point.value]));

  return kValues.flatMap((point) => {
    const d = dMap.get(point.time);

    return d === undefined
      ? []
      : [
          {
            d,
            k: point.value,
            time: point.time,
          },
        ];
  });
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

function calculateSimpleMovingAverageFromPoints(
  points: StockDetailChartPoint[],
  windowSize: number,
): StockDetailChartPoint[] {
  if (points.length < windowSize) {
    return [];
  }

  const values: StockDetailChartPoint[] = [];
  let rollingSum = 0;

  for (let index = 0; index < points.length; index += 1) {
    rollingSum += points[index]!.value;

    if (index >= windowSize) {
      rollingSum -= points[index - windowSize]!.value;
    }

    if (index >= windowSize - 1) {
      values.push({
        time: points[index]!.time,
        value: roundToPriceTick(rollingSum / windowSize),
      });
    }
  }

  return values;
}

function calculateHighLowMidpoint(history: DailyPriceBar[], period: number): StockDetailChartPoint[] {
  if (history.length < period) {
    return [];
  }

  const values: StockDetailChartPoint[] = [];

  for (let index = period - 1; index < history.length; index += 1) {
    const window = history.slice(index - period + 1, index + 1);
    const highestHigh = Math.max(...window.map((bar) => bar.high));
    const lowestLow = Math.min(...window.map((bar) => bar.low));

    values.push({
      time: history[index]!.date,
      value: roundToPriceTick((highestHigh + lowestLow) / 2),
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

function shiftForwardPoints(
  history: DailyPriceBar[],
  points: StockDetailChartPoint[],
  offset: number,
): StockDetailChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const times = history.map((bar) => bar.date);
  const futureTimes = buildFutureBusinessDates(times.at(-1) ?? null, offset);
  const extendedTimes = [...times, ...futureTimes];
  const timeIndexMap = new Map(extendedTimes.map((time, index) => [time, index]));

  return points.flatMap((point) => {
    const currentIndex = timeIndexMap.get(point.time);

    if (currentIndex === undefined) {
      return [];
    }

    const shiftedTime = extendedTimes[currentIndex + offset];

    return shiftedTime ? [{ time: shiftedTime, value: point.value }] : [];
  });
}

function buildFutureBusinessDates(lastDate: string | null, count: number): string[] {
  if (!lastDate || count <= 0) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(`${lastDate}T00:00:00Z`);

  while (dates.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();

    if (day === 0 || day === 6) {
      continue;
    }

    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const dayText = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${dayText}`);
  }

  return dates;
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

function resolveLatestIchimokuState({
  currentClose,
  history,
}: {
  currentClose: number | null;
  history: DailyPriceBar[];
}): ResolvedIchimokuState | null {
  if (currentClose === null) {
    return null;
  }

  const conversion = calculateHighLowMidpoint(history, 9).at(-1)?.value ?? null;
  const base = calculateHighLowMidpoint(history, 26).at(-1)?.value ?? null;
  const spanB = calculateHighLowMidpoint(history, 52).at(-1)?.value ?? null;
  const spanA =
    conversion !== null && base !== null ? roundToPriceTick((conversion + base) / 2) : null;

  if (conversion === null && base === null && spanA === null && spanB === null) {
    return null;
  }

  if (spanA === null || spanB === null) {
    return {
      base,
      cloudLower: null,
      cloudUpper: null,
      conversion,
      pricePosition: "unknown",
    };
  }

  const cloudUpper = Math.max(spanA, spanB);
  const cloudLower = Math.min(spanA, spanB);
  const pricePosition =
    currentClose > cloudUpper
      ? "above-cloud"
      : currentClose < cloudLower
        ? "below-cloud"
        : "inside-cloud";

  return {
    base,
    cloudLower,
    cloudUpper,
    conversion,
    pricePosition,
  };
}

function buildIchimokuDescription({
  ichimoku,
}: {
  ichimoku: ResolvedIchimokuState | null;
}): string {
  if (ichimoku === null) {
    return "一目均衡表を計算できるだけの履歴がまだ足りません。";
  }

  const positionText =
    ichimoku.pricePosition === "above-cloud"
      ? "株価は雲の上で推移していて、上昇基調を維持しやすい状態です。"
      : ichimoku.pricePosition === "below-cloud"
        ? "株価は雲の下で推移していて、下落基調を警戒したい状態です。"
        : ichimoku.pricePosition === "inside-cloud"
          ? "株価は雲の中にあり、方向感はまだ固まり切っていません。"
          : "雲との位置関係はまだ判断材料が不足しています。";

  const lineText =
    ichimoku.conversion !== null && ichimoku.base !== null
      ? ichimoku.conversion >= ichimoku.base
        ? "転換線が基準線を上回り、短期優勢の見方を取りやすいです。"
        : "転換線が基準線を下回り、短期の勢いは慎重に見たい状態です。"
      : "転換線と基準線の関係はまだ十分に確認できません。";

  return `${positionText} ${lineText}`;
}

function resolveIchimokuTone({
  ichimoku,
}: {
  ichimoku: ResolvedIchimokuState | null;
}): StockDetailTrendSignal["tone"] {
  if (ichimoku === null) {
    return "neutral";
  }

  if (ichimoku.pricePosition === "above-cloud" && ichimoku.conversion !== null && ichimoku.base !== null && ichimoku.conversion >= ichimoku.base) {
    return "positive";
  }

  if (ichimoku.pricePosition === "below-cloud" && ichimoku.conversion !== null && ichimoku.base !== null && ichimoku.conversion < ichimoku.base) {
    return "warning";
  }

  return "neutral";
}

function formatIchimokuValue(ichimoku: ResolvedIchimokuState | null): string {
  if (ichimoku === null) {
    return "-";
  }

  return ichimoku.pricePosition === "above-cloud"
    ? "雲の上"
    : ichimoku.pricePosition === "below-cloud"
      ? "雲の下"
      : ichimoku.pricePosition === "inside-cloud"
        ? "雲の中"
        : "未判定";
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

function buildStochasticDescription({
  latest,
  previous,
  trendContext,
}: {
  latest: StochasticPoint | null;
  previous: StochasticPoint | null;
  trendContext: TrendContext;
}): string {
  if (latest === null) {
    return "ストキャスティクスを計算できるだけの履歴がまだ足りません。";
  }

  if (
    trendContext === "uptrend" &&
    latest.k >= 40 &&
    latest.k <= 50 &&
    previous !== null &&
    latest.k > previous.k
  ) {
    return "上昇トレンド中にストキャスティクスが 40〜50 付近から反発していて、押し目候補を確認しやすい状態です。";
  }

  if (
    trendContext === "downtrend" &&
    latest.k >= 50 &&
    latest.k <= 60 &&
    previous !== null &&
    latest.k < previous.k
  ) {
    return "下落トレンド中にストキャスティクスが 50〜60 付近で失速していて、戻り売り候補を意識したい状態です。";
  }

  if (latest.k >= 80) {
    return "ストキャスティクスは 80 超で、短期的な過熱感を警戒したい位置です。";
  }

  if (latest.k <= 20) {
    return "ストキャスティクスは 20 近辺で、短期反発のきっかけを待ちたい位置です。";
  }

  return latest.k >= latest.d
    ? "ストキャスティクスは %K が %D を上回り、短期の勢いは改善寄りです。"
    : "ストキャスティクスは %K が %D を下回り、短期の勢いは慎重に見たい状態です。";
}

function resolveStochasticTone({
  latest,
  previous,
  trendContext,
}: {
  latest: StochasticPoint | null;
  previous: StochasticPoint | null;
  trendContext: TrendContext;
}): StockDetailTrendSignal["tone"] {
  if (latest === null) {
    return "neutral";
  }

  if (trendContext === "uptrend" && latest.k >= 40 && latest.k <= 50 && previous !== null && latest.k > previous.k) {
    return "positive";
  }

  if (trendContext === "downtrend" && latest.k >= 50 && latest.k <= 60 && previous !== null && latest.k < previous.k) {
    return "warning";
  }

  if (latest.k >= 80) {
    return "warning";
  }

  if (latest.k <= 20) {
    return "positive";
  }

  return "neutral";
}

function formatStochasticValue(value: StochasticPoint | null): string {
  if (value === null) {
    return "-";
  }

  return `%K ${value.k.toFixed(1)} / %D ${value.d.toFixed(1)}`;
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

function buildIchimokuInsightLine(ichimoku: ResolvedIchimokuState | null): string | null {
  if (ichimoku === null) {
    return null;
  }

  if (ichimoku.pricePosition === "above-cloud") {
    return "一目均衡表では株価が雲の上にあり、支持帯の上で推移しているかを見やすい状態です。";
  }

  if (ichimoku.pricePosition === "below-cloud") {
    return "一目均衡表では株価が雲の下にあり、戻り売りに押されないかを確認したい場面です。";
  }

  if (ichimoku.pricePosition === "inside-cloud") {
    return "一目均衡表では株価が雲の中にあり、方向感が出るまで少し待ちたい位置です。";
  }

  return null;
}

function buildStochasticInsightLine({
  latest,
  previous,
  trendContext,
}: {
  latest: StochasticPoint | null;
  previous: StochasticPoint | null;
  trendContext: TrendContext;
}): string | null {
  if (latest === null) {
    return null;
  }

  if (
    trendContext === "uptrend" &&
    latest.k >= 40 &&
    latest.k <= 50 &&
    previous !== null &&
    latest.k > previous.k
  ) {
    return "ストキャスティクスは 40〜50 付近から反発していて、上昇トレンド中の押し目候補として見やすいです。";
  }

  if (
    trendContext === "downtrend" &&
    latest.k >= 50 &&
    latest.k <= 60 &&
    previous !== null &&
    latest.k < previous.k
  ) {
    return "ストキャスティクスは 50〜60 付近で失速していて、下落トレンド中の戻り売り候補を意識したいです。";
  }

  if (latest.k <= 20) {
    return "ストキャスティクスは 20 近辺で、短期の売られすぎから反発の兆しを待ちたい位置です。";
  }

  if (latest.k >= 80) {
    return "ストキャスティクスは 80 超で、短期の買われすぎから失速しないかを見たい位置です。";
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
  return formatPriceCurrency(value, currency);
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

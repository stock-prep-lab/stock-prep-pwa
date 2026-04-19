import type {
  CurrencyCode,
  DailyPriceBar,
  ExchangeRateBar,
  StoredStockSymbol,
  StockSymbol,
} from "@stock-prep/shared";

export type StockCandidate = {
  symbol: StockSymbol;
  reason: string;
};

export type MomentumOptions = {
  lookbackTradingDays: number;
  skipRecentTradingDays?: number;
};

export type ScreeningCandidateMetrics = {
  averageVolume20: number | null;
  changeRate: number | null;
  highProximity: number | null;
  liquidityValueJpy: number | null;
  momentum12_1: number | null;
  momentum6_1: number | null;
};

export type RankedScreeningCandidate = {
  latestPrice: DailyPriceBar;
  metrics: ScreeningCandidateMetrics;
  rank: number;
  score: number;
  symbol: StoredStockSymbol;
};

export type BuildScreeningCandidatesOptions = {
  dailyPrices: DailyPriceBar[];
  exchangeRates?: ExchangeRateBar[];
  limit?: number;
  symbols: StoredStockSymbol[];
};

const twelveMonthLookbackTradingDays = 252;
const sixMonthLookbackTradingDays = 126;
const oneMonthSkipTradingDays = 21;
const highProximityLookbackTradingDays = 252;
const averageVolumeLookbackTradingDays = 20;

/**
 * 直近の短期ノイズを避けて、中長期の価格上昇率を見る。
 *
 * 例: 12-1M momentum = (直近1か月前の終値 / 約12か月前の終値 - 1) * 100
 * `lookbackTradingDays` が 252、`skipRecentTradingDays` が 21 なら 12-1M として扱う。
 */
export function calculateMomentum(
  prices: Pick<DailyPriceBar, "close" | "date">[],
  { lookbackTradingDays, skipRecentTradingDays = 0 }: MomentumOptions,
): number | null {
  const sortedPrices = sortPricesByDate(prices);
  const latestIndex = sortedPrices.length - 1 - skipRecentTradingDays;
  const baseIndex = latestIndex - lookbackTradingDays;

  if (latestIndex < 0 || baseIndex < 0) {
    return null;
  }

  const latestClose = sortedPrices[latestIndex]?.close;
  const baseClose = sortedPrices[baseIndex]?.close;

  if (!isPositiveFinite(latestClose) || !isPositiveFinite(baseClose)) {
    return null;
  }

  return (latestClose / baseClose - 1) * 100;
}

/**
 * 直近日足と1本前の日足の終値変化率。
 *
 * change rate = (直近終値 / 前営業日の終値 - 1) * 100
 */
export function calculateChangeRate(
  prices: Pick<DailyPriceBar, "close" | "date">[],
): number | null {
  const sortedPrices = sortPricesByDate(prices);
  const latest = sortedPrices.at(-1);
  const previous = sortedPrices.at(-2);

  if (
    !latest ||
    !previous ||
    !isPositiveFinite(latest.close) ||
    !isPositiveFinite(previous.close)
  ) {
    return null;
  }

  return (latest.close / previous.close - 1) * 100;
}

/**
 * 直近終値が過去高値にどれだけ近いかを見る。
 *
 * high proximity = 直近終値 / 過去N営業日の最高値 * 100
 * 100% に近いほど、直近高値圏にいる候補として扱う。
 */
export function calculateHighProximity(
  prices: Pick<DailyPriceBar, "close" | "date" | "high">[],
  lookbackTradingDays = highProximityLookbackTradingDays,
): number | null {
  const sortedPrices = sortPricesByDate(prices);
  const latest = sortedPrices.at(-1);
  const lookbackPrices = sortedPrices.slice(-lookbackTradingDays);
  const highestHigh = Math.max(...lookbackPrices.map((price) => price.high));

  if (!latest || !isPositiveFinite(latest.close) || !isPositiveFinite(highestHigh)) {
    return null;
  }

  return (latest.close / highestHigh) * 100;
}

/**
 * 売買の厚みを見るための平均出来高。
 *
 * average volume = 直近N営業日の出来高合計 / 取得できた出来高本数
 */
export function calculateAverageVolume(
  prices: Pick<DailyPriceBar, "date" | "volume">[],
  lookbackTradingDays = averageVolumeLookbackTradingDays,
): number | null {
  const volumes = sortPricesByDate(prices)
    .slice(-lookbackTradingDays)
    .map((price) => price.volume)
    .filter(isPositiveFinite);

  if (volumes.length === 0) {
    return null;
  }

  return volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length;
}

/**
 * 保存済み日足から、翌営業日に確認したい候補を総合スコア順に並べる。
 *
 * MVP 初期版では、12-1M / 6-1M momentum、高値接近率、JPY換算流動性を使う。
 * リバランスや保有との相性評価は Slice 12 以降で扱う。
 */
export function buildScreeningCandidates({
  dailyPrices,
  exchangeRates = [],
  limit,
  symbols,
}: BuildScreeningCandidatesOptions): RankedScreeningCandidate[] {
  const pricesBySymbolId = groupPricesBySymbolId(dailyPrices);
  const candidates = symbols
    .map((symbol) => {
      const prices = pricesBySymbolId.get(symbol.id) ?? [];
      return buildScreeningCandidate(symbol, prices, exchangeRates);
    })
    .filter((candidate): candidate is Omit<RankedScreeningCandidate, "rank"> => candidate !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.symbol.code.localeCompare(right.symbol.code);
    })
    .slice(0, limit);

  return candidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));
}

function buildScreeningCandidate(
  symbol: StoredStockSymbol,
  prices: DailyPriceBar[],
  exchangeRates: ExchangeRateBar[],
): Omit<RankedScreeningCandidate, "rank"> | null {
  const sortedPrices = sortPricesByDate(prices);
  const latestPrice = sortedPrices.at(-1);

  if (!latestPrice) {
    return null;
  }

  const averageVolume20 = calculateAverageVolume(sortedPrices);
  const jpyConversionRate = findLatestJpyConversionRate(symbol.currency, exchangeRates);
  const metrics: ScreeningCandidateMetrics = {
    averageVolume20,
    changeRate: calculateChangeRate(sortedPrices),
    highProximity: calculateHighProximity(sortedPrices),
    // liquidity JPY = 直近終値 * 20日平均出来高 * JPY換算レート
    liquidityValueJpy:
      averageVolume20 === null || !isPositiveFinite(latestPrice.close) || jpyConversionRate === null
        ? null
        : averageVolume20 * latestPrice.close * jpyConversionRate,
    momentum12_1: calculateMomentum(sortedPrices, {
      lookbackTradingDays: twelveMonthLookbackTradingDays,
      skipRecentTradingDays: oneMonthSkipTradingDays,
    }),
    momentum6_1: calculateMomentum(sortedPrices, {
      lookbackTradingDays: sixMonthLookbackTradingDays,
      skipRecentTradingDays: oneMonthSkipTradingDays,
    }),
  };

  return {
    latestPrice,
    metrics,
    score: calculateScreeningScore(metrics),
    symbol,
  };
}

function calculateScreeningScore(metrics: ScreeningCandidateMetrics): number {
  // 総合スコア = momentum重視 + 高値接近 + 売買しやすさ。重みは MVP 初期値。
  const scoreParts = [
    normalizeMomentumScore(metrics.momentum12_1, 0.35),
    normalizeMomentumScore(metrics.momentum6_1, 0.25),
    normalizeHighProximityScore(metrics.highProximity, 0.25),
    normalizeLiquidityScore(metrics.liquidityValueJpy, 0.15),
  ].filter((scorePart): scorePart is number => scorePart !== null);

  if (scoreParts.length === 0) {
    return 0;
  }

  return Math.round(scoreParts.reduce((sum, scorePart) => sum + scorePart, 0));
}

function normalizeMomentumScore(momentum: number | null, weight: number): number | null {
  if (momentum === null) {
    return null;
  }

  // -20% 以下を 0、+40% 以上を満点として、0-100 に正規化する。
  return clamp((momentum + 20) / 60, 0, 1) * 100 * weight;
}

function normalizeHighProximityScore(highProximity: number | null, weight: number): number | null {
  if (highProximity === null) {
    return null;
  }

  return clamp(highProximity / 100, 0, 1) * 100 * weight;
}

function normalizeLiquidityScore(liquidityValue: number | null, weight: number): number | null {
  if (liquidityValue === null) {
    return null;
  }

  // 100億円相当を満点目安にする。流動性の弱い候補を下げるための初期値。
  const tenBillionYenEquivalent = 10_000_000_000;
  return clamp(liquidityValue / tenBillionYenEquivalent, 0, 1) * 100 * weight;
}

function findLatestJpyConversionRate(
  currency: CurrencyCode,
  exchangeRates: ExchangeRateBar[],
): number | null {
  if (currency === "JPY") {
    return 1;
  }

  const pairByCurrency = {
    GBP: "GBPJPY",
    HKD: "HKDJPY",
    USD: "USDJPY",
  } as const;
  const pair = pairByCurrency[currency];
  const latestRate = exchangeRates
    .filter((rate) => rate.pair === pair && isPositiveFinite(rate.close))
    .sort((left, right) => right.date.localeCompare(left.date))
    .at(0);

  return latestRate?.close ?? null;
}

function groupPricesBySymbolId(dailyPrices: DailyPriceBar[]): Map<string, DailyPriceBar[]> {
  return dailyPrices.reduce((pricesBySymbolId, price) => {
    const prices = pricesBySymbolId.get(price.symbolId) ?? [];
    prices.push(price);
    pricesBySymbolId.set(price.symbolId, prices);
    return pricesBySymbolId;
  }, new Map<string, DailyPriceBar[]>());
}

function sortPricesByDate<T extends Pick<DailyPriceBar, "date">>(prices: T[]): T[] {
  return [...prices].sort((left, right) => left.date.localeCompare(right.date));
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

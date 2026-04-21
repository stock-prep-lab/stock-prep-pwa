import type {
  CashBalance,
  CurrencyCode,
  DailyPriceBar,
  ExchangeRateBar,
  PortfolioHolding,
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

export type PortfolioValuationIssue = {
  kind: "missing-price" | "missing-rate" | "missing-symbol";
  message: string;
  symbolId?: string;
};

export type PortfolioHoldingValuation = {
  allocationRatio: number | null;
  averagePrice: number;
  costBasisJpy: number | null;
  costBasisOriginal: number;
  exchangeRateToJpy: number | null;
  holding: PortfolioHolding;
  latestPrice: DailyPriceBar | null;
  marketValueJpy: number | null;
  marketValueOriginal: number | null;
  quantity: number;
  status: "missing-price" | "missing-rate" | "missing-symbol" | "valued";
  symbol: StoredStockSymbol | null;
  unrealizedProfitJpy: number | null;
  unrealizedProfitRate: number | null;
};

export type PortfolioCashValuation = {
  amount: number;
  amountJpy: number | null;
  cashBalance: CashBalance;
  exchangeRateToJpy: number | null;
  status: "missing-rate" | "valued";
};

export type PortfolioAllocation = {
  colorIndex: number;
  id: string;
  kind: "cash" | "holding";
  label: string;
  ratio: number;
  valueJpy: number;
};

export type PortfolioValuation = {
  allocations: PortfolioAllocation[];
  asOfDate: string | null;
  cashPositions: PortfolioCashValuation[];
  holdings: PortfolioHoldingValuation[];
  issues: PortfolioValuationIssue[];
  topHoldingConcentration: number;
  topTwoConcentration: number;
  totalAssetValueJpy: number;
  totalCashValueJpy: number;
  totalCostBasisJpy: number;
  totalHoldingsValueJpy: number;
  totalUnrealizedProfitJpy: number;
  totalUnrealizedProfitRate: number | null;
};

export type BuildPortfolioValuationOptions = {
  cashBalances: CashBalance[];
  dailyPrices: DailyPriceBar[];
  exchangeRates?: ExchangeRateBar[];
  holdings: PortfolioHolding[];
  symbols: StoredStockSymbol[];
};

export type RebalanceProposalMetric = {
  label: string;
  value: number;
};

export type RebalanceProposal = {
  allocationAfterRatio: number;
  allocationBeforeRatio: number;
  cashAfterJpy: number;
  cashBeforeJpy: number;
  cashUsageRatio: number;
  concentrationDelta: number;
  estimatedQuantity: number;
  improvementScore: number;
  latestPrice: DailyPriceBar;
  purchaseAmountJpy: number;
  rank: number;
  reason: string;
  screeningScore: number;
  symbol: StoredStockSymbol;
  totalAssetValueJpy: number;
  topTwoAfterRatio: number;
  topTwoBeforeRatio: number;
};

export type RebalancePlan = {
  portfolio: PortfolioValuation;
  proposals: RebalanceProposal[];
};

export type BuildRebalancePlanOptions = BuildPortfolioValuationOptions & {
  candidateLimit?: number;
  maxProposals?: number;
};

export type PurchaseSimulationStatus =
  | "insufficient-cash"
  | "invalid-input"
  | "missing-rate"
  | "ready";

export type PurchaseSimulationAllocation = {
  colorIndex: number;
  id: string;
  kind: "cash" | "holding";
  label: string;
  ratio: number;
  valueJpy: number;
};

export type PurchaseSimulation = {
  afterAllocations: PurchaseSimulationAllocation[];
  beforeAllocations: PurchaseSimulationAllocation[];
  cashAfterJpy: number;
  cashBeforeJpy: number;
  cashUsageRatio: number;
  exchangeRateToJpy: number | null;
  purchaseAmountJpy: number;
  purchaseAmountOriginal: number;
  purchasePrice: number;
  quantity: number;
  status: PurchaseSimulationStatus;
  statusMessage: string;
  stockAllocationAfterRatio: number;
  stockAllocationBeforeRatio: number;
  targetAllocationAfterRatio: number;
  targetAllocationBeforeRatio: number;
  targetValueAfterJpy: number;
  targetValueBeforeJpy: number;
  topTwoAfterRatio: number;
  topTwoBeforeRatio: number;
  totalAssetValueJpy: number;
};

export type BuildPurchaseSimulationOptions = {
  exchangeRates?: ExchangeRateBar[];
  portfolio: PortfolioValuation;
  purchasePrice: number;
  quantity: number;
  symbol: StoredStockSymbol;
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

/**
 * 保存済みの保有、現金、日足、為替から、ポートフォリオ全体を JPY 建てで評価する。
 *
 * 例:
 * - 7203 を 200株、最新終値 3,000円で持っているなら評価額は 600,000円。
 * - AAPL を 10株、最新終値 180 USD、USDJPY 150 で持っているなら評価額は 270,000円。
 * - 現金 100,000円も足して、総資産、構成比、含み損益、集中度をまとめて返す。
 *
 * 価格や為替が足りない保有は 0 円として扱わず、`issues` と `status` に不足理由を残す。
 */
export function buildPortfolioValuation({
  cashBalances,
  dailyPrices,
  exchangeRates = [],
  holdings,
  symbols,
}: BuildPortfolioValuationOptions): PortfolioValuation {
  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const latestPricesBySymbolId = groupLatestPriceBySymbolId(dailyPrices);
  const issues: PortfolioValuationIssue[] = [];
  const holdingValuations = holdings.map((holding) =>
    buildHoldingValuation({
      exchangeRates,
      holding,
      issues,
      latestPrice: latestPricesBySymbolId.get(holding.symbolId) ?? null,
      symbol: symbolsById.get(holding.symbolId) ?? null,
    }),
  );
  const cashPositions = cashBalances.map((cashBalance) =>
    buildCashValuation(cashBalance, exchangeRates, issues),
  );
  const totalHoldingsValueJpy = sumNullableValues(
    holdingValuations.map((holding) => holding.marketValueJpy),
  );
  const totalCashValueJpy = sumNullableValues(cashPositions.map((cash) => cash.amountJpy));
  const totalAssetValueJpy = totalHoldingsValueJpy + totalCashValueJpy;
  const totalCostBasisJpy = sumNullableValues(
    holdingValuations.map((holding) => holding.costBasisJpy),
  );
  const totalUnrealizedProfitJpy = sumNullableValues(
    holdingValuations.map((holding) => holding.unrealizedProfitJpy),
  );

  // 構成比は「保有評価額 / 現金込み総資産」で計算する。
  // 例: 保有 600,000円、現金 400,000円なら、その保有の構成比は 60%。
  const holdingsWithAllocation = holdingValuations.map((holding) => ({
    ...holding,
    allocationRatio:
      holding.marketValueJpy === null || totalAssetValueJpy <= 0
        ? null
        : holding.marketValueJpy / totalAssetValueJpy,
  }));
  const allocations = buildPortfolioAllocations({
    cashPositions,
    holdings: holdingsWithAllocation,
    totalAssetValueJpy,
  });
  const holdingAllocationRatios = holdingsWithAllocation
    .map((holding) => holding.allocationRatio)
    .filter((ratio): ratio is number => ratio !== null)
    .sort((left, right) => right - left);

  // 表示上の基準日は、価格、為替、現金、保有更新日のうち一番新しい日付にする。
  // 例: 価格が 2026-04-17、保有編集が 2026-04-20 なら 2026-04-20。
  const asOfDate = getLatestDate([
    ...dailyPrices.map((price) => price.date),
    ...exchangeRates.map((rate) => rate.date),
    ...cashBalances.map((cash) => cash.updatedAt.slice(0, 10)),
    ...holdings.map((holding) => holding.updatedAt.slice(0, 10)),
  ]);

  return {
    allocations,
    asOfDate,
    cashPositions,
    holdings: holdingsWithAllocation,
    issues,
    topHoldingConcentration: holdingAllocationRatios[0] ?? 0,
    topTwoConcentration: (holdingAllocationRatios[0] ?? 0) + (holdingAllocationRatios[1] ?? 0),
    totalAssetValueJpy,
    totalCashValueJpy,
    totalCostBasisJpy,
    totalHoldingsValueJpy,
    totalUnrealizedProfitJpy,
    totalUnrealizedProfitRate:
      totalCostBasisJpy > 0 ? totalUnrealizedProfitJpy / totalCostBasisJpy : null,
  };
}

/**
 * スクリーニング候補と現在のポートフォリオを合わせて、現金で買う候補を作る。
 *
 * 例:
 * - 現金が 300,000円ある
 * - スクリーニング上位に 9432 がいる
 * - 9432 を買った後に上位2銘柄集中度が悪化しにくい
 * なら、9432 をリバランス候補として返す。
 *
 * 現金がない、総資産がない、価格や為替が足りない候補は提案から外す。
 */
export function buildRebalancePlan({
  candidateLimit = 20,
  maxProposals = 5,
  ...options
}: BuildRebalancePlanOptions): RebalancePlan {
  const portfolio = buildPortfolioValuation(options);
  const cashAvailableJpy = portfolio.totalCashValueJpy;

  if (cashAvailableJpy <= 0 || portfolio.totalAssetValueJpy <= 0) {
    return {
      portfolio,
      proposals: [],
    };
  }

  const candidates = buildScreeningCandidates({
    dailyPrices: options.dailyPrices,
    exchangeRates: options.exchangeRates,
    limit: candidateLimit,
    symbols: options.symbols,
  });
  const proposals = candidates
    .map((candidate) =>
      buildRebalanceProposal({
        candidate,
        cashAvailableJpy,
        exchangeRates: options.exchangeRates ?? [],
        portfolio,
      }),
    )
    .filter((proposal): proposal is Omit<RebalanceProposal, "rank"> => proposal !== null)
    .sort((left, right) => {
      if (right.improvementScore !== left.improvementScore) {
        return right.improvementScore - left.improvementScore;
      }

      return left.symbol.code.localeCompare(right.symbol.code);
    })
    .slice(0, maxProposals)
    .map((proposal, index) => ({
      ...proposal,
      rank: index + 1,
    }));

  return {
    portfolio,
    proposals,
  };
}

/**
 * 購入価格と株数から、買う前 / 買った後の構成比を計算する。
 *
 * 例:
 * - 現金 300,000円、総資産 1,000,000円
 * - 9432 を 160円で 1,000株買う
 * - 購入額は 160,000円、現金は 140,000円に減る
 * - その分だけ 9432 の評価額を増やして、円グラフ用の after 構成比を作る
 *
 * この関数は「もし買ったら」を見るだけで、保有や現金を永続保存しない。
 */
export function buildPurchaseSimulation({
  exchangeRates = [],
  portfolio,
  purchasePrice,
  quantity,
  symbol,
}: BuildPurchaseSimulationOptions): PurchaseSimulation {
  const exchangeRateToJpy = findLatestJpyConversionRate(symbol.currency, exchangeRates);
  const normalizedPrice = Number.isFinite(purchasePrice) ? purchasePrice : 0;
  const normalizedQuantity = Number.isFinite(quantity) ? quantity : 0;
  const cashBeforeJpy = portfolio.totalCashValueJpy;
  const targetValueBeforeJpy = getHoldingValueBySymbolId(portfolio, symbol.id);
  const stockAllocationBeforeRatio =
    portfolio.totalAssetValueJpy > 0
      ? portfolio.totalHoldingsValueJpy / portfolio.totalAssetValueJpy
      : 0;
  const targetAllocationBeforeRatio =
    portfolio.totalAssetValueJpy > 0 ? targetValueBeforeJpy / portfolio.totalAssetValueJpy : 0;

  if (!isPositiveFinite(normalizedPrice) || !isPositiveFinite(normalizedQuantity)) {
    return buildEmptyPurchaseSimulation({
      cashBeforeJpy,
      exchangeRateToJpy,
      portfolio,
      purchasePrice: normalizedPrice,
      quantity: normalizedQuantity,
      status: "invalid-input",
      statusMessage: "購入価格と株数を 0 より大きい数値で入力してください。",
      targetAllocationBeforeRatio,
      targetValueBeforeJpy,
    });
  }

  if (exchangeRateToJpy === null) {
    return buildEmptyPurchaseSimulation({
      cashBeforeJpy,
      exchangeRateToJpy,
      portfolio,
      purchasePrice: normalizedPrice,
      quantity: normalizedQuantity,
      status: "missing-rate",
      statusMessage: `${symbol.currency} を JPY 換算する為替レートが不足しています。`,
      targetAllocationBeforeRatio,
      targetValueBeforeJpy,
    });
  }

  const purchaseAmountOriginal = normalizedPrice * normalizedQuantity;
  const purchaseAmountJpy = purchaseAmountOriginal * exchangeRateToJpy;
  const cashAfterJpy = cashBeforeJpy - purchaseAmountJpy;
  const status: PurchaseSimulationStatus = cashAfterJpy < 0 ? "insufficient-cash" : "ready";
  const afterAllocations = buildPurchaseAfterAllocations({
    cashAfterJpy,
    portfolio,
    purchaseAmountJpy,
    symbol,
  });
  const targetValueAfterJpy = targetValueBeforeJpy + purchaseAmountJpy;
  const targetAllocationAfterRatio =
    portfolio.totalAssetValueJpy > 0 ? targetValueAfterJpy / portfolio.totalAssetValueJpy : 0;
  const stockAllocationAfterRatio =
    portfolio.totalAssetValueJpy > 0
      ? (portfolio.totalHoldingsValueJpy + purchaseAmountJpy) / portfolio.totalAssetValueJpy
      : 0;

  return {
    afterAllocations,
    beforeAllocations: portfolio.allocations,
    cashAfterJpy,
    cashBeforeJpy,
    cashUsageRatio: cashBeforeJpy > 0 ? purchaseAmountJpy / cashBeforeJpy : 0,
    exchangeRateToJpy,
    purchaseAmountJpy,
    purchaseAmountOriginal,
    purchasePrice: normalizedPrice,
    quantity: normalizedQuantity,
    status,
    statusMessage:
      status === "ready"
        ? "購入後の構成比を計算できます。"
        : "現金残高を超えるため、購入価格または株数を調整してください。",
    stockAllocationAfterRatio,
    stockAllocationBeforeRatio,
    targetAllocationAfterRatio,
    targetAllocationBeforeRatio,
    targetValueAfterJpy,
    targetValueBeforeJpy,
    topTwoAfterRatio: calculateTopTwoConcentrationAfterPurchase({
      portfolio,
      purchaseAmountJpy,
      symbolId: symbol.id,
    }),
    topTwoBeforeRatio: portfolio.topTwoConcentration,
    totalAssetValueJpy: portfolio.totalAssetValueJpy,
  };
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

function buildHoldingValuation({
  exchangeRates,
  holding,
  issues,
  latestPrice,
  symbol,
}: {
  exchangeRates: ExchangeRateBar[];
  holding: PortfolioHolding;
  issues: PortfolioValuationIssue[];
  latestPrice: DailyPriceBar | null;
  symbol: StoredStockSymbol | null;
}): PortfolioHoldingValuation {
  // 保有は symbolId だけを持つため、銘柄マスタと結合できないと評価できない。
  // 例: holding.symbolId = "jp-7203" だが symbols に存在しない場合。
  if (!symbol) {
    issues.push({
      kind: "missing-symbol",
      message: `Symbol is missing for holding ${holding.symbolId}.`,
      symbolId: holding.symbolId,
    });

    return {
      allocationRatio: null,
      averagePrice: holding.averagePrice,
      costBasisJpy: null,
      costBasisOriginal: holding.quantity * holding.averagePrice,
      exchangeRateToJpy: null,
      holding,
      latestPrice: null,
      marketValueJpy: null,
      marketValueOriginal: null,
      quantity: holding.quantity,
      status: "missing-symbol",
      symbol: null,
      unrealizedProfitJpy: null,
      unrealizedProfitRate: null,
    };
  }

  // 最新価格がないと時価評価できない。取得失敗や空データの銘柄はここに入る。
  if (!latestPrice || !isPositiveFinite(latestPrice.close)) {
    issues.push({
      kind: "missing-price",
      message: `Latest price is missing for ${symbol.code}.`,
      symbolId: symbol.id,
    });

    return buildUnvaluedHolding({ holding, latestPrice, status: "missing-price", symbol });
  }

  const exchangeRateToJpy = findLatestJpyConversionRate(symbol.currency, exchangeRates);

  // 外貨建ては JPY 換算できないと総資産へ混ぜられない。
  // 例: AAPL は USD 建てなので USDJPY が必要。7203 は JPY 建てなので rate = 1。
  if (exchangeRateToJpy === null) {
    issues.push({
      kind: "missing-rate",
      message: `JPY exchange rate is missing for ${symbol.currency}.`,
      symbolId: symbol.id,
    });

    return buildUnvaluedHolding({ holding, latestPrice, status: "missing-rate", symbol });
  }

  // original は銘柄の通貨建て、Jpy はポートフォリオ表示用の円建て。
  // 例: AAPL 10株 * 180 USD = 1,800 USD、USDJPY 150 なら 270,000円。
  const marketValueOriginal = holding.quantity * latestPrice.close;
  const costBasisOriginal = holding.quantity * holding.averagePrice;
  const marketValueJpy = marketValueOriginal * exchangeRateToJpy;
  const costBasisJpy = costBasisOriginal * exchangeRateToJpy;
  const unrealizedProfitJpy = marketValueJpy - costBasisJpy;

  return {
    allocationRatio: null,
    averagePrice: holding.averagePrice,
    costBasisJpy,
    costBasisOriginal,
    exchangeRateToJpy,
    holding,
    latestPrice,
    marketValueJpy,
    marketValueOriginal,
    quantity: holding.quantity,
    status: "valued",
    symbol,
    unrealizedProfitJpy,
    unrealizedProfitRate: costBasisJpy > 0 ? unrealizedProfitJpy / costBasisJpy : null,
  };
}

function buildUnvaluedHolding({
  holding,
  latestPrice,
  status,
  symbol,
}: {
  holding: PortfolioHolding;
  latestPrice: DailyPriceBar | null;
  status: "missing-price" | "missing-rate";
  symbol: StoredStockSymbol;
}): PortfolioHoldingValuation {
  return {
    allocationRatio: null,
    averagePrice: holding.averagePrice,
    costBasisJpy: null,
    costBasisOriginal: holding.quantity * holding.averagePrice,
    exchangeRateToJpy: null,
    holding,
    latestPrice,
    marketValueJpy: null,
    marketValueOriginal: null,
    quantity: holding.quantity,
    status,
    symbol,
    unrealizedProfitJpy: null,
    unrealizedProfitRate: null,
  };
}

function buildCashValuation(
  cashBalance: CashBalance,
  exchangeRates: ExchangeRateBar[],
  issues: PortfolioValuationIssue[],
): PortfolioCashValuation {
  // 現金も保有と同じく JPY 換算して総資産へ足す。
  // 例: USD 現金 1,000、USDJPY 150 なら 150,000円。
  const exchangeRateToJpy = findLatestJpyConversionRate(cashBalance.currency, exchangeRates);

  if (exchangeRateToJpy === null) {
    issues.push({
      kind: "missing-rate",
      message: `JPY exchange rate is missing for ${cashBalance.currency} cash.`,
    });

    return {
      amount: cashBalance.amount,
      amountJpy: null,
      cashBalance,
      exchangeRateToJpy,
      status: "missing-rate",
    };
  }

  return {
    amount: cashBalance.amount,
    amountJpy: cashBalance.amount * exchangeRateToJpy,
    cashBalance,
    exchangeRateToJpy,
    status: "valued",
  };
}

function buildPortfolioAllocations({
  cashPositions,
  holdings,
  totalAssetValueJpy,
}: {
  cashPositions: PortfolioCashValuation[];
  holdings: PortfolioHoldingValuation[];
  totalAssetValueJpy: number;
}): PortfolioAllocation[] {
  if (totalAssetValueJpy <= 0) {
    return [];
  }

  // 円グラフ用に、評価できた保有と現金を同じ配列へまとめる。
  // ratio は Recharts の描画と凡例表示の両方で使う。
  const holdingAllocations = holdings
    .filter((holding) => holding.marketValueJpy !== null && holding.symbol !== null)
    .map((holding, index) => ({
      colorIndex: index,
      id: holding.holding.id,
      kind: "holding" as const,
      label: holding.symbol?.name ?? holding.holding.symbolId,
      ratio: holding.marketValueJpy === null ? 0 : holding.marketValueJpy / totalAssetValueJpy,
      valueJpy: holding.marketValueJpy ?? 0,
    }));
  const cashAllocations = cashPositions
    .filter((cash) => cash.amountJpy !== null)
    .map((cash, index) => ({
      colorIndex: holdingAllocations.length + index,
      id: `cash-${cash.cashBalance.currency}`,
      kind: "cash" as const,
      label: `${cash.cashBalance.currency} 現金`,
      ratio: cash.amountJpy === null ? 0 : cash.amountJpy / totalAssetValueJpy,
      valueJpy: cash.amountJpy ?? 0,
    }));

  return [...holdingAllocations, ...cashAllocations].sort((left, right) => {
    if (right.valueJpy !== left.valueJpy) {
      return right.valueJpy - left.valueJpy;
    }

    return left.label.localeCompare(right.label);
  });
}

function buildEmptyPurchaseSimulation({
  cashBeforeJpy,
  exchangeRateToJpy,
  portfolio,
  purchasePrice,
  quantity,
  status,
  statusMessage,
  targetAllocationBeforeRatio,
  targetValueBeforeJpy,
}: {
  cashBeforeJpy: number;
  exchangeRateToJpy: number | null;
  portfolio: PortfolioValuation;
  purchasePrice: number;
  quantity: number;
  status: Exclude<PurchaseSimulationStatus, "ready">;
  statusMessage: string;
  targetAllocationBeforeRatio: number;
  targetValueBeforeJpy: number;
}): PurchaseSimulation {
  const stockAllocationBeforeRatio =
    portfolio.totalAssetValueJpy > 0
      ? portfolio.totalHoldingsValueJpy / portfolio.totalAssetValueJpy
      : 0;

  return {
    afterAllocations: portfolio.allocations,
    beforeAllocations: portfolio.allocations,
    cashAfterJpy: cashBeforeJpy,
    cashBeforeJpy,
    cashUsageRatio: 0,
    exchangeRateToJpy,
    purchaseAmountJpy: 0,
    purchaseAmountOriginal: 0,
    purchasePrice,
    quantity,
    status,
    statusMessage,
    stockAllocationAfterRatio: stockAllocationBeforeRatio,
    stockAllocationBeforeRatio,
    targetAllocationAfterRatio: targetAllocationBeforeRatio,
    targetAllocationBeforeRatio,
    targetValueAfterJpy: targetValueBeforeJpy,
    targetValueBeforeJpy,
    topTwoAfterRatio: portfolio.topTwoConcentration,
    topTwoBeforeRatio: portfolio.topTwoConcentration,
    totalAssetValueJpy: portfolio.totalAssetValueJpy,
  };
}

function buildPurchaseAfterAllocations({
  cashAfterJpy,
  portfolio,
  purchaseAmountJpy,
  symbol,
}: {
  cashAfterJpy: number;
  portfolio: PortfolioValuation;
  purchaseAmountJpy: number;
  symbol: StoredStockSymbol;
}): PurchaseSimulationAllocation[] {
  if (portfolio.totalAssetValueJpy <= 0) {
    return [];
  }

  const valuesBySymbolId = new Map<
    string,
    {
      id: string;
      label: string;
      valueJpy: number;
    }
  >();

  for (const holding of portfolio.holdings) {
    if (holding.symbol && holding.marketValueJpy !== null) {
      const current = valuesBySymbolId.get(holding.symbol.id);
      valuesBySymbolId.set(holding.symbol.id, {
        id: current?.id ?? holding.holding.id,
        label: holding.symbol.name,
        valueJpy: (current?.valueJpy ?? 0) + holding.marketValueJpy,
      });
    }
  }

  const currentTarget = valuesBySymbolId.get(symbol.id);
  valuesBySymbolId.set(symbol.id, {
    id: currentTarget?.id ?? `simulation-${symbol.id}`,
    label: symbol.name,
    valueJpy: (currentTarget?.valueJpy ?? 0) + purchaseAmountJpy,
  });

  const holdingAllocations = [...valuesBySymbolId.values()].map((allocation, index) => ({
    colorIndex: index,
    id: allocation.id,
    kind: "holding" as const,
    label: allocation.label,
    ratio: allocation.valueJpy / portfolio.totalAssetValueJpy,
    valueJpy: allocation.valueJpy,
  }));
  const cashValueJpy = Math.max(cashAfterJpy, 0);
  const cashAllocation: PurchaseSimulationAllocation = {
    colorIndex: holdingAllocations.length,
    id: "cash-after-purchase",
    kind: "cash",
    label: "JPY 現金",
    ratio: cashValueJpy / portfolio.totalAssetValueJpy,
    valueJpy: cashValueJpy,
  };

  return [...holdingAllocations, cashAllocation]
    .filter((allocation) => allocation.valueJpy > 0)
    .sort((left, right) => {
      if (right.valueJpy !== left.valueJpy) {
        return right.valueJpy - left.valueJpy;
      }

      return left.label.localeCompare(right.label);
    });
}

function buildRebalanceProposal({
  candidate,
  cashAvailableJpy,
  exchangeRates,
  portfolio,
}: {
  candidate: RankedScreeningCandidate;
  cashAvailableJpy: number;
  exchangeRates: ExchangeRateBar[];
  portfolio: PortfolioValuation;
}): Omit<RebalanceProposal, "rank"> | null {
  const exchangeRateToJpy = findLatestJpyConversionRate(candidate.symbol.currency, exchangeRates);

  // 候補も購入額を JPY で比較するため、外貨建て候補は為替が必須。
  if (exchangeRateToJpy === null) {
    return null;
  }

  const latestPriceJpy = candidate.latestPrice.close * exchangeRateToJpy;

  if (!isPositiveFinite(latestPriceJpy)) {
    return null;
  }

  // 既に持っている候補なら、買い増し後の構成比を見る。
  // 未保有なら existingValueJpy は 0 になり、新規追加候補として評価する。
  const existingValueJpy = portfolio.holdings
    .filter((holding) => holding.symbol?.id === candidate.symbol.id)
    .reduce((sum, holding) => sum + (holding.marketValueJpy ?? 0), 0);
  const allocationBeforeRatio =
    portfolio.totalAssetValueJpy > 0 ? existingValueJpy / portfolio.totalAssetValueJpy : 0;
  const purchaseAmountJpy = calculatePurchaseAmountJpy({
    cashAvailableJpy,
    latestPriceJpy,
    totalAssetValueJpy: portfolio.totalAssetValueJpy,
  });

  if (purchaseAmountJpy <= 0) {
    return null;
  }

  const allocationAfterRatio =
    (existingValueJpy + purchaseAmountJpy) / portfolio.totalAssetValueJpy;
  const topTwoAfterRatio = calculateTopTwoConcentrationAfterPurchase({
    portfolio,
    purchaseAmountJpy,
    symbolId: candidate.symbol.id,
  });
  const concentrationDelta = topTwoAfterRatio - portfolio.topTwoConcentration;
  const cashAfterJpy = cashAvailableJpy - purchaseAmountJpy;
  const cashUsageRatio = cashAvailableJpy > 0 ? purchaseAmountJpy / cashAvailableJpy : 0;
  const improvementScore = calculateRebalanceImprovementScore({
    allocationBeforeRatio,
    cashUsageRatio,
    concentrationDelta,
    screeningScore: candidate.score,
  });

  return {
    allocationAfterRatio,
    allocationBeforeRatio,
    cashAfterJpy,
    cashBeforeJpy: cashAvailableJpy,
    cashUsageRatio,
    concentrationDelta,
    estimatedQuantity: purchaseAmountJpy / latestPriceJpy,
    improvementScore,
    latestPrice: candidate.latestPrice,
    purchaseAmountJpy,
    reason: buildRebalanceReason({ allocationBeforeRatio, concentrationDelta }),
    screeningScore: candidate.score,
    symbol: candidate.symbol,
    totalAssetValueJpy: portfolio.totalAssetValueJpy,
    topTwoAfterRatio,
    topTwoBeforeRatio: portfolio.topTwoConcentration,
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
  // JPY 建てはそのまま円なので、換算レートは 1。
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

/**
 * 1回の提案で使う購入額を決める。
 *
 * MVP 初期値:
 * - 現金の 60% まで
 * - 総資産の 12% まで
 * の小さい方を使い、最新価格の整数倍に丸める。
 *
 * 例:
 * - 現金 300,000円、総資産 1,000,000円、株価 2,000円
 * - min(180,000円, 120,000円) = 120,000円
 * - 2,000円の整数倍なので購入額は 120,000円
 */
function calculatePurchaseAmountJpy({
  cashAvailableJpy,
  latestPriceJpy,
  totalAssetValueJpy,
}: {
  cashAvailableJpy: number;
  latestPriceJpy: number;
  totalAssetValueJpy: number;
}): number {
  const targetCashUsageJpy = cashAvailableJpy * 0.6;
  const targetAssetUsageJpy = totalAssetValueJpy * 0.12;
  const rawPurchaseAmountJpy = Math.min(targetCashUsageJpy, targetAssetUsageJpy);

  if (rawPurchaseAmountJpy < latestPriceJpy) {
    return 0;
  }

  return Math.floor(rawPurchaseAmountJpy / latestPriceJpy) * latestPriceJpy;
}

/**
 * 候補を買った後に、上位2銘柄の集中度がどう変わるかを見る。
 *
 * 例:
 * - 現在の上位2銘柄が 40% + 20% = 60%
 * - 未保有候補を買っても上位2銘柄が 38% + 19% = 57% になるなら集中度は下がる
 */
function calculateTopTwoConcentrationAfterPurchase({
  portfolio,
  purchaseAmountJpy,
  symbolId,
}: {
  portfolio: PortfolioValuation;
  purchaseAmountJpy: number;
  symbolId: string;
}): number {
  if (portfolio.totalAssetValueJpy <= 0) {
    return 0;
  }

  const valuesBySymbolId = new Map<string, number>();

  for (const holding of portfolio.holdings) {
    if (holding.symbol && holding.marketValueJpy !== null) {
      valuesBySymbolId.set(
        holding.symbol.id,
        (valuesBySymbolId.get(holding.symbol.id) ?? 0) + holding.marketValueJpy,
      );
    }
  }

  valuesBySymbolId.set(symbolId, (valuesBySymbolId.get(symbolId) ?? 0) + purchaseAmountJpy);

  const topValues = [...valuesBySymbolId.values()].sort((left, right) => right - left);
  return ((topValues[0] ?? 0) + (topValues[1] ?? 0)) / portfolio.totalAssetValueJpy;
}

function getHoldingValueBySymbolId(portfolio: PortfolioValuation, symbolId: string): number {
  return portfolio.holdings
    .filter((holding) => holding.symbol?.id === symbolId)
    .reduce((sum, holding) => sum + (holding.marketValueJpy ?? 0), 0);
}

/**
 * リバランス候補としての良さを 0-100 の MVP スコアにする。
 *
 * 見ているもの:
 * - trendScore: スクリーニングの勢いが強いか
 * - underweightScore: まだ保有比率が低く、買っても偏りにくいか
 * - concentrationScore: 買った後に上位集中度が悪化しにくいか
 * - cashUsageScore: 現金をほどよく活用できるか
 */
function calculateRebalanceImprovementScore({
  allocationBeforeRatio,
  cashUsageRatio,
  concentrationDelta,
  screeningScore,
}: {
  allocationBeforeRatio: number;
  cashUsageRatio: number;
  concentrationDelta: number;
  screeningScore: number;
}): number {
  const underweightScore = clamp(1 - allocationBeforeRatio / 0.25, 0, 1) * 25;
  const concentrationScore = clamp(-concentrationDelta / 0.08, -1, 1) * 20;
  const cashUsageScore = clamp(cashUsageRatio / 0.6, 0, 1) * 10;
  const trendScore = clamp(screeningScore / 100, 0, 1) * 45;

  return Math.round(
    clamp(trendScore + underweightScore + concentrationScore + cashUsageScore, 0, 100),
  );
}

function buildRebalanceReason({
  allocationBeforeRatio,
  concentrationDelta,
}: {
  allocationBeforeRatio: number;
  concentrationDelta: number;
}): string {
  if (allocationBeforeRatio === 0 && concentrationDelta <= 0) {
    return "未保有の候補で、現金を使っても上位集中度を上げにくい候補です。";
  }

  if (allocationBeforeRatio < 0.1) {
    return "保有比率が低く、候補として追加しても偏りを抑えやすい銘柄です。";
  }

  if (concentrationDelta > 0) {
    return "既存保有と重なるため、追加額は控えめに確認したい候補です。";
  }

  return "トレンドと保有バランスの両方から確認したい候補です。";
}

function groupPricesBySymbolId(dailyPrices: DailyPriceBar[]): Map<string, DailyPriceBar[]> {
  return dailyPrices.reduce((pricesBySymbolId, price) => {
    const prices = pricesBySymbolId.get(price.symbolId) ?? [];
    prices.push(price);
    pricesBySymbolId.set(price.symbolId, prices);
    return pricesBySymbolId;
  }, new Map<string, DailyPriceBar[]>());
}

function groupLatestPriceBySymbolId(dailyPrices: DailyPriceBar[]): Map<string, DailyPriceBar> {
  const pricesBySymbolId = groupPricesBySymbolId(dailyPrices);

  return [...pricesBySymbolId.entries()].reduce((latestPrices, [symbolId, prices]) => {
    const latestPrice = sortPricesByDate(prices).at(-1);

    if (latestPrice) {
      latestPrices.set(symbolId, latestPrice);
    }

    return latestPrices;
  }, new Map<string, DailyPriceBar>());
}

function getLatestDate(dates: string[]): string | null {
  const sortedDates = dates.filter(Boolean).sort((left, right) => right.localeCompare(left));
  return sortedDates[0] ?? null;
}

function sumNullableValues(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
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

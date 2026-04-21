import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type {
  PortfolioAllocation,
  PortfolioHoldingValuation,
  PortfolioValuation,
} from "@stock-prep/domain";

import {
  loadPortfolioFromIndexedDb,
  type PortfolioLoadResult,
} from "../data/portfolioRebalanceData";

type PortfolioMetric = {
  label: string;
  note: string;
  tone?: "positive" | "warning";
  value: string;
};

type ConcentrationItem = {
  description: string;
  label: string;
  tone: "neutral" | "warning";
  value: string;
};

type PortfolioState =
  | {
      error: string;
      status: "error";
    }
  | {
      result: PortfolioLoadResult;
      status: "loaded";
    }
  | {
      status: "loading";
    };

const allocationColors = [
  { className: "bg-teal-700", fill: "#0f766e" },
  { className: "bg-emerald-600", fill: "#059669" },
  { className: "bg-sky-600", fill: "#0284c7" },
  { className: "bg-amber-600", fill: "#d97706" },
  { className: "bg-rose-600", fill: "#e11d48" },
  { className: "bg-zinc-500", fill: "#71717a" },
];

export function PortfolioPage() {
  const [portfolioState, setPortfolioState] = useState<PortfolioState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    loadPortfolioFromIndexedDb()
      .then((result) => {
        if (isMounted) {
          setPortfolioState({ result, status: "loaded" });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setPortfolioState({
            error:
              error instanceof Error ? error.message : "ポートフォリオを読み込めませんでした。",
            status: "error",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const portfolio = portfolioState.status === "loaded" ? portfolioState.result.portfolio : null;
  const metrics = portfolio ? toPortfolioMetrics(portfolio) : [];
  const concentrationItems = portfolio ? toConcentrationItems(portfolio) : [];
  const firstSymbolCode =
    portfolio?.holdings.find((holding) => holding.symbol)?.symbol?.code ?? "7203";

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">ポートフォリオ</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">保有状況</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            IndexedDB に保存した保有、現金、日足、為替から評価額と構成比を計算します。
          </p>
        </div>
      </div>

      {portfolioState.status === "loading" ? (
        <StatusPanel message="保存済みポートフォリオを読み込んでいます。" />
      ) : portfolioState.status === "error" ? (
        <StatusPanel message={portfolioState.error} tone="error" />
      ) : portfolioState.result.symbolCount === 0 || portfolioState.result.dailyPriceCount === 0 ? (
        <StatusPanel message="市場データ同期後に、保有を登録すると評価額と構成比を表示します。" />
      ) : portfolioState.result.portfolio.holdings.length === 0 ? (
        <StatusPanel message="保有がまだ登録されていません。銘柄詳細から保有を追加してください。" />
      ) : portfolio ? (
        <>
          <section className="flex flex-col gap-4" aria-labelledby="portfolio-summary-heading">
            <SectionHeader
              description={`現金込みの資産状況です。${portfolio.asOfDate ? `基準日: ${portfolio.asOfDate}` : ""}`}
              title="資産サマリー"
              titleId="portfolio-summary-heading"
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <section className="flex flex-col gap-4" aria-labelledby="allocation-heading">
              <SectionHeader
                description="銘柄別と現金込みの構成比です。"
                title="構成比円グラフ"
                titleId="allocation-heading"
              />

              <div className="flex min-h-[28rem] flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
                <div className="flex flex-1 items-center justify-center py-4">
                  <AllocationChart allocations={portfolio.allocations} />
                </div>

                <div className="grid gap-2">
                  {portfolio.allocations.map((item) => (
                    <AllocationLegend item={item} key={item.id} />
                  ))}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4" aria-labelledby="portfolio-bias-heading">
              <SectionHeader
                description="リバランス前に見ておきたい偏りです。"
                title="偏りサマリー"
                titleId="portfolio-bias-heading"
              />

              <div className="grid gap-3">
                {concentrationItems.map((item) => (
                  <ConcentrationCard item={item} key={item.label} />
                ))}
              </div>

              <Link
                className="flex min-h-14 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700"
                to="/rebalance"
              >
                リバランス提案を見る
              </Link>
            </section>
          </div>

          <section className="flex flex-col gap-4" aria-labelledby="holdings-heading">
            <SectionHeader
              actionLabel="保有を追加"
              actionTo={`/holdings/${firstSymbolCode}/edit`}
              description="保有銘柄ごとの数量、評価額、損益を確認します。"
              title="保有一覧"
              titleId="holdings-heading"
            />

            <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
              <div className="hidden grid-cols-[1fr_9rem_9rem_8rem_7rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 lg:grid">
                <span>銘柄</span>
                <span>数量 / 取得単価</span>
                <span>評価額</span>
                <span>損益</span>
                <span>構成比</span>
              </div>

              <div className="divide-y divide-zinc-200">
                {portfolio.holdings.map((holding) => (
                  <HoldingRow holding={holding} key={holding.holding.id} />
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section
        className="rounded-md border border-teal-200 bg-white p-4"
        aria-label="下部アクション"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-normal text-zinc-950">
              次に買う候補をバランスで確認
            </h2>
            <p className="text-sm leading-6 text-zinc-700">
              保有比率を見ながら、追加候補の相性を確認します。
            </p>
          </div>
          <Link
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 sm:w-fit"
            to="/rebalance"
          >
            リバランスへ進む
          </Link>
        </div>
      </section>
    </section>
  );
}

function SectionHeader({
  actionLabel,
  actionTo,
  description,
  title,
  titleId,
}: {
  actionLabel?: string;
  actionTo?: string;
  description: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-normal" id={titleId}>
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-zinc-700">{description}</p>
      </div>
      {actionLabel && actionTo ? (
        <Link
          className="flex min-h-10 w-fit items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-teal-700"
          to={actionTo}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function MetricCard({ metric }: { metric: PortfolioMetric }) {
  const valueClass =
    metric.tone === "positive"
      ? "text-emerald-700"
      : metric.tone === "warning"
        ? "text-amber-700"
        : "text-zinc-950";

  return (
    <div className="min-h-28 rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-600">{metric.label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-normal ${valueClass}`}>{metric.value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{metric.note}</p>
    </div>
  );
}

function AllocationChart({ allocations }: { allocations: PortfolioAllocation[] }) {
  const stockRatio = allocations
    .filter((allocation) => allocation.kind === "holding")
    .reduce((sum, allocation) => sum + allocation.ratio, 0);
  const chartData = allocations.filter((allocation) => allocation.valueJpy > 0);

  return (
    <div
      aria-label="ポートフォリオ構成比円グラフ"
      className="relative grid size-56 place-items-center sm:size-64"
    >
      <ResponsiveContainer height="100%" width="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={chartData}
            dataKey="valueJpy"
            endAngle={-270}
            innerRadius="58%"
            isAnimationActive={false}
            nameKey="label"
            outerRadius="100%"
            startAngle={90}
            stroke="#ffffff"
            strokeWidth={3}
          >
            {chartData.map((item) => (
              <Cell fill={getAllocationFillColor(item.colorIndex)} key={item.id} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="grid size-32 place-items-center rounded-full bg-white text-center shadow-sm sm:size-36">
          <div>
            <p className="text-sm font-medium text-zinc-600">株式比率</p>
            <p className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              {formatPercentRatio(stockRatio)}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              現金 {formatPercentRatio(1 - stockRatio)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AllocationLegend({ item }: { item: PortfolioAllocation }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`size-3 rounded-sm ${getAllocationColor(item.colorIndex)}`} />
        <span className="truncate text-sm font-medium text-zinc-700">{item.label}</span>
      </div>
      <span className="text-sm font-semibold text-zinc-950">{formatPercentRatio(item.ratio)}</span>
    </div>
  );
}

function ConcentrationCard({ item }: { item: ConcentrationItem }) {
  return (
    <div
      className={
        item.tone === "warning"
          ? "min-h-32 rounded-md border border-amber-200 bg-white p-4"
          : "min-h-32 rounded-md border border-zinc-200 bg-white p-4"
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-600">{item.label}</p>
        <p
          className={
            item.tone === "warning"
              ? "text-xl font-semibold tracking-normal text-amber-700"
              : "text-xl font-semibold tracking-normal text-zinc-950"
          }
        >
          {item.value}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{item.description}</p>
    </div>
  );
}

function HoldingRow({ holding }: { holding: PortfolioHoldingValuation }) {
  const symbolCode = holding.symbol?.code ?? holding.holding.symbolId;
  const symbolName = holding.symbol?.name ?? "銘柄情報なし";
  const marketValue =
    holding.marketValueJpy === null ? "評価不能" : formatJpy(holding.marketValueJpy);
  const currentPrice = holding.latestPrice
    ? formatCurrency(holding.latestPrice.close, holding.latestPrice.currency)
    : "価格なし";
  const profit = holding.unrealizedProfitJpy === null ? null : holding.unrealizedProfitJpy;

  return (
    <Link
      className="grid gap-4 p-4 text-zinc-950 transition hover:bg-zinc-50 lg:grid-cols-[1fr_9rem_9rem_8rem_7rem] lg:items-center"
      to={`/stocks/${symbolCode}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold tracking-normal">{symbolName}</h3>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {symbolCode}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {holding.symbol?.region ?? "-"} / {holding.symbol?.currency ?? holding.holding.currency}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-950">{formatQuantity(holding.quantity)}</p>
        <p className="mt-1 text-sm text-zinc-600">
          取得 {formatCurrency(holding.averagePrice, holding.holding.currency)}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-950">{marketValue}</p>
        <p className="mt-1 text-sm text-zinc-600">現在 {currentPrice}</p>
      </div>

      <div>
        <p
          className={
            profit === null
              ? "text-sm font-semibold text-zinc-600"
              : profit >= 0
                ? "text-sm font-semibold text-emerald-700"
                : "text-sm font-semibold text-rose-700"
          }
        >
          {profit === null ? "評価不能" : formatSignedJpy(profit)}
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {holding.unrealizedProfitRate === null
            ? toStatusLabel(holding.status)
            : formatSignedPercentRatio(holding.unrealizedProfitRate)}
        </p>
      </div>

      <p className="w-fit rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-700">
        {holding.allocationRatio === null ? "不足" : formatPercentRatio(holding.allocationRatio)}
      </p>
    </Link>
  );
}

function StatusPanel({ message, tone = "info" }: { message: string; tone?: "error" | "info" }) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-md border border-rose-200 bg-white p-4 text-sm leading-6 text-rose-700"
          : "rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700"
      }
    >
      {message}
    </div>
  );
}

function toPortfolioMetrics(portfolio: PortfolioValuation): PortfolioMetric[] {
  return [
    {
      label: "総評価額",
      note: "現金込み",
      value: formatJpy(portfolio.totalAssetValueJpy),
    },
    {
      label: "含み損益",
      note:
        portfolio.totalUnrealizedProfitRate === null
          ? "評価可能な保有なし"
          : formatSignedPercentRatio(portfolio.totalUnrealizedProfitRate),
      tone: portfolio.totalUnrealizedProfitJpy >= 0 ? "positive" : "warning",
      value: formatSignedJpy(portfolio.totalUnrealizedProfitJpy),
    },
    {
      label: "現金",
      note: `現金比率 ${formatPercentRatio(
        portfolio.totalAssetValueJpy > 0
          ? portfolio.totalCashValueJpy / portfolio.totalAssetValueJpy
          : 0,
      )}`,
      value: formatJpy(portfolio.totalCashValueJpy),
    },
    {
      label: "上位集中度",
      note: "上位2銘柄",
      tone: portfolio.topTwoConcentration >= 0.5 ? "warning" : undefined,
      value: formatPercentRatio(portfolio.topTwoConcentration),
    },
  ];
}

function toConcentrationItems(portfolio: PortfolioValuation): ConcentrationItem[] {
  const largestHolding = portfolio.holdings
    .filter((holding) => holding.marketValueJpy !== null)
    .sort((left, right) => (right.marketValueJpy ?? 0) - (left.marketValueJpy ?? 0))[0];

  return [
    {
      description: "次の購入候補を検討できる余力です。",
      label: "現金余力",
      tone: "neutral",
      value: formatJpy(portfolio.totalCashValueJpy),
    },
    {
      description: "評価不能な保有がある場合は、価格または為替の更新が必要です。",
      label: "評価状態",
      tone: portfolio.issues.length > 0 ? "warning" : "neutral",
      value: portfolio.issues.length > 0 ? `${portfolio.issues.length}件不足` : "評価可能",
    },
    {
      description: largestHolding
        ? `単一銘柄の比率は ${formatPercentRatio(largestHolding.allocationRatio ?? 0)} です。`
        : "まだ評価可能な保有がありません。",
      label: "最大保有",
      tone: portfolio.topHoldingConcentration >= 0.35 ? "warning" : "neutral",
      value: largestHolding?.symbol
        ? `${largestHolding.symbol.code} ${largestHolding.symbol.name}`
        : "なし",
    },
  ];
}

function getAllocationColor(index: number): string {
  return allocationColors[index % allocationColors.length]?.className ?? "bg-zinc-500";
}

function getAllocationFillColor(index: number): string {
  return allocationColors[index % allocationColors.length]?.fill ?? "#71717a";
}

function toStatusLabel(status: PortfolioHoldingValuation["status"]): string {
  const labels = {
    "missing-price": "価格不足",
    "missing-rate": "為替不足",
    "missing-symbol": "銘柄不足",
    valued: "評価済み",
  } as const;

  return labels[status];
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("ja-JP", {
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatJpy(value: number): string {
  return formatCurrency(value, "JPY");
}

function formatSignedJpy(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatJpy(value)}`;
}

function formatPercentRatio(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatSignedPercentRatio(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatQuantity(value: number): string {
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value)}株`;
}

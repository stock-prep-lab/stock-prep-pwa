import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { RebalancePlan, RebalanceProposal } from "@stock-prep/domain";

import {
  loadRebalancePlanFromIndexedDb,
  type RebalanceLoadResult,
} from "../data/portfolioRebalanceData";

type SummaryMetric = {
  label: string;
  note: string;
  tone?: "positive" | "warning";
  value: string;
};

type ImprovementItem = {
  description: string;
  label: string;
  tone: "neutral" | "positive" | "warning";
  value: string;
};

type ProposalMetric = {
  label: string;
  value: string;
};

type ComparisonItem = {
  after: string;
  afterWidthPercent: number;
  before: string;
  beforeWidthPercent: number;
  label: string;
  note: string;
};

type RebalanceState =
  | {
      error: string;
      status: "error";
    }
  | {
      result: RebalanceLoadResult;
      status: "loaded";
    }
  | {
      status: "loading";
    };

export function RebalancePage() {
  const [rebalanceState, setRebalanceState] = useState<RebalanceState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    loadRebalancePlanFromIndexedDb()
      .then((result) => {
        if (isMounted) {
          setRebalanceState({ result, status: "loaded" });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setRebalanceState({
            error:
              error instanceof Error ? error.message : "リバランス提案を読み込めませんでした。",
            status: "error",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const plan = rebalanceState.status === "loaded" ? rebalanceState.result.plan : null;
  const selectedProposal = plan?.proposals[0] ?? null;
  const summaryMetrics = plan ? toSummaryMetrics(plan) : [];
  const improvementItems = plan ? toImprovementItems(plan) : [];
  const comparisonItems = selectedProposal ? toComparisonItems(selectedProposal) : [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-teal-700">リバランス提案</p>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">次の一手を比べる</h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              保存済みの保有、現金、日足、為替から、現金を使う候補を計算します。
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
          <InfoRow label="基準通貨" value="JPY" />
          <InfoRow label="提案日" value={plan?.portfolio.asOfDate ?? "-"} />
          <InfoRow label="評価方式" value="IndexedDB 保存データ" />
        </div>
      </div>

      {rebalanceState.status === "loading" ? (
        <StatusPanel message="保存済みデータから提案を計算しています。" />
      ) : rebalanceState.status === "error" ? (
        <StatusPanel message={rebalanceState.error} tone="error" />
      ) : rebalanceState.result.symbolCount === 0 || rebalanceState.result.dailyPriceCount === 0 ? (
        <StatusPanel message="Stooq CSV 取得後に、保有と現金を登録すると提案を表示します。" />
      ) : plan ? (
        <>
          <section className="flex flex-col gap-4" aria-labelledby="rebalance-summary-heading">
            <SectionHeader
              description="提案を見る前の保有バランスです。"
              title="現状サマリー"
              titleId="rebalance-summary-heading"
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryMetrics.map((metric) => (
                <SummaryCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="improvement-heading">
            <SectionHeader
              description="現金を使う場合の改善余地です。"
              title="改善余地"
              titleId="improvement-heading"
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {improvementItems.map((item) => (
                <ImprovementCard item={item} key={item.label} />
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <section className="flex flex-col gap-4" aria-labelledby="proposal-ranking-heading">
              <SectionHeader
                description="スクリーニング候補と現金余力から計算した提案です。"
                title="提案ランキング"
                titleId="proposal-ranking-heading"
              />

              {plan.proposals.length === 0 ? (
                <StatusPanel message="現金余力、価格、為替のいずれかが不足しているため提案を作れません。" />
              ) : (
                <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
                  <div className="hidden grid-cols-[4rem_1fr_7rem_9rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 lg:grid">
                    <span>順位</span>
                    <span>候補</span>
                    <span>改善度</span>
                    <span>想定買付</span>
                  </div>

                  <div className="divide-y divide-zinc-200">
                    {plan.proposals.map((proposal) => (
                      <ProposalRow key={proposal.symbol.id} proposal={proposal} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4" aria-labelledby="comparison-heading">
              <SectionHeader
                description="1位候補を追加した場合の見え方です。"
                title="比較エリア"
                titleId="comparison-heading"
              />

              {selectedProposal ? (
                <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
                  <div className="rounded-md bg-teal-50 p-4">
                    <p className="text-sm font-medium text-teal-700">選択中</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-normal text-zinc-950">
                      {selectedProposal.symbol.code} {selectedProposal.symbol.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {formatJpy(selectedProposal.purchaseAmountJpy)}
                      を追加する前提で、集中度と現金比率の変化を確認します。
                    </p>
                  </div>

                  <div className="grid gap-4">
                    {comparisonItems.map((item) => (
                      <ComparisonBar item={item} key={item.label} />
                    ))}
                  </div>
                </div>
              ) : (
                <StatusPanel message="比較できる提案がまだありません。" />
              )}
            </section>
          </div>
        </>
      ) : null}

      <section
        className="rounded-md border border-teal-200 bg-white p-4"
        aria-label="下部アクション"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-normal text-zinc-950">
              購入前に数量と価格を確認
            </h2>
            <p className="text-sm leading-6 text-zinc-700">
              1位候補をもとに、次の画面で購入後の変化を確認します。
            </p>
          </div>
          <Link
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 sm:w-fit"
            to={
              selectedProposal
                ? `/simulation?symbol=${selectedProposal.symbol.code}`
                : "/simulation"
            }
          >
            シミュレーションへ進む
          </Link>
        </div>
      </section>
    </section>
  );
}

function SectionHeader({
  description,
  title,
  titleId,
}: {
  description: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-semibold tracking-normal" id={titleId}>
        {title}
      </h2>
      <p className="max-w-2xl text-sm leading-6 text-zinc-700">{description}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-zinc-600">{label}</span>
      <span className="text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function SummaryCard({ metric }: { metric: SummaryMetric }) {
  const valueClass =
    metric.tone === "positive"
      ? "text-emerald-700"
      : metric.tone === "warning"
        ? "text-amber-700"
        : "text-zinc-950";

  return (
    <div className="min-h-28 rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-600">{metric.label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-normal ${valueClass}`}>{metric.value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{metric.note}</p>
    </div>
  );
}

function ImprovementCard({ item }: { item: ImprovementItem }) {
  const valueClass =
    item.tone === "positive"
      ? "text-emerald-700"
      : item.tone === "warning"
        ? "text-amber-700"
        : "text-zinc-950";

  return (
    <div className="min-h-40 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-normal text-zinc-950">{item.label}</h3>
        <span className={`text-sm font-semibold ${valueClass}`}>{item.value}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-700">{item.description}</p>
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: RebalanceProposal }) {
  const metrics: ProposalMetric[] = [
    { label: "集中度", value: formatSignedPercentPoint(proposal.concentrationDelta) },
    { label: "現金残", value: formatJpy(proposal.cashAfterJpy) },
    { label: "構成比", value: formatPercentRatio(proposal.allocationAfterRatio) },
  ];

  return (
    <Link
      className="grid gap-4 p-4 text-zinc-950 transition hover:bg-zinc-50 lg:grid-cols-[4rem_1fr_7rem_9rem] lg:items-center"
      to={`/stocks/${proposal.symbol.code}`}
    >
      <p className="w-fit rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-700">
        No. {proposal.rank}
      </p>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold tracking-normal">
            {proposal.symbol.name}
          </h3>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {proposal.symbol.code}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {proposal.symbol.region} / {proposal.symbol.currency}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{proposal.reason}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:max-w-xl">
          {metrics.map((metric) => (
            <div className="rounded-md bg-zinc-50 px-3 py-2" key={metric.label}>
              <p className="text-xs font-medium text-zinc-500">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-1">
        <span className="text-xs font-medium text-zinc-500 lg:hidden">改善度</span>
        <span className="text-sm font-semibold text-emerald-700 lg:text-base">
          {proposal.improvementScore}
        </span>
      </div>
      <div className="grid gap-1">
        <span className="text-xs font-medium text-zinc-500 lg:hidden">想定買付</span>
        <span className="text-sm font-semibold text-zinc-950 lg:text-base">
          {formatJpy(proposal.purchaseAmountJpy)}
        </span>
      </div>
    </Link>
  );
}

function ComparisonBar({ item }: { item: ComparisonItem }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-normal text-zinc-950">{item.label}</h3>
        <p className="text-sm text-zinc-600">
          {item.before} → <span className="font-semibold text-teal-700">{item.after}</span>
        </p>
      </div>
      <div className="grid gap-2">
        <div className="h-3 rounded-full bg-zinc-100">
          <div
            className="h-3 rounded-full bg-zinc-500"
            style={{ width: `${item.beforeWidthPercent}%` }}
          />
        </div>
        <div className="h-3 rounded-full bg-zinc-100">
          <div
            className="h-3 rounded-full bg-teal-700"
            style={{ width: `${item.afterWidthPercent}%` }}
          />
        </div>
      </div>
      <p className="text-sm leading-6 text-zinc-700">{item.note}</p>
    </div>
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

function toSummaryMetrics(plan: RebalancePlan): SummaryMetric[] {
  const { portfolio } = plan;

  return [
    {
      label: "総評価額",
      note: "現金込み",
      value: formatJpy(portfolio.totalAssetValueJpy),
    },
    {
      label: "現金余力",
      note: `現金比率 ${formatPercentRatio(
        portfolio.totalAssetValueJpy > 0
          ? portfolio.totalCashValueJpy / portfolio.totalAssetValueJpy
          : 0,
      )}`,
      tone: portfolio.totalCashValueJpy > 0 ? "positive" : undefined,
      value: formatJpy(portfolio.totalCashValueJpy),
    },
    {
      label: "上位集中度",
      note: "上位2銘柄",
      tone: portfolio.topTwoConcentration >= 0.5 ? "warning" : undefined,
      value: formatPercentRatio(portfolio.topTwoConcentration),
    },
    {
      label: "改善余地",
      note: plan.proposals.length > 0 ? "候補追加で確認可能" : "提案なし",
      value: plan.proposals.length > 0 ? "あり" : "不足",
    },
  ];
}

function toImprovementItems(plan: RebalancePlan): ImprovementItem[] {
  const bestProposal = plan.proposals[0] ?? null;

  return [
    {
      description: "上位2銘柄の比率がどう変わるかを見ます。",
      label: "集中度変化",
      tone: bestProposal && bestProposal.concentrationDelta <= 0 ? "positive" : "warning",
      value: bestProposal ? formatSignedPercentPoint(bestProposal.concentrationDelta) : "不足",
    },
    {
      description: "現金を残しつつ、候補銘柄を段階的に追加する想定です。",
      label: "現金活用",
      tone: bestProposal ? "neutral" : "warning",
      value: bestProposal ? formatJpy(bestProposal.purchaseAmountJpy) : "不足",
    },
    {
      description: "未保有または低比率の候補ほど、偏りを増やしにくくなります。",
      label: "比率補完",
      tone: bestProposal && bestProposal.allocationBeforeRatio < 0.1 ? "positive" : "neutral",
      value: bestProposal ? formatPercentRatio(bestProposal.allocationBeforeRatio) : "不足",
    },
    {
      description: "価格や為替が不足すると提案から除外します。",
      label: "評価状態",
      tone: plan.portfolio.issues.length > 0 ? "warning" : "positive",
      value:
        plan.portfolio.issues.length > 0 ? `${plan.portfolio.issues.length}件不足` : "評価可能",
    },
  ];
}

function toComparisonItems(proposal: RebalanceProposal): ComparisonItem[] {
  const cashBeforeRatio = proposal.cashBeforeJpy / proposal.totalAssetValueJpy;
  const cashAfterRatio = proposal.cashAfterJpy / proposal.totalAssetValueJpy;

  return [
    {
      after: formatPercentRatio(proposal.topTwoAfterRatio),
      afterWidthPercent: toWidthPercent(proposal.topTwoAfterRatio),
      before: formatPercentRatio(proposal.topTwoBeforeRatio),
      beforeWidthPercent: toWidthPercent(proposal.topTwoBeforeRatio),
      label: "上位2銘柄",
      note: "最大保有への依存を少し抑えられるかを確認します。",
    },
    {
      after: formatPercentRatio(cashAfterRatio),
      afterWidthPercent: toWidthPercent(cashAfterRatio),
      before: formatPercentRatio(cashBeforeRatio),
      beforeWidthPercent: toWidthPercent(cashBeforeRatio),
      label: "現金比率",
      note: "買付後も余力を残します。",
    },
    {
      after: formatPercentRatio(proposal.allocationAfterRatio),
      afterWidthPercent: toWidthPercent(proposal.allocationAfterRatio),
      before: formatPercentRatio(proposal.allocationBeforeRatio),
      beforeWidthPercent: toWidthPercent(proposal.allocationBeforeRatio),
      label: proposal.symbol.code,
      note: "候補銘柄の構成比がどう変わるかを確認します。",
    },
  ];
}

function toWidthPercent(ratio: number): number {
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function formatJpy(value: number): string {
  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatPercentRatio(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatSignedPercentPoint(value: number): string {
  const percentagePoint = value * 100;
  const sign = percentagePoint > 0 ? "+" : "";
  return `${sign}${percentagePoint.toFixed(0)}pt`;
}

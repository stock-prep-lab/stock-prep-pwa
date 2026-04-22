import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { RankedScreeningCandidate } from "@stock-prep/domain";

import {
  loadScreeningCandidatesFromIndexedDb,
  type ScreeningCandidatesLoadResult,
} from "../data/screeningCandidates";
import { subscribeToStockPrepDataChanged } from "../data/dataSyncEvents";

type ScreeningCondition = {
  label: string;
  value: string;
  status: "適用中" | "確認";
};

type ScreeningMetric = {
  label: string;
  value: string;
};

type ScreeningSortKey = "highProximity" | "liquidityValueJpy" | "momentum12_1" | "score";

type ScreeningCandidatesState =
  | {
      error: string;
      status: "error";
    }
  | {
      result: ScreeningCandidatesLoadResult;
      status: "loaded";
    }
  | {
      status: "loading";
    };

const conditions: ScreeningCondition[] = [
  {
    label: "12-1M",
    value: "直近1か月を除いた12か月モメンタム",
    status: "適用中",
  },
  {
    label: "6-1M",
    value: "直近1か月を除いた6か月モメンタム",
    status: "適用中",
  },
  {
    label: "高値接近",
    value: "直近高値にどれだけ近いか",
    status: "確認",
  },
  {
    label: "出来高",
    value: "20日平均出来高",
    status: "確認",
  },
  {
    label: "流動性",
    value: "直近終値 × 20日平均出来高をJPY換算",
    status: "適用中",
  },
];

export function ScreeningPage() {
  const [screeningState, setScreeningState] = useState<ScreeningCandidatesState>({
    status: "loading",
  });
  const [sortKey, setSortKey] = useState<ScreeningSortKey>("score");

  useEffect(() => {
    let isMounted = true;

    const loadCandidates = () => {
      void loadScreeningCandidatesFromIndexedDb()
        .then((result) => {
          if (isMounted) {
            setScreeningState({ result, status: "loaded" });
          }
        })
        .catch((error: unknown) => {
          if (isMounted) {
            setScreeningState({
              error:
                error instanceof Error ? error.message : "スクリーニングデータを読めませんでした。",
              status: "error",
            });
          }
        });
    };

    loadCandidates();
    const unsubscribe = subscribeToStockPrepDataChanged(loadCandidates);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const candidates = screeningState.status === "loaded" ? screeningState.result.candidates : [];
  const visibleCandidates = sortScreeningCandidates(candidates, sortKey);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">スクリーニング</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">候補を絞り込む</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            取得済みの日足データから、翌営業日に確認したい候補を並べます。
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="screening-conditions-heading">
        <SectionHeader
          description="翌営業日に確認したい候補を絞るための条件です。"
          title="条件サマリー"
          titleId="screening-conditions-heading"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {conditions.map((condition) => (
            <ConditionCard condition={condition} key={condition.label} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="screening-results-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            description="IndexedDB に保存済みの日足から、モメンタム、高値接近率、流動性を計算します。"
            title="候補一覧"
            titleId="screening-results-heading"
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[28rem]">
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700">並び替え</span>
              <select
                className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-teal-700"
                onChange={(event) => {
                  setSortKey(event.target.value as ScreeningSortKey);
                }}
                value={sortKey}
              >
                <option value="score">総合スコア順</option>
                <option value="momentum12_1">12-1M順</option>
                <option value="highProximity">高値接近率順</option>
                <option value="liquidityValueJpy">流動性順</option>
              </select>
            </label>

            <div className="flex min-h-12 items-center rounded-md border border-zinc-200 bg-white px-4 sm:self-end">
              <p className="text-sm font-medium text-zinc-700">
                表示 <span className="text-zinc-950">{visibleCandidates.length}</span> 件
              </p>
            </div>
          </div>
        </div>

        {screeningState.status === "loading" ? (
          <StatusPanel message="取得済み日足を読み込んでいます。" />
        ) : screeningState.status === "error" ? (
          <StatusPanel message={screeningState.error} tone="error" />
        ) : screeningState.result.symbolCount === 0 ||
          screeningState.result.dailyPriceCount === 0 ? (
          <StatusPanel message="市場データ同期後に、保存済み日足から候補を表示します。" />
        ) : candidates.length === 0 ? (
          <StatusPanel message="計算に使える日足がまだ不足しています。" />
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="hidden grid-cols-[4rem_1fr_7rem_8rem_7rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 lg:grid">
              <span>順位</span>
              <span>銘柄</span>
              <span>スコア</span>
              <span>日付</span>
              <span>前日比</span>
            </div>

            <div className="divide-y divide-zinc-200">
              {visibleCandidates.map((candidate, index) => (
                <CandidateRow
                  candidate={candidate}
                  displayRank={index + 1}
                  key={candidate.symbol.id}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section
        className="rounded-md border border-teal-200 bg-white p-4"
        aria-label="下部アクション"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-normal text-zinc-950">
              候補を保有バランスと一緒に見る
            </h2>
            <p className="text-sm leading-6 text-zinc-700">
              いまの保有に足すならどの候補が合うか、次の画面で確認します。
            </p>
          </div>
          <Link
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 sm:w-fit"
            to="/rebalance"
          >
            リバランス観点で見る
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

function ConditionCard({ condition }: { condition: ScreeningCondition }) {
  return (
    <div className="min-h-32 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-normal text-zinc-950">{condition.label}</h3>
        <span
          className={
            condition.status === "適用中"
              ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
              : "rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
          }
        >
          {condition.status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-700">{condition.value}</p>
    </div>
  );
}

function CandidateRow({
  candidate,
  displayRank,
}: {
  candidate: RankedScreeningCandidate;
  displayRank: number;
}) {
  const metrics = toScreeningMetrics(candidate);
  const changeRate = formatPercent(candidate.metrics.changeRate);

  return (
    <Link
      className="grid gap-4 p-4 text-zinc-950 transition hover:bg-zinc-50 lg:grid-cols-[4rem_1fr_7rem_8rem_7rem] lg:items-center"
      to={`/stocks/${candidate.symbol.code}`}
    >
      <p className="w-fit rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-700">
        No. {displayRank}
      </p>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold tracking-normal">
            {candidate.symbol.name}
          </h3>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {candidate.symbol.code}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {toRegionLabel(candidate.symbol.region)} / Stooq 日足
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{toCandidateReason(candidate)}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-4">
          {metrics.map((metric) => (
            <div className="rounded-md bg-zinc-50 px-3 py-2" key={metric.label}>
              <p className="text-xs font-medium text-zinc-500">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm font-semibold text-zinc-950">Score {candidate.score}</p>
      <p className="text-sm text-zinc-700">{candidate.latestPrice.date}</p>
      <p
        className={
          changeRate.startsWith("+")
            ? "text-sm font-semibold text-emerald-700"
            : "text-sm font-semibold text-amber-700"
        }
      >
        {changeRate}
      </p>
    </Link>
  );
}

function sortScreeningCandidates(
  candidates: RankedScreeningCandidate[],
  sortKey: ScreeningSortKey,
): RankedScreeningCandidate[] {
  const metricKeys = {
    highProximity: "highProximity",
    liquidityValueJpy: "liquidityValueJpy",
    momentum12_1: "momentum12_1",
  } as const;

  if (sortKey === "score") {
    return candidates;
  }

  const metricKey = metricKeys[sortKey];

  return [...candidates].sort((left, right) => {
    const leftValue = left.metrics[metricKey];
    const rightValue = right.metrics[metricKey];

    if (leftValue === null && rightValue === null) {
      return right.score - left.score || left.symbol.code.localeCompare(right.symbol.code);
    }

    if (leftValue === null) {
      return 1;
    }

    if (rightValue === null) {
      return -1;
    }

    return (
      rightValue - leftValue ||
      right.score - left.score ||
      left.symbol.code.localeCompare(right.symbol.code)
    );
  });
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

function toScreeningMetrics(candidate: RankedScreeningCandidate): ScreeningMetric[] {
  return [
    { label: "12-1M", value: formatPercent(candidate.metrics.momentum12_1) },
    { label: "6-1M", value: formatPercent(candidate.metrics.momentum6_1) },
    { label: "高値接近", value: formatPercent(candidate.metrics.highProximity) },
    { label: "20日平均出来高", value: formatCompactNumber(candidate.metrics.averageVolume20) },
    { label: "売買代金", value: formatJpyCompactNumber(candidate.metrics.liquidityValueJpy) },
  ];
}

function toCandidateReason(candidate: RankedScreeningCandidate): string {
  if (candidate.metrics.momentum12_1 !== null && candidate.metrics.momentum12_1 > 0) {
    return "12-1モメンタムがプラスで、取得済みデータ内では相対的に強い候補です。";
  }

  if (candidate.metrics.highProximity !== null && candidate.metrics.highProximity >= 95) {
    return "直近高値に近い水準で推移しています。";
  }

  return "取得済み日足から、価格位置と流動性をもとに候補に残っています。";
}

function toRegionLabel(region: RankedScreeningCandidate["symbol"]["region"]): string {
  const labels = {
    HK: "香港",
    JP: "日本",
    UK: "英国",
    US: "米国",
  } as const;

  return labels[region];
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "不足";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCompactNumber(value: number | null): string {
  if (value === null) {
    return "不足";
  }

  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatJpyCompactNumber(value: number | null): string {
  if (value === null) {
    return "不足";
  }

  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

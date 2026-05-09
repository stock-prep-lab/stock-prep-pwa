import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import type { RegionCode } from "@stock-prep/shared";

import { StockDetailChart } from "../components/StockDetailChart";
import {
  defaultStockDetailChartVisibility,
  loadStockDetailPageData,
  type StockDetailChartVisibility,
  type StockDetailMetric,
  type StockDetailPageData,
  type StockDetailTrendSignal,
} from "../data/stockDetailData";
import { subscribeToStockPrepDataChanged } from "../data/dataSyncEvents";

type StockDetailState =
  | { status: "error"; error: string }
  | { status: "loaded"; detail: StockDetailPageData }
  | { status: "loading" }
  | { status: "not-found" };

const toggleItems: Array<{
  id: keyof StockDetailChartVisibility;
  label: string;
}> = [
  { id: "ma25", label: "25MA" },
  { id: "ma75", label: "75MA" },
  { id: "recentHigh", label: "直近高値ライン" },
  { id: "buyPrice", label: "買値ライン" },
  { id: "stopLoss", label: "損切りライン" },
];

export function StockDetailPage() {
  const { symbolCode } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<StockDetailState>({ status: "loading" });
  const [chartVisibility, setChartVisibility] = useState<StockDetailChartVisibility>(
    defaultStockDetailChartVisibility,
  );

  const regionParam = searchParams.get("region");
  const region =
    regionParam === "JP" || regionParam === "US" || regionParam === "HK"
      ? regionParam
      : null;

  useEffect(() => {
    let active = true;

    async function load() {
      if (!symbolCode) {
        if (active) {
          setState({ status: "not-found" });
        }
        return;
      }

      setState({ status: "loading" });

      try {
        const detail = await loadStockDetailPageData({
          region: region as RegionCode | null,
          symbolCode,
        });

        if (!active) {
          return;
        }

        if (!detail) {
          setState({ status: "not-found" });
          return;
        }

        setChartVisibility({
          ...defaultStockDetailChartVisibility,
          buyPrice: detail.holding !== null,
          stopLoss: false,
        });
        setState({ detail, status: "loaded" });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          error: error instanceof Error ? error.message : "銘柄詳細を読み込めませんでした。",
          status: "error",
        });
      }
    }

    void load();
    const unsubscribe = subscribeToStockPrepDataChanged(() => {
      void load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [region, symbolCode]);

  return (
    <section className="flex flex-col gap-8">
      {state.status === "loading" ? (
        <StatusPanel message="銘柄詳細を読み込んでいます。" />
      ) : state.status === "error" ? (
        <StatusPanel message={state.error} tone="error" />
      ) : state.status === "not-found" ? (
        <StatusPanel message="対象銘柄が見つかりません。検索結果から開き直してください。" />
      ) : (
        <LoadedStockDetail
          chartVisibility={chartVisibility}
          detail={state.detail}
          onToggle={(toggleId) => {
            setChartVisibility((current) => ({
              ...current,
              [toggleId]: !current[toggleId],
            }));
          }}
        />
      )}
    </section>
  );
}

function LoadedStockDetail({
  chartVisibility,
  detail,
  onToggle,
}: {
  chartVisibility: StockDetailChartVisibility;
  detail: StockDetailPageData;
  onToggle: (toggleId: keyof StockDetailChartVisibility) => void;
}) {
  const latestCloseValue =
    detail.latestBar !== null
      ? formatCurrency(detail.latestBar.close, detail.symbol.currency)
      : detail.symbol.lastClose !== null
        ? formatCurrency(detail.symbol.lastClose, detail.symbol.currency)
        : "終値未取得";
  const latestCloseDate = detail.symbol.lastCloseDate ?? "日付未取得";
  const latestVolume = detail.latestBar ? formatVolume(detail.latestBar.volume) : "-";

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-teal-700">銘柄詳細</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                {detail.symbol.name}
              </h1>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700">
                {detail.symbol.code}
              </span>
            </div>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              必要な履歴だけを R2 から読み込み、軽量データと組み合わせて確認します。
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
              <span>{detail.marketLabel}</span>
              <span>{detail.symbol.currency}</span>
              <span>{detail.symbol.securityType === "etf" ? "ETF" : "株式"}</span>
              <span>{detail.symbol.sourceSymbol}</span>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-600">最新終値</span>
            <strong className="text-3xl font-semibold tracking-normal text-zinc-950">
              {latestCloseValue}
            </strong>
            <span className="text-sm text-zinc-600">終値日付: {latestCloseDate}</span>
          </div>

          <div className="grid gap-2 border-t border-zinc-200 pt-4 text-sm text-zinc-700">
            <InfoRow label="出来高" value={latestVolume} />
            <InfoRow label="データ状態" value={detail.importStatusLabel} />
            <InfoRow label="為替" value={detail.priceMetrics[5]?.value ?? "-"} />
            <InfoRow
              label="保有"
              value={
                detail.holding
                  ? `${formatQuantity(detail.holding.quantity)} / 取得 ${formatCurrency(
                      detail.holding.averagePrice,
                      detail.holding.currency,
                    )}`
                  : "未登録"
              }
            />
          </div>
        </aside>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="price-summary-heading">
        <SectionHeader
          description="引け後に確認するための価格サマリーです。"
          title="価格サマリー"
          titleId="price-summary-heading"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {detail.priceMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="chart-heading">
        <SectionHeader
          description="ローソク足と出来高に、移動平均線や保有ラインを重ねて確認します。"
          title="チャート"
          titleId="chart-heading"
        />

        {detail.chartData.candlesticks.length === 0 ? (
          <StatusPanel message="この銘柄はまだ日足履歴がありません。" />
        ) : (
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <StockDetailChart chartData={detail.chartData} visibility={chartVisibility} />

            <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-200 pt-4">
              {toggleItems.map((item) => {
                const disabled =
                  (item.id === "buyPrice" || item.id === "stopLoss") && detail.holding === null;

                return (
                  <label
                    className={[
                      "flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm",
                      disabled
                        ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                        : "border-zinc-300 bg-white text-zinc-700",
                    ].join(" ")}
                    key={item.id}
                  >
                    <input
                      checked={chartVisibility[item.id]}
                      className="h-4 w-4 accent-teal-700"
                      disabled={disabled}
                      onChange={() => {
                        onToggle(item.id);
                      }}
                      type="checkbox"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col gap-4" aria-labelledby="trend-heading">
          <SectionHeader
            description="候補に入れる前に見る短い判定です。"
            title="トレンド分析"
            titleId="trend-heading"
          />

          <div className="grid gap-3">
            {detail.trendSignals.map((signal) => (
              <TrendCard key={signal.label} signal={signal} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="comment-heading">
          <SectionHeader
            description="チャートと保有ラインから、確認ポイントを短くまとめます。"
            title="確認メモ"
            titleId="comment-heading"
          />

          <div className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
            <ul className="grid gap-3 text-sm leading-7 text-zinc-700">
              {detail.insightLines.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
            <div className="grid gap-2 pt-4 text-sm text-zinc-600 sm:grid-cols-2 lg:grid-cols-1">
              <p>dataset version: {detail.datasetVersion}</p>
              <p>更新時刻: {formatDateTime(detail.generatedAt)}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-md border border-teal-200 bg-white p-4" aria-label="アクション">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            className="flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700"
            to={`/holdings/${detail.symbol.code}/edit`}
          >
            保有に追加
          </Link>
          <Link
            className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
            to={`/simulation?symbol=${detail.symbol.code}`}
          >
            シミュレーションする
          </Link>
          <Link
            className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
            to="/search"
          >
            検索へ戻る
          </Link>
        </div>
      </section>
    </>
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
      <h2 className="text-xl font-semibold tracking-normal text-zinc-950" id={titleId}>
        {title}
      </h2>
      <p className="text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

function MetricCard({ metric }: { metric: StockDetailMetric }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-600">{metric.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{metric.value}</p>
      {metric.note ? <p className="mt-2 text-sm text-zinc-600">{metric.note}</p> : null}
    </div>
  );
}

function TrendCard({ signal }: { signal: StockDetailTrendSignal }) {
  const toneClass =
    signal.tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : signal.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-normal text-zinc-950">{signal.label}</h3>
        <span className={`rounded-md border px-2 py-1 text-sm font-semibold ${toneClass}`}>
          {signal.value}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{signal.description}</p>
    </div>
  );
}

function StatusPanel({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "error" | "neutral";
}) {
  return (
    <div
      className={[
        "rounded-md border px-4 py-4 text-sm leading-7",
        tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-zinc-200 bg-white text-zinc-700",
      ].join(" ")}
    >
      {message}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-950">{value}</span>
    </div>
  );
}

function formatCurrency(value: number, currency: "HKD" | "JPY" | "USD"): string {
  return new Intl.NumberFormat("ja-JP", {
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}株`;
}

function formatVolume(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}株`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

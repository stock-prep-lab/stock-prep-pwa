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
import { formatPriceCurrency } from "../data/priceFormat";

type StockDetailState =
  | { status: "error"; error: string }
  | { status: "loaded"; detail: StockDetailPageData }
  | { status: "loading" }
  | { status: "not-found" };

const toggleSections: Array<{
  items: Array<{ id: keyof StockDetailChartVisibility; label: string }>;
  title: string;
}> = [
  {
    items: [
      { id: "ma25", label: "25MA" },
      { id: "ma75", label: "75MA" },
      { id: "ichimoku", label: "一目均衡表" },
      { id: "bollinger", label: "ボリンジャー" },
      { id: "macd", label: "MACD(12,26,9)" },
      { id: "recentHigh", label: "直近高値ライン" },
      { id: "buyPrice", label: "買値ライン" },
      { id: "stopLoss", label: "損切りライン" },
    ],
    title: "トレンド分析",
  },
  {
    items: [
      { id: "rsi", label: "RSI(14)" },
      { id: "stochastic", label: "ストキャスティクス" },
    ],
    title: "オシレーター分析",
  },
];

const compactLegendItems: Array<{
  colorClass: string;
  id?: keyof StockDetailChartVisibility;
  label: string;
  parts?: string[];
}> = [
  { colorClass: "bg-teal-700", id: "ma25", label: "25MA" },
  { colorClass: "bg-amber-600", id: "ma75", label: "75MA" },
  {
    colorClass: "bg-blue-600",
    id: "ichimoku",
    label: "一目",
    parts: ["転換", "基準", "先A", "先B"],
  },
  {
    colorClass: "bg-indigo-500",
    id: "bollinger",
    label: "ボリンジャー",
    parts: ["上", "中", "下"],
  },
  {
    colorClass: "bg-fuchsia-600",
    id: "rsi",
    label: "RSI",
    parts: ["本体", "70", "30"],
  },
  {
    colorClass: "bg-emerald-700",
    id: "stochastic",
    label: "ストキャス",
    parts: ["%K", "%D", "80", "20"],
  },
  {
    colorClass: "bg-blue-600",
    id: "macd",
    label: "MACD",
    parts: ["本体", "Signal", "Hist"],
  },
  { colorClass: "bg-zinc-500", id: "recentHigh", label: "高値" },
  { colorClass: "bg-blue-500", id: "buyPrice", label: "買値" },
  { colorClass: "bg-red-600", id: "stopLoss", label: "損切り" },
];

const trendSignalHelpMap: Record<
  string,
  {
    summary: string;
    usage: string[];
  }
> = {
  "25MA": {
    summary:
      "25MA は 25 営業日の終値平均で、約 1 か月の流れをならして見る移動平均線です。",
    usage: [
      "株価が 25MA の上にあれば、短期的には強さを保っていると見ます。",
      "25MA が上向きなら、短期トレンドは上向きと解釈しやすいです。",
      "一方で移動平均線は遅行指標なので、動いたあとにシグナルが出やすい点は注意します。",
    ],
  },
  "75MA": {
    summary:
      "75MA は 75 営業日の終値平均で、中期トレンドの土台を見るための移動平均線です。",
    usage: [
      "株価が 75MA の上なら、中期的な上昇基調を維持しているかを確認します。",
      "25MA が 75MA を上抜けるとゴールデンクロス、下抜けるとデッドクロスの候補として見ます。",
      "短期の勢いだけでなく、流れ全体が崩れていないかを見る軸として使います。",
    ],
  },
  "一目均衡表": {
    summary:
      "一目均衡表は転換線・基準線・雲を使って、トレンド方向と支持抵抗を一目で見る指標です。",
    usage: [
      "株価が雲の上なら上昇基調、雲の下なら下落基調、雲の中なら方向感がまだ弱いと見ます。",
      "転換線が基準線を上回ると短期優勢、下回ると短期の勢いが弱いと見やすいです。",
      "雲の厚みがあるほど、支持や抵抗として機能しやすいかを確認します。",
    ],
  },
  "RSI(14)": {
    summary:
      "RSI は 0〜100 で買われすぎ・売られすぎや勢いの偏りを見る代表的な指標です。",
    usage: [
      "上昇トレンドでは 40〜50 付近まで下がって反発したら押し目候補として見ます。",
      "下落トレンドでは 50〜60 付近で跳ね返されると戻り売り候補として警戒します。",
      "レンジ相場では 30 付近で買い、70 付近で売りを検討する目安にします。",
    ],
  },
  "ストキャスティクス": {
    summary:
      "ストキャスティクスは直近レンジの中で現在値がどこにあるかを見て、短期の過熱感や反転候補を測る指標です。",
    usage: [
      "80以上は買われすぎ気味、20以下は売られすぎ気味の目安として見ます。",
      "%K が %D を上抜けると反発候補、下抜けると失速候補として見やすいです。",
      "上昇トレンドでは 40〜50 付近からの反発、下落トレンドでは 50〜60 付近からの失速も確認材料になります。",
    ],
  },
  "MACD(12,26,9)": {
    summary:
      "MACD は短期と長期の EMA の差から、トレンド転換と勢いの変化を同時に見る指標です。",
    usage: [
      "MACD がシグナル線を上抜けたら買いシグナル候補、下抜けたら売りシグナル候補として見ます。",
      "MACD が 0 ラインより上なら上昇基調、下なら下落基調の目安です。",
      "ヒストグラムの拡大は勢いの強まり、縮小は勢いの鈍化として読みます。",
    ],
  },
  "ボリンジャー(20,±2σ)": {
    summary:
      "ボリンジャーバンドは 20 日移動平均を中心に、標準偏差で価格の行き過ぎやボラティリティを見る指標です。",
    usage: [
      "レンジ相場では上側バンド付近を高すぎ候補、下側バンド付近を安すぎ候補として見ます。",
      "トレンド相場で上側バンドに沿って上がると強い上昇、下側に沿って下がると強い下落を疑います。",
      "バンドに触れたら即反転ではなく、強い相場ではバンドウォークが続く点に注意します。",
    ],
  },
};

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
  const [activeHelpLabel, setActiveHelpLabel] = useState<string | null>(null);
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
          description="ローソク足と出来高に、トレンド系とオシレーター系の指標を重ねて確認します。"
          title="チャート"
          titleId="chart-heading"
        />

        {detail.chartData.candlesticks.length === 0 ? (
          <StatusPanel message="この銘柄はまだ日足履歴がありません。" />
        ) : (
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="relative">
              <StockDetailChart chartData={detail.chartData} visibility={chartVisibility} />
              <CompactChartLegend detail={detail} visibility={chartVisibility} />
            </div>

            <div className="mt-4 grid gap-4 border-t border-zinc-200 pt-4">
              {toggleSections.map((section) => (
                <div className="grid gap-3" key={section.title}>
                  <p className="text-sm font-medium text-zinc-600">{section.title}</p>
                  <div className="flex flex-wrap gap-3">
                    {section.items.map((item) => {
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
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col gap-4" aria-labelledby="trend-heading">
          <SectionHeader
            description="トレンド系とオシレーター系の判定を区分ごとにまとめます。"
            title="分析サマリー"
            titleId="trend-heading"
          />

          <AnalysisSection
            signals={detail.trendSignals.filter((signal) => signal.group === "trend")}
            title="トレンド分析"
            onShowHelp={setActiveHelpLabel}
          />
          <AnalysisSection
            signals={detail.trendSignals.filter((signal) => signal.group === "oscillator")}
            title="オシレーター分析"
            onShowHelp={setActiveHelpLabel}
          />
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="comment-heading">
          <SectionHeader
            description="チャートと保有ラインから、区分ごとに確認ポイントを短くまとめます。"
            title="確認メモ"
            titleId="comment-heading"
          />

          <div className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
            <div className="grid gap-4">
              {detail.insightSections.map((section) => (
                <div className="grid gap-2" key={section.title}>
                  <p className="text-sm font-medium text-zinc-600">{section.title}</p>
                  <ul className="grid gap-2 text-sm leading-7 text-zinc-700">
                    {section.lines.map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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

      <TrendHelpModal
        content={activeHelpLabel ? trendSignalHelpMap[activeHelpLabel] ?? null : null}
        label={activeHelpLabel}
        onClose={() => {
          setActiveHelpLabel(null);
        }}
      />
    </>
  );
}

function AnalysisSection({
  onShowHelp,
  signals,
  title,
}: {
  onShowHelp: (label: string) => void;
  signals: StockDetailTrendSignal[];
  title: string;
}) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-base font-semibold tracking-normal text-zinc-950">{title}</h3>
      <div className="grid gap-3">
        {signals.map((signal) => (
          <TrendCard
            key={signal.label}
            onShowHelp={() => {
              onShowHelp(signal.label);
            }}
            signal={signal}
          />
        ))}
      </div>
    </div>
  );
}

function CompactChartLegend({
  detail,
  visibility,
}: {
  detail: StockDetailPageData;
  visibility: StockDetailChartVisibility;
}) {
  const activeItems = compactLegendItems.filter((item) => {
    if (!item.id) {
      return true;
    }

    if ((item.id === "buyPrice" || item.id === "stopLoss") && detail.holding === null) {
      return false;
    }

    return visibility[item.id];
  });

  if (activeItems.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
      <div className="flex flex-wrap gap-1.5">
        {activeItems.map((item) => (
          <span
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-zinc-200/90 bg-white/88 px-2 py-1 text-[11px] leading-5 text-zinc-700 shadow-sm backdrop-blur-sm"
            key={item.label}
          >
            <span className={`h-2 w-2 rounded-full ${item.colorClass}`} />
            <span className="font-medium text-zinc-800">{item.label}</span>
            {item.parts ? <span className="text-zinc-500">{item.parts.join("/")}</span> : null}
          </span>
        ))}
      </div>
    </div>
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

function TrendCard({
  onShowHelp,
  signal,
}: {
  onShowHelp: () => void;
  signal: StockDetailTrendSignal;
}) {
  const toneClass =
    signal.tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : signal.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-normal text-zinc-950">{signal.label}</h3>
          <button
            aria-label={`${signal.label} の説明を開く`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-semibold text-zinc-600 transition hover:border-teal-700 hover:text-teal-700"
            onClick={onShowHelp}
            type="button"
          >
            ?
          </button>
        </div>
        <span className={`rounded-md border px-2 py-1 text-sm font-semibold ${toneClass}`}>
          {signal.value}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{signal.description}</p>
    </div>
  );
}

function TrendHelpModal({
  content,
  label,
  onClose,
}: {
  content: { summary: string; usage: string[] } | null;
  label: string | null;
  onClose: () => void;
}) {
  if (!content || !label) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4 py-8"
      role="dialog"
    >
      <div className="w-full max-w-xl rounded-md bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold tracking-normal text-zinc-950">{label}</h3>
            <p className="text-sm leading-6 text-zinc-700">{content.summary}</p>
          </div>
          <button
            aria-label="説明を閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-lg text-zinc-600 transition hover:border-teal-700 hover:text-teal-700"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <p className="text-sm font-medium text-zinc-600">判断に使う時の見方</p>
          <ul className="mt-3 grid gap-3 text-sm leading-7 text-zinc-700">
            {content.usage.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-teal-700"
            onClick={onClose}
            type="button"
          >
            閉じる
          </button>
        </div>
      </div>
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
  return formatPriceCurrency(value, currency);
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

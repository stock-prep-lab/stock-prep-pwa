import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import {
  buildPurchaseSimulation,
  type PurchaseSimulation,
  type PurchaseSimulationAllocation,
} from "@stock-prep/domain";

import {
  loadPurchaseSimulationTargetFromIndexedDb,
  type PurchaseSimulationLoadResult,
  type PurchaseSimulationTarget,
} from "../data/purchaseSimulationData";

type SimulationState =
  | {
      error: string;
      status: "error";
    }
  | {
      result: PurchaseSimulationLoadResult;
      status: "loaded";
    }
  | {
      status: "loading";
    };

type ChangeMetric = {
  after: string;
  before: string;
  label: string;
  note: string;
  tone?: "positive" | "warning";
};

const allocationColors = ["#0f766e", "#059669", "#0284c7", "#d97706", "#e11d48", "#71717a"];

export function SimulationPage() {
  const [searchParams] = useSearchParams();
  const symbolCode = searchParams.get("symbol");
  const [simulationState, setSimulationState] = useState<SimulationState>({ status: "loading" });
  const [purchasePriceInput, setPurchasePriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [visibleAllocation, setVisibleAllocation] = useState<"after" | "before">("after");

  useEffect(() => {
    let isMounted = true;

    setSimulationState({ status: "loading" });
    loadPurchaseSimulationTargetFromIndexedDb(symbolCode)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setSimulationState({ result, status: "loaded" });

        if (result.target) {
          setPurchasePriceInput(formatInputNumber(result.target.suggestedPrice ?? 0));
          setQuantityInput(formatInputNumber(result.target.suggestedQuantity ?? 0));
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setSimulationState({
            error:
              error instanceof Error
                ? error.message
                : "購入シミュレーションを読み込めませんでした。",
            status: "error",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbolCode]);

  const target = simulationState.status === "loaded" ? simulationState.result.target : null;
  const simulation = useMemo(() => {
    if (!target) {
      return null;
    }

    return buildPurchaseSimulation({
      exchangeRates: target.exchangeRates,
      portfolio: target.portfolio,
      purchasePrice: parseInputNumber(purchasePriceInput),
      quantity: parseInputNumber(quantityInput),
      symbol: target.symbol,
    });
  }, [purchasePriceInput, quantityInput, target]);
  const allocationItems =
    simulation && visibleAllocation === "before"
      ? simulation.beforeAllocations
      : (simulation?.afterAllocations ?? []);
  const changeMetrics = simulation && target ? toChangeMetrics(simulation, target) : [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-teal-700">購入シミュレーション</p>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              買う前に変化を見る
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              購入価格と株数を入力し、保存済みの保有、現金、為替から構成比の変化を計算します。
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
          <InfoRow label="基準通貨" value="JPY" />
          <InfoRow label="計算方式" value="IndexedDB 保存データ" />
          <InfoRow label="対象" value={target?.symbol.code ?? symbolCode ?? "-"} />
        </div>
      </div>

      {simulationState.status === "loading" ? (
        <StatusPanel message="保存済みデータからシミュレーション対象を読み込んでいます。" />
      ) : simulationState.status === "error" ? (
        <StatusPanel message={simulationState.error} tone="error" />
      ) : simulationState.result.symbolCount === 0 ||
        simulationState.result.dailyPriceCount === 0 ? (
        <StatusPanel message="Stooq CSV 取得後に、銘柄詳細またはリバランス提案から開くと計算できます。" />
      ) : !target || !simulation ? (
        <StatusPanel message="対象銘柄が見つかりません。銘柄詳細から開き直してください。" />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <TargetSection target={target} />

            <section className="flex flex-col gap-4" aria-labelledby="simulation-input-heading">
              <SectionHeader
                description="値を変えると、下の Before / After と数値がすぐ更新されます。"
                title="入力フォーム"
                titleId="simulation-input-heading"
              />

              <form className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <NumberInput
                    inputMode="decimal"
                    label="購入価格"
                    onChange={setPurchasePriceInput}
                    suffix={target.symbol.currency}
                    value={purchasePriceInput}
                  />
                  <NumberInput
                    inputMode="decimal"
                    label="株数"
                    onChange={setQuantityInput}
                    suffix="株"
                    value={quantityInput}
                  />
                </div>

                <div
                  className={
                    simulation.status === "ready"
                      ? "grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-3"
                      : "grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 sm:grid-cols-3"
                  }
                >
                  <InputSummary label="購入金額" value={formatJpy(simulation.purchaseAmountJpy)} />
                  <InputSummary label="現金残高" value={formatJpy(simulation.cashAfterJpy)} />
                  <InputSummary
                    label="対象構成比"
                    value={formatPercentRatio(simulation.targetAllocationAfterRatio)}
                  />
                </div>

                <p
                  className={
                    simulation.status === "ready"
                      ? "text-sm leading-6 text-emerald-700"
                      : "text-sm leading-6 text-amber-700"
                  }
                >
                  {simulation.statusMessage}
                </p>
              </form>
            </section>
          </div>

          <section className="flex flex-col gap-4" aria-labelledby="allocation-comparison-heading">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <SectionHeader
                description="円グラフと数値で購入前後を比べます。"
                title="Before / After"
                titleId="allocation-comparison-heading"
              />

              <div className="grid grid-cols-2 rounded-md border border-zinc-200 bg-white p-1 lg:min-w-64">
                <ToggleButton
                  active={visibleAllocation === "before"}
                  label="Before"
                  onClick={() => setVisibleAllocation("before")}
                />
                <ToggleButton
                  active={visibleAllocation === "after"}
                  label="After"
                  onClick={() => setVisibleAllocation("after")}
                />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <AllocationPanel
                allocations={allocationItems}
                stockRatio={
                  visibleAllocation === "before"
                    ? simulation.stockAllocationBeforeRatio
                    : simulation.stockAllocationAfterRatio
                }
                title={visibleAllocation === "before" ? "購入前" : "購入後"}
              />

              <div className="grid gap-3">
                {changeMetrics.map((metric) => (
                  <ChangeCard key={metric.label} metric={metric} />
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="simulation-comment-heading">
            <SectionHeader
              description="購入判断前の確認メモです。"
              title="改善コメント"
              titleId="simulation-comment-heading"
            />

            <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-[1fr_16rem] lg:items-center">
              <p className="text-sm leading-7 text-zinc-700">
                {buildSimulationComment(simulation, target)}
              </p>
              <Link
                className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
                to="/rebalance"
              >
                提案に戻る
              </Link>
            </div>
          </section>

          <section
            aria-label="下部アクション"
            className="rounded-md border border-teal-200 bg-white p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold tracking-normal text-zinc-950">
                  保存前にもう一度確認
                </h2>
                <p className="text-sm leading-6 text-zinc-700">
                  この Slice では保有への保存は行わず、購入後の構成変化だけを確認します。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
                  to={`/stocks/${target.symbol.code}`}
                >
                  銘柄詳細
                </Link>
                <button
                  className="min-h-12 rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={simulation.status !== "ready"}
                  type="button"
                >
                  内容を確認済み
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function TargetSection({ target }: { target: PurchaseSimulationTarget }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="simulation-target-heading">
      <SectionHeader
        description="購入候補として確認する銘柄です。"
        title="対象銘柄"
        titleId="simulation-target-heading"
      />

      <Link
        className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
        to={`/stocks/${target.symbol.code}`}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-normal">{target.symbol.name}</h2>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700">
              {target.symbol.code}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">{target.symbol.sourceSymbol}</p>
        </div>

        <div className="grid gap-2">
          <InfoRow label="市場" value={target.symbol.region} />
          <InfoRow label="通貨" value={target.symbol.currency} />
          <InfoRow
            label="終値"
            value={
              target.latestPrice
                ? formatCurrency(target.latestPrice.close, target.latestPrice.currency)
                : "価格なし"
            }
          />
        </div>
      </Link>
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

function NumberInput({
  inputMode,
  label,
  onChange,
  suffix,
  value,
}: {
  inputMode: "decimal" | "numeric";
  label: string;
  onChange: (value: string) => void;
  suffix: string;
  value: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <div className="flex min-h-12 overflow-hidden rounded-md border border-zinc-300 bg-white focus-within:border-teal-700">
        <input
          className="min-w-0 flex-1 px-3 text-base text-zinc-950 outline-none"
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
        <span className="flex min-w-16 items-center justify-center border-l border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-600">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function AllocationPanel({
  allocations,
  stockRatio,
  title,
}: {
  allocations: PurchaseSimulationAllocation[];
  stockRatio: number;
  title: string;
}) {
  return (
    <div className="flex min-h-[30rem] flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-1 items-center justify-center py-4">
        <div className="relative grid size-56 place-items-center sm:size-64">
          <ResponsiveContainer height="100%" width="100%">
            <PieChart>
              <Pie
                cx="50%"
                cy="50%"
                data={allocations}
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
                {allocations.map((item) => (
                  <Cell fill={getAllocationColor(item.colorIndex)} key={item.id} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="grid size-32 place-items-center rounded-full bg-white text-center shadow-sm sm:size-36">
              <div>
                <p className="text-sm font-medium text-zinc-600">{title}</p>
                <p className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
                  {formatPercentRatio(stockRatio)}
                </p>
                <p className="mt-1 text-xs font-medium text-zinc-500">株式比率</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {allocations.map((item) => (
          <div className="flex items-center justify-between gap-3" key={item.id}>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: getAllocationColor(item.colorIndex) }}
              />
              <span className="truncate text-sm font-medium text-zinc-700">{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-zinc-950">
              {formatPercentRatio(item.ratio)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "min-h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white"
          : "min-h-10 rounded-md px-4 text-sm font-medium text-zinc-700 transition hover:text-teal-700"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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

function InputSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function ChangeCard({ metric }: { metric: ChangeMetric }) {
  const afterClass =
    metric.tone === "positive"
      ? "text-emerald-700"
      : metric.tone === "warning"
        ? "text-amber-700"
        : "text-zinc-950";

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-normal text-zinc-950">{metric.label}</h3>
        <p className="text-sm text-zinc-600">
          {metric.before} → <span className={`font-semibold ${afterClass}`}>{metric.after}</span>
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{metric.note}</p>
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

function toChangeMetrics(
  simulation: PurchaseSimulation,
  target: PurchaseSimulationTarget,
): ChangeMetric[] {
  return [
    {
      after: formatJpy(simulation.purchaseAmountJpy),
      before: formatJpy(0),
      label: "購入金額",
      note: `${formatCurrency(simulation.purchasePrice, target.symbol.currency)} を ${formatQuantity(
        simulation.quantity,
      )} 入力した場合の金額です。`,
    },
    {
      after: formatJpy(simulation.cashAfterJpy),
      before: formatJpy(simulation.cashBeforeJpy),
      label: "現金残高",
      note:
        simulation.status === "insufficient-cash"
          ? "現金残高を超えています。購入価格または株数を調整してください。"
          : "買付後も残る現金余力です。",
      tone: simulation.status === "insufficient-cash" ? "warning" : "positive",
    },
    {
      after: formatPercentRatio(simulation.topTwoAfterRatio),
      before: formatPercentRatio(simulation.topTwoBeforeRatio),
      label: "上位2銘柄",
      note: "購入後の上位2銘柄集中度です。",
      tone: simulation.topTwoAfterRatio <= simulation.topTwoBeforeRatio ? "positive" : "warning",
    },
    {
      after: formatPercentRatio(simulation.targetAllocationAfterRatio),
      before: formatPercentRatio(simulation.targetAllocationBeforeRatio),
      label: target.symbol.code,
      note: "対象銘柄の構成比がどう変わるかを確認します。",
    },
  ];
}

function buildSimulationComment(
  simulation: PurchaseSimulation,
  target: PurchaseSimulationTarget,
): string {
  if (simulation.status === "invalid-input") {
    return "購入価格と株数を入力すると、購入後の構成比と現金残高を確認できます。";
  }

  if (simulation.status === "missing-rate") {
    return `${target.symbol.name} は ${target.symbol.currency} 建てのため、JPY 換算用の為替レートが必要です。`;
  }

  if (simulation.status === "insufficient-cash") {
    return `${target.symbol.name} の購入金額が現金残高を超えています。数量を下げるか、購入価格を見直してから確認してください。`;
  }

  if (simulation.topTwoAfterRatio > simulation.topTwoBeforeRatio) {
    return `${target.symbol.name} を追加すると対象銘柄の比率は上がりますが、上位2銘柄集中度も上がります。買い急がず、数量を小さくした場合も確認します。`;
  }

  return `${target.symbol.name} を追加すると、現金を使いながら対象銘柄の比率を補えます。上位2銘柄集中度を大きく悪化させないか確認しつつ、購入価格と株数を調整します。`;
}

function getAllocationColor(index: number): string {
  return allocationColors[index % allocationColors.length] ?? "#71717a";
}

function parseInputNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  return normalized === "" ? 0 : Number(normalized);
}

function formatInputNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
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

function formatPercentRatio(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatQuantity(value: number): string {
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value)}株`;
}

import { useState } from "react";
import { Link } from "react-router-dom";

type TargetStock = {
  code: string;
  name: string;
  market: string;
  currency: string;
  sector: string;
  close: string;
};

type SimulationInput = {
  label: string;
  value: string;
  suffix: string;
  inputMode: "numeric" | "decimal";
};

type AllocationItem = {
  label: string;
  value: string;
  color: string;
};

type ChangeMetric = {
  label: string;
  before: string;
  after: string;
  note: string;
  tone?: "positive" | "warning";
};

const targetStock: TargetStock = {
  code: "9432",
  name: "日本電信電話",
  market: "東証プライム",
  currency: "JPY",
  sector: "情報・通信業",
  close: "163円",
};

const simulationInputs: SimulationInput[] = [
  {
    label: "購入価格",
    value: "163",
    suffix: "円",
    inputMode: "decimal",
  },
  {
    label: "株数",
    value: "800",
    suffix: "株",
    inputMode: "numeric",
  },
];

const beforeAllocation: AllocationItem[] = [
  { label: "トヨタ自動車", value: "26%", color: "#0f766e" },
  { label: "ソニーグループ", value: "22%", color: "#059669" },
  { label: "日本電信電話", value: "16%", color: "#0284c7" },
  { label: "三菱UFJ", value: "12%", color: "#d97706" },
  { label: "現金", value: "24%", color: "#71717a" },
];

const afterAllocation: AllocationItem[] = [
  { label: "トヨタ自動車", value: "24%", color: "#0f766e" },
  { label: "ソニーグループ", value: "20%", color: "#059669" },
  { label: "日本電信電話", value: "23%", color: "#0284c7" },
  { label: "三菱UFJ", value: "11%", color: "#d97706" },
  { label: "現金", value: "22%", color: "#71717a" },
];

const changeMetrics: ChangeMetric[] = [
  {
    label: "購入金額",
    before: "0円",
    after: "130,400円",
    note: "入力値をもとにした静的サンプルです。",
  },
  {
    label: "現金残高",
    before: "331,000円",
    after: "200,600円",
    note: "買付後も現金を残す想定です。",
    tone: "positive",
  },
  {
    label: "上位2銘柄",
    before: "48%",
    after: "44%",
    note: "集中度を少し下げる見込みです。",
    tone: "positive",
  },
  {
    label: "情報・通信業",
    before: "16%",
    after: "23%",
    note: "不足していた業種比率を補います。",
  },
];

export function SimulationPage() {
  const [visibleAllocation, setVisibleAllocation] = useState<"before" | "after">("after");
  const allocationItems = visibleAllocation === "before" ? beforeAllocation : afterAllocation;

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
              購入価格と株数を入力し、構成比や現金残高の変化を確認します。今は静的なシミュレーション表示です。
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
          <InfoRow label="基準通貨" value="JPY" />
          <InfoRow label="計算方式" value="静的サンプル" />
          <InfoRow label="更新日" value="2026年4月17日" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section className="flex flex-col gap-4" aria-labelledby="simulation-target-heading">
          <SectionHeader
            description="購入候補として確認する銘柄です。"
            title="対象銘柄"
            titleId="simulation-target-heading"
          />

          <Link
            className="flex min-h-56 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 text-zinc-950 transition hover:border-teal-700"
            to={`/stocks/${targetStock.code}`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-normal">{targetStock.name}</h2>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700">
                  {targetStock.code}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{targetStock.sector}</p>
            </div>

            <div className="grid gap-2">
              <InfoRow label="市場" value={targetStock.market} />
              <InfoRow label="通貨" value={targetStock.currency} />
              <InfoRow label="終値" value={targetStock.close} />
            </div>
          </Link>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="simulation-input-heading">
          <SectionHeader
            description="実計算は後続 Slice で接続します。"
            title="入力フォーム"
            titleId="simulation-input-heading"
          />

          <form className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {simulationInputs.map((input) => (
                <label className="flex min-w-0 flex-col gap-2" key={input.label}>
                  <span className="text-sm font-medium text-zinc-700">{input.label}</span>
                  <div className="flex min-h-12 overflow-hidden rounded-md border border-zinc-300 bg-white focus-within:border-teal-700">
                    <input
                      className="min-w-0 flex-1 px-3 text-base text-zinc-950 outline-none"
                      defaultValue={input.value}
                      inputMode={input.inputMode}
                      type="text"
                    />
                    <span className="flex min-w-14 items-center justify-center border-l border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-600">
                      {input.suffix}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-3">
              <InputSummary label="購入金額" value="130,400円" />
              <InputSummary label="現金残高" value="200,600円" />
              <InputSummary label="対象構成比" value="23%" />
            </div>
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
            <button
              className={
                visibleAllocation === "before"
                  ? "min-h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white"
                  : "min-h-10 rounded-md px-4 text-sm font-medium text-zinc-700 transition hover:text-teal-700"
              }
              onClick={() => setVisibleAllocation("before")}
              type="button"
            >
              Before
            </button>
            <button
              className={
                visibleAllocation === "after"
                  ? "min-h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white"
                  : "min-h-10 rounded-md px-4 text-sm font-medium text-zinc-700 transition hover:text-teal-700"
              }
              onClick={() => setVisibleAllocation("after")}
              type="button"
            >
              After
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="flex min-h-[30rem] flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex flex-1 items-center justify-center py-4">
              <div
                aria-label={`${visibleAllocation === "before" ? "購入前" : "購入後"}の構成比ダミー円グラフ`}
                className="grid size-56 place-items-center rounded-full sm:size-64"
                style={{
                  background:
                    visibleAllocation === "before"
                      ? "conic-gradient(#0f766e 0deg 94deg, #059669 94deg 173deg, #0284c7 173deg 230deg, #d97706 230deg 274deg, #71717a 274deg 360deg)"
                      : "conic-gradient(#0f766e 0deg 86deg, #059669 86deg 158deg, #0284c7 158deg 241deg, #d97706 241deg 281deg, #71717a 281deg 360deg)",
                }}
              >
                <div className="grid size-32 place-items-center rounded-full bg-white text-center shadow-sm sm:size-36">
                  <div>
                    <p className="text-sm font-medium text-zinc-600">
                      {visibleAllocation === "before" ? "購入前" : "購入後"}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
                      {visibleAllocation === "before" ? "82%" : "78%"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">株式比率</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {allocationItems.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item.label}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-sm font-medium text-zinc-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-zinc-950">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

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
            日本電信電話を追加すると、現金を残しながら情報・通信業の比率を補えます。上位2銘柄への集中は下がる想定ですが、買付後の現金比率が下がるため、次の候補を急いで重ねない前提で確認します。
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
              この内容で候補に残す
            </h2>
            <p className="text-sm leading-6 text-zinc-700">
              保存処理は後続 Slice で接続します。今は導線確認用です。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="flex min-h-12 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 transition hover:border-teal-700 hover:text-teal-700"
              to={`/stocks/${targetStock.code}`}
            >
              銘柄詳細
            </Link>
            <button
              className="min-h-12 rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700"
              type="button"
            >
              候補に残す
            </button>
          </div>
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

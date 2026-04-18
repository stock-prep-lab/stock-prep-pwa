import { Link } from "react-router-dom";

type SummaryMetric = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning";
};

type ImprovementItem = {
  label: string;
  value: string;
  description: string;
  tone: "neutral" | "positive" | "warning";
};

type ProposalMetric = {
  label: string;
  value: string;
};

type RebalanceProposal = {
  rank: number;
  code: string;
  name: string;
  market: string;
  sector: string;
  currency: string;
  improvementScore: string;
  purchaseAmount: string;
  reason: string;
  metrics: ProposalMetric[];
};

type ComparisonItem = {
  label: string;
  before: string;
  after: string;
  beforeWidth: string;
  afterWidth: string;
  note: string;
};

const summaryMetrics: SummaryMetric[] = [
  {
    label: "総評価額",
    value: "1,842,000円",
    note: "現金込み",
  },
  {
    label: "現金余力",
    value: "331,000円",
    note: "現金比率 18%",
    tone: "positive",
  },
  {
    label: "上位集中度",
    value: "48%",
    note: "上位2銘柄",
    tone: "warning",
  },
  {
    label: "改善余地",
    value: "中",
    note: "候補追加で集中度を緩和",
  },
];

const improvementItems: ImprovementItem[] = [
  {
    label: "集中度緩和",
    value: "-6pt",
    description: "上位2銘柄の比率を下げ、値動きの偏りを抑える想定です。",
    tone: "positive",
  },
  {
    label: "現金活用",
    value: "220,000円",
    description: "現金を残しつつ、候補銘柄を段階的に追加する余地があります。",
    tone: "neutral",
  },
  {
    label: "業種分散",
    value: "改善",
    description: "電気機器の偏りを抑え、通信と卸売の比率を補います。",
    tone: "positive",
  },
  {
    label: "注意点",
    value: "買い急ぎ注意",
    description: "候補は高値圏に近いため、購入価格はシミュレーションで確認します。",
    tone: "warning",
  },
];

const proposals: RebalanceProposal[] = [
  {
    rank: 1,
    code: "9432",
    name: "日本電信電話",
    market: "東証プライム",
    sector: "情報・通信業",
    currency: "JPY",
    improvementScore: "86",
    purchaseAmount: "130,000円",
    reason: "保有比率が低く、現金を使っても上位集中度を上げにくい候補です。",
    metrics: [
      { label: "集中度", value: "-4pt" },
      { label: "現金残", value: "201,000円" },
      { label: "構成比", value: "23%" },
    ],
  },
  {
    rank: 2,
    code: "8058",
    name: "三菱商事",
    market: "東証プライム",
    sector: "卸売業",
    currency: "JPY",
    improvementScore: "79",
    purchaseAmount: "160,000円",
    reason: "既存の大型銘柄と値動きの重なりが小さく、業種分散に寄与します。",
    metrics: [
      { label: "集中度", value: "-3pt" },
      { label: "現金残", value: "171,000円" },
      { label: "構成比", value: "18%" },
    ],
  },
  {
    rank: 3,
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    sector: "輸送用機器",
    currency: "JPY",
    improvementScore: "68",
    purchaseAmount: "96,000円",
    reason: "トレンドは強い一方、最大保有銘柄のため追加額は控えめにします。",
    metrics: [
      { label: "集中度", value: "+1pt" },
      { label: "現金残", value: "235,000円" },
      { label: "構成比", value: "28%" },
    ],
  },
];

const comparisonItems: ComparisonItem[] = [
  {
    label: "上位2銘柄",
    before: "48%",
    after: "42%",
    beforeWidth: "w-[48%]",
    afterWidth: "w-[42%]",
    note: "最大保有への依存を少し抑えます。",
  },
  {
    label: "現金比率",
    before: "18%",
    after: "11%",
    beforeWidth: "w-[18%]",
    afterWidth: "w-[11%]",
    note: "買付後も余力を残します。",
  },
  {
    label: "情報・通信業",
    before: "16%",
    after: "23%",
    beforeWidth: "w-[16%]",
    afterWidth: "w-[23%]",
    note: "不足している比率を補います。",
  },
];

export function RebalancePage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-teal-700">リバランス提案</p>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">次の一手を比べる</h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-700">
              現在の保有に対して、集中度緩和と現金活用の観点で候補を確認します。今は静的な提案を表示しています。
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4">
          <InfoRow label="基準通貨" value="JPY" />
          <InfoRow label="提案日" value="2026年4月17日" />
          <InfoRow label="評価方式" value="静的サンプル" />
        </div>
      </div>

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
          description="本物の改善計算は後続 Slice で接続します。"
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
            description="現金を使う場合のダミー候補です。"
            title="提案ランキング"
            titleId="proposal-ranking-heading"
          />

          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="hidden grid-cols-[4rem_1fr_7rem_9rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 lg:grid">
              <span>順位</span>
              <span>候補</span>
              <span>改善度</span>
              <span>想定買付</span>
            </div>

            <div className="divide-y divide-zinc-200">
              {proposals.map((proposal) => (
                <ProposalRow key={proposal.code} proposal={proposal} />
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="comparison-heading">
          <SectionHeader
            description="1位候補を追加した場合の見え方です。"
            title="比較エリア"
            titleId="comparison-heading"
          />

          <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
            <div className="rounded-md bg-teal-50 p-4">
              <p className="text-sm font-medium text-teal-700">選択中</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-zinc-950">
                9432 日本電信電話
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                130,000円を追加する前提で、集中度と現金比率の変化を確認します。
              </p>
            </div>

            <div className="grid gap-4">
              {comparisonItems.map((item) => (
                <ComparisonBar item={item} key={item.label} />
              ))}
            </div>
          </div>
        </section>
      </div>

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
            to="/simulation"
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
  return (
    <Link
      className="grid gap-4 p-4 text-zinc-950 transition hover:bg-zinc-50 lg:grid-cols-[4rem_1fr_7rem_9rem] lg:items-center"
      to={`/stocks/${proposal.code}`}
    >
      <p className="w-fit rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-700">
        No. {proposal.rank}
      </p>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold tracking-normal">{proposal.name}</h3>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {proposal.code}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {proposal.sector} / {proposal.market} / {proposal.currency}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{proposal.reason}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:max-w-xl">
          {proposal.metrics.map((metric) => (
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
          {proposal.purchaseAmount}
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
          <div className={`h-3 rounded-full bg-zinc-500 ${item.beforeWidth}`} />
        </div>
        <div className="h-3 rounded-full bg-zinc-100">
          <div className={`h-3 rounded-full bg-teal-700 ${item.afterWidth}`} />
        </div>
      </div>
      <p className="text-sm leading-6 text-zinc-700">{item.note}</p>
    </div>
  );
}

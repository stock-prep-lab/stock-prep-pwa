import { Link } from "react-router-dom";

type PortfolioMetric = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning";
};

type AllocationItem = {
  label: string;
  value: string;
  colorClass: string;
};

type ConcentrationItem = {
  label: string;
  value: string;
  description: string;
  tone: "neutral" | "warning";
};

type Holding = {
  code: string;
  name: string;
  sector: string;
  quantity: string;
  averagePrice: string;
  currentPrice: string;
  marketValue: string;
  allocation: string;
  unrealizedProfit: string;
  profitRate: string;
  trend: "up" | "down";
};

const portfolioMetrics: PortfolioMetric[] = [
  {
    label: "総評価額",
    value: "1,842,000円",
    note: "現金込み",
  },
  {
    label: "含み損益",
    value: "+126,400円",
    note: "+7.4%",
    tone: "positive",
  },
  {
    label: "現金",
    value: "331,000円",
    note: "現金比率 18%",
  },
  {
    label: "上位集中度",
    value: "48%",
    note: "上位2銘柄",
    tone: "warning",
  },
];

const allocationItems: AllocationItem[] = [
  {
    label: "トヨタ自動車",
    value: "26%",
    colorClass: "bg-teal-700",
  },
  {
    label: "ソニーグループ",
    value: "22%",
    colorClass: "bg-emerald-600",
  },
  {
    label: "日本電信電話",
    value: "16%",
    colorClass: "bg-sky-600",
  },
  {
    label: "三菱UFJ",
    value: "12%",
    colorClass: "bg-amber-600",
  },
  {
    label: "現金",
    value: "24%",
    colorClass: "bg-zinc-500",
  },
];

const concentrationItems: ConcentrationItem[] = [
  {
    label: "現金余力",
    value: "331,000円",
    description: "次の購入候補を検討できる余力です。",
    tone: "neutral",
  },
  {
    label: "業種偏り",
    value: "電気機器 34%",
    description: "同じテーマの銘柄がやや重なっています。",
    tone: "warning",
  },
  {
    label: "最大保有",
    value: "7203 トヨタ自動車",
    description: "単一銘柄の比率は 26% です。",
    tone: "neutral",
  },
];

const holdings: Holding[] = [
  {
    code: "7203",
    name: "トヨタ自動車",
    sector: "輸送用機器",
    quantity: "200株",
    averagePrice: "2,840円",
    currentPrice: "3,218円",
    marketValue: "643,600円",
    allocation: "26%",
    unrealizedProfit: "+75,600円",
    profitRate: "+13.3%",
    trend: "up",
  },
  {
    code: "6758",
    name: "ソニーグループ",
    sector: "電気機器",
    quantity: "30株",
    averagePrice: "12,900円",
    currentPrice: "14,240円",
    marketValue: "427,200円",
    allocation: "22%",
    unrealizedProfit: "+40,200円",
    profitRate: "+10.4%",
    trend: "up",
  },
  {
    code: "9432",
    name: "日本電信電話",
    sector: "情報・通信業",
    quantity: "1,200株",
    averagePrice: "151円",
    currentPrice: "163円",
    marketValue: "195,600円",
    allocation: "16%",
    unrealizedProfit: "+14,400円",
    profitRate: "+7.9%",
    trend: "up",
  },
  {
    code: "8306",
    name: "三菱UFJフィナンシャル・グループ",
    sector: "銀行業",
    quantity: "100株",
    averagePrice: "1,420円",
    currentPrice: "1,386円",
    marketValue: "138,600円",
    allocation: "12%",
    unrealizedProfit: "-3,400円",
    profitRate: "-2.4%",
    trend: "down",
  },
];

export function PortfolioPage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">ポートフォリオ</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">保有状況</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            現在の評価額、構成比、保有銘柄を確認します。今は静的な保有データを表示しています。
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="portfolio-summary-heading">
        <SectionHeader
          description="現金を含めたざっくりした資産状況です。"
          title="資産サマリー"
          titleId="portfolio-summary-heading"
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {portfolioMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <section className="flex flex-col gap-4" aria-labelledby="allocation-heading">
          <SectionHeader
            description="銘柄別と現金込みの構成比イメージです。"
            title="構成比円グラフ"
            titleId="allocation-heading"
          />

          <div className="flex min-h-[28rem] flex-col justify-between rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex flex-1 items-center justify-center py-4">
              <div
                aria-label="ポートフォリオ構成比ダミー円グラフ"
                className="grid size-56 place-items-center rounded-full sm:size-64"
                style={{
                  background:
                    "conic-gradient(#0f766e 0deg 94deg, #059669 94deg 173deg, #0284c7 173deg 230deg, #d97706 230deg 274deg, #71717a 274deg 360deg)",
                }}
              >
                <div className="grid size-32 place-items-center rounded-full bg-white text-center shadow-sm sm:size-36">
                  <div>
                    <p className="text-sm font-medium text-zinc-600">株式比率</p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">82%</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">現金 18%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {allocationItems.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item.label}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`size-3 rounded-sm ${item.colorClass}`} />
                    <span className="truncate text-sm font-medium text-zinc-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-zinc-950">{item.value}</span>
                </div>
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
            {holdings.map((holding) => (
              <HoldingRow holding={holding} key={holding.code} />
            ))}
          </div>
        </div>
      </section>

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

function HoldingRow({ holding }: { holding: Holding }) {
  return (
    <Link
      className="grid gap-4 p-4 text-zinc-950 transition hover:bg-zinc-50 lg:grid-cols-[1fr_9rem_9rem_8rem_7rem] lg:items-center"
      to={`/stocks/${holding.code}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold tracking-normal">{holding.name}</h3>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {holding.code}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">{holding.sector}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-950">{holding.quantity}</p>
        <p className="mt-1 text-sm text-zinc-600">取得 {holding.averagePrice}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-950">{holding.marketValue}</p>
        <p className="mt-1 text-sm text-zinc-600">現在 {holding.currentPrice}</p>
      </div>

      <div>
        <p
          className={
            holding.trend === "up"
              ? "text-sm font-semibold text-emerald-700"
              : "text-sm font-semibold text-rose-700"
          }
        >
          {holding.unrealizedProfit}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{holding.profitRate}</p>
      </div>

      <p className="w-fit rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-700">
        {holding.allocation}
      </p>
    </Link>
  );
}

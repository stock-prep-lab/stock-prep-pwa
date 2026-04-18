import { Link } from "react-router-dom";

type ScreeningCondition = {
  label: string;
  value: string;
  status: "適用中" | "確認";
};

type ScreeningMetric = {
  label: string;
  value: string;
};

type ScreeningCandidate = {
  rank: number;
  code: string;
  name: string;
  market: string;
  sector: string;
  score: number;
  changeRate: string;
  reason: string;
  metrics: ScreeningMetric[];
};

const conditions: ScreeningCondition[] = [
  {
    label: "25MA",
    value: "株価が25日線より上",
    status: "適用中",
  },
  {
    label: "75MA",
    value: "株価が75日線より上",
    status: "適用中",
  },
  {
    label: "25MA傾き",
    value: "上向き",
    status: "適用中",
  },
  {
    label: "高値接近率",
    value: "直近高値から8%以内",
    status: "確認",
  },
  {
    label: "出来高倍率",
    value: "20日平均の1.4倍以上",
    status: "確認",
  },
  {
    label: "流動性",
    value: "売買代金10億円以上",
    status: "適用中",
  },
];

const candidates: ScreeningCandidate[] = [
  {
    rank: 1,
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    sector: "輸送用機器",
    score: 91,
    changeRate: "+2.8%",
    reason: "25日線を上回り、出来高を伴って直近高値に接近しています。",
    metrics: [
      { label: "12-1M", value: "+18.4%" },
      { label: "6-1M", value: "+9.2%" },
      { label: "高値接近", value: "96%" },
    ],
  },
  {
    rank: 2,
    code: "6758",
    name: "ソニーグループ",
    market: "東証プライム",
    sector: "電気機器",
    score: 87,
    changeRate: "+1.9%",
    reason: "75日線の上で推移し、モメンタムと流動性の両方が安定しています。",
    metrics: [
      { label: "12-1M", value: "+14.6%" },
      { label: "6-1M", value: "+7.8%" },
      { label: "高値接近", value: "93%" },
    ],
  },
  {
    rank: 3,
    code: "8035",
    name: "東京エレクトロン",
    market: "東証プライム",
    sector: "電気機器",
    score: 84,
    changeRate: "+1.4%",
    reason: "25日線が上向きに戻り、半導体関連の中で相対的に強い形です。",
    metrics: [
      { label: "12-1M", value: "+12.1%" },
      { label: "6-1M", value: "+6.5%" },
      { label: "高値接近", value: "90%" },
    ],
  },
  {
    rank: 4,
    code: "8058",
    name: "三菱商事",
    market: "東証プライム",
    sector: "卸売業",
    score: 79,
    changeRate: "+0.7%",
    reason: "流動性条件を満たしつつ、上昇トレンドの押し目候補として残っています。",
    metrics: [
      { label: "12-1M", value: "+10.8%" },
      { label: "6-1M", value: "+5.4%" },
      { label: "高値接近", value: "88%" },
    ],
  },
];

export function ScreeningPage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">スクリーニング</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">候補を絞り込む</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            条件に合う銘柄を確認します。今は静的な条件と候補一覧を表示しています。
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
            description="モメンタム、高値接近率、流動性をもとにしたダミー候補です。"
            title="候補一覧"
            titleId="screening-results-heading"
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[28rem]">
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700">並び替え</span>
              <select
                className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-teal-700"
                defaultValue="momentum"
              >
                <option value="momentum">モメンタム順</option>
                <option value="near-high">高値接近率順</option>
                <option value="volume">出来高倍率順</option>
              </select>
            </label>

            <div className="flex min-h-12 items-center rounded-md border border-zinc-200 bg-white px-4 sm:self-end">
              <p className="text-sm font-medium text-zinc-700">
                表示 <span className="text-zinc-950">{candidates.length}</span> 件
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="hidden grid-cols-[4rem_1fr_7rem_8rem_7rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 lg:grid">
            <span>順位</span>
            <span>銘柄</span>
            <span>スコア</span>
            <span>市場</span>
            <span>前日比</span>
          </div>

          <div className="divide-y divide-zinc-200">
            {candidates.map((candidate) => (
              <CandidateRow candidate={candidate} key={candidate.code} />
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

function CandidateRow({ candidate }: { candidate: ScreeningCandidate }) {
  return (
    <Link
      className="grid gap-4 p-4 text-zinc-950 transition hover:bg-zinc-50 lg:grid-cols-[4rem_1fr_7rem_8rem_7rem] lg:items-center"
      to={`/stocks/${candidate.code}`}
    >
      <p className="w-fit rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-700">
        No. {candidate.rank}
      </p>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-semibold tracking-normal">{candidate.name}</h3>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {candidate.code}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {candidate.sector} / {candidate.market}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{candidate.reason}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:max-w-xl">
          {candidate.metrics.map((metric) => (
            <div className="rounded-md bg-zinc-50 px-3 py-2" key={metric.label}>
              <p className="text-xs font-medium text-zinc-500">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm font-semibold text-zinc-950">Score {candidate.score}</p>
      <p className="text-sm text-zinc-700">{candidate.market}</p>
      <p
        className={
          candidate.changeRate.startsWith("+")
            ? "text-sm font-semibold text-emerald-700"
            : "text-sm font-semibold text-amber-700"
        }
      >
        {candidate.changeRate}
      </p>
    </Link>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PaginationControls } from "../components/PaginationControls";
import { UserSymbolBadges } from "../components/UserSymbolBadges";
import { WatchToggleButton } from "../components/WatchToggleButton";
import { buildStockDetailHref } from "../data/stockDetailHref";
import {
  filterSearchCatalog,
  formatRegionLabel,
  loadSearchCatalog,
  type SearchCatalogItem,
  type SearchRegionFilter,
} from "../data/searchCatalog";
import { subscribeToStockPrepDataChanged } from "../data/dataSyncEvents";
import { formatPriceNumber } from "../data/priceFormat";
import {
  addWatchSymbol,
  loadUserSymbolsSnapshotFromIndexedDb,
  removeWatchSymbol,
  type UserSymbolListItem,
} from "../data/userSymbolsData";
import { subscribeToUserSymbolsChanged } from "../data/userSymbolsEvents";

type SearchPageState =
  | {
      status: "loading";
    }
  | {
      datasetVersion: string | null;
      holdingSymbolIds: string[];
      items: SearchCatalogItem[];
      latestSummaryStatus: "ready" | "unavailable";
      recentSymbols: UserSymbolListItem[];
      status: "ready";
      watchSymbolIds: string[];
      watchlist: UserSymbolListItem[];
    }
  | {
      message: string;
      status: "error";
    };

const regionFilters: Array<{ label: string; value: SearchRegionFilter }> = [
  { label: "すべて", value: "ALL" },
  { label: formatRegionLabel("JP"), value: "JP" },
  { label: formatRegionLabel("US"), value: "US" },
  { label: formatRegionLabel("HK"), value: "HK" },
];
const userSymbolPageSize = 5;

export function SearchPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<SearchRegionFilter>("ALL");
  const [state, setState] = useState<SearchPageState>({ status: "loading" });
  const [recentPage, setRecentPage] = useState(1);
  const [watchlistPage, setWatchlistPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!cancelled) {
        setState((current) => (current.status === "ready" ? current : { status: "loading" }));
      }

      try {
        const [result, userSymbols] = await Promise.all([
          loadSearchCatalog(),
          loadUserSymbolsSnapshotFromIndexedDb(),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          datasetVersion: result.datasetVersion,
          holdingSymbolIds: userSymbols.holdingSymbolIds,
          items: result.items,
          latestSummaryStatus: result.latestSummaryStatus,
          recentSymbols: userSymbols.recentSymbols,
          status: "ready",
          watchSymbolIds: userSymbols.watchSymbolIds,
          watchlist: userSymbols.watchlist,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          message: error instanceof Error ? error.message : "検索データを読み込めませんでした。",
          status: "error",
        });
      }
    };

    void load();
    const unsubscribeData = subscribeToStockPrepDataChanged(() => {
      void load();
    });
    const unsubscribeUserSymbols = subscribeToUserSymbolsChanged(() => {
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribeData();
      unsubscribeUserSymbols();
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }

    return filterSearchCatalog(state.items, {
      query,
      region: regionFilter,
    });
  }, [query, regionFilter, state]);

  const recentSymbols = state.status === "ready" ? state.recentSymbols : [];
  const watchlist = state.status === "ready" ? state.watchlist : [];
  const holdingSymbolIds = useMemo(
    () => new Set(state.status === "ready" ? state.holdingSymbolIds : []),
    [state],
  );
  const watchSymbolIds = useMemo(
    () => new Set(state.status === "ready" ? state.watchSymbolIds : []),
    [state],
  );
  const recentTotalPages = getTotalPages(recentSymbols.length);
  const watchlistTotalPages = getTotalPages(watchlist.length);
  const visibleRecentSymbols = paginateItems(recentSymbols, recentPage);
  const visibleWatchlist = paginateItems(watchlist, watchlistPage);

  useEffect(() => {
    setRecentPage((current) => clampPage(current, recentSymbols.length));
  }, [recentSymbols.length]);

  useEffect(() => {
    setWatchlistPage((current) => clampPage(current, watchlist.length));
  }, [watchlist.length]);

  async function handleToggleWatch(symbolId: string, isWatched: boolean) {
    try {
      if (isWatched) {
        await removeWatchSymbol(symbolId);
        return;
      }

      await addWatchSymbol(symbolId);
    } catch (error) {
      console.error("Failed to toggle watch symbol from search page.", error);
      window.alert(error instanceof Error ? error.message : "ウォッチ銘柄を更新できませんでした。");
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-teal-700">銘柄検索</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">検索</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            取り込み済みの軽量データから、銘柄コードや銘柄名の一部で候補を探します。
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draftQuery);
        }}
      >
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">市場</span>
          <select
            className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-teal-700"
            onChange={(event) => {
              setRegionFilter(event.target.value as SearchRegionFilter);
            }}
            value={regionFilter}
          >
            {regionFilters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">検索キーワード</span>
          <input
            className="min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-700"
            inputMode="search"
            onChange={(event) => {
              setDraftQuery(event.target.value);
            }}
            placeholder="銘柄名またはコード"
            type="search"
            value={draftQuery}
          />
        </label>

        <button
          className="min-h-12 rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-teal-700 lg:self-end"
          type="submit"
        >
          検索
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col gap-4" aria-labelledby="recent-stocks-heading">
          <SectionHeader
            description="銘柄詳細を開いた順に、直近の確認銘柄を表示します。"
            title="最近見た銘柄"
            titleId="recent-stocks-heading"
          />
          {recentSymbols.length === 0 ? (
            <EmptyPanel message="まだ最近見た銘柄はありません。" />
          ) : (
            <>
              <div className="grid gap-3">
                {visibleRecentSymbols.map((item) => (
                  <UserSymbolLinkCard
                    item={item}
                    key={item.symbol.id}
                    markAsRecent
                    onToggleWatch={() => {
                      void handleToggleWatch(item.symbol.id, item.isWatched);
                    }}
                  />
                ))}
              </div>
              <PaginationControls
                currentPage={recentPage}
                onPageChange={setRecentPage}
                pageSize={userSymbolPageSize}
                totalItems={recentSymbols.length}
                totalPages={recentTotalPages}
              />
            </>
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="watch-stocks-heading">
          <SectionHeader
            description="スマホと PC で同期するウォッチ銘柄をここから確認します。"
            title="ウォッチ銘柄"
            titleId="watch-stocks-heading"
          />
          {watchlist.length === 0 ? (
            <EmptyPanel message="まだウォッチ銘柄はありません。" />
          ) : (
            <>
              <div className="grid gap-3">
                {visibleWatchlist.map((item) => (
                  <UserSymbolLinkCard
                    item={item}
                    key={item.symbol.id}
                    onToggleWatch={() => {
                      void handleToggleWatch(item.symbol.id, item.isWatched);
                    }}
                  />
                ))}
              </div>
              <PaginationControls
                currentPage={watchlistPage}
                onPageChange={setWatchlistPage}
                pageSize={userSymbolPageSize}
                totalItems={watchlist.length}
                totalPages={watchlistTotalPages}
              />
            </>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="search-results-heading">
        <SectionHeader
          description="株式と ETF を対象に、銘柄コード / 銘柄名 / 市場 / 通貨 / 商品種別で絞り込みます。"
          title="検索結果"
          titleId="search-results-heading"
        />

        {state.status === "loading" ? (
          <NoticePanel tone="neutral">
            取り込み済みデータを読み込んでいます。
          </NoticePanel>
        ) : state.status === "error" ? (
          <NoticePanel tone="error">{state.message}</NoticePanel>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
              <p>{filteredItems.length.toLocaleString("ja-JP")}件を表示しています。</p>
              <p className="whitespace-nowrap">
                dataset version: {state.datasetVersion ?? "-"}
              </p>
            </div>

            {state.latestSummaryStatus === "unavailable" ? (
              <NoticePanel tone="warning">
                最新サマリーの取得に失敗したため、銘柄キャッシュのみを表示しています。
              </NoticePanel>
            ) : null}

            {filteredItems.length === 0 ? (
              <EmptyPanel
                message={
                  state.items.length === 0
                    ? "まだ検索対象の銘柄キャッシュがありません。取り込みと同期の完了後に結果を表示します。"
                    : "条件に一致する銘柄は見つかりませんでした。"
                }
              />
            ) : (
              <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
                <div className="hidden grid-cols-[minmax(0,1.4fr)_5rem_5rem_5rem_7rem] border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 md:grid">
                  <span>銘柄</span>
                  <span className="whitespace-nowrap text-left">市場</span>
                  <span className="whitespace-nowrap text-left">通貨</span>
                  <span className="whitespace-nowrap text-left">種別</span>
                  <span className="whitespace-nowrap text-right">終値</span>
                </div>

                <div className="divide-y divide-zinc-200">
                  {filteredItems.map((item) => (
                    <div
                      className="grid gap-3 p-4 text-zinc-950 transition hover:bg-zinc-50 md:grid-cols-[minmax(0,1.4fr)_5rem_5rem_5rem_7rem] md:items-center"
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="text-lg font-semibold tracking-normal hover:text-teal-700"
                            to={buildStockDetailHref({
                              code: item.code,
                              region: item.region,
                            })}
                          >
                            {item.name}
                          </Link>
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                            {item.code}
                          </span>
                          <UserSymbolBadges
                            isHeld={holdingSymbolIds.has(item.id)}
                            isWatched={watchSymbolIds.has(item.id)}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-600 md:hidden">
                          <span>{item.marketLabel}</span>
                          <span>{item.currency}</span>
                          <span>{item.securityTypeLabel}</span>
                        </div>
                        {item.statusReason ? (
                          <p className="mt-2 text-sm leading-6 text-zinc-700">{item.statusReason}</p>
                        ) : item.lastCloseDate ? (
                          <p className="mt-2 text-sm leading-6 text-zinc-700">
                            終値日付: {item.lastCloseDate}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <WatchToggleButton
                            isWatched={watchSymbolIds.has(item.id)}
                            onClick={() => {
                              void handleToggleWatch(item.id, watchSymbolIds.has(item.id));
                            }}
                          />
                          <Link
                            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-teal-700 hover:text-teal-700"
                            to={buildStockDetailHref({
                              code: item.code,
                              region: item.region,
                            })}
                          >
                            詳細を見る
                          </Link>
                        </div>
                      </div>

                      <p className="hidden text-left text-sm text-zinc-700 md:block">
                        {item.marketLabel}
                      </p>
                      <p className="hidden text-left text-sm text-zinc-700 md:block">
                        {item.currency}
                      </p>
                      <p className="hidden text-left text-sm text-zinc-700 md:block">
                        {item.securityTypeLabel}
                      </p>
                      <p className="text-sm font-semibold text-zinc-950 md:text-right">
                        {formatLastClose(item)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}

function UserSymbolLinkCard({
  item,
  markAsRecent = false,
  onToggleWatch,
}: {
  item: UserSymbolListItem;
  markAsRecent?: boolean;
  onToggleWatch: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="text-lg font-semibold tracking-normal text-zinc-950 hover:text-teal-700"
              to={buildStockDetailHref({
                code: item.symbol.code,
                region: item.symbol.region,
              })}
            >
              {item.symbol.name}
            </Link>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
              {item.symbol.code}
            </span>
          </div>
          <UserSymbolBadges
            isHeld={item.isHeld}
            isWatched={item.isWatched}
            wasRecentlyViewed={markAsRecent}
          />
          <p className="text-sm text-zinc-600">
            {formatRegionLabel(item.symbol.region)} / {item.symbol.currency}
          </p>
        </div>

        <WatchToggleButton isWatched={item.isWatched} onClick={onToggleWatch} />
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
      <h2 className="text-2xl font-semibold tracking-normal" id={titleId}>
        {title}
      </h2>
      <p className="max-w-2xl text-sm leading-6 text-zinc-700">{description}</p>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-5 text-sm leading-6 text-zinc-600">
      {message}
    </div>
  );
}

function NoticePanel({
  children,
  tone,
}: {
  children: string;
  tone: "error" | "neutral" | "warning";
}) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-white text-zinc-700";

  return <div className={`rounded-md border px-4 py-3 text-sm leading-6 ${className}`}>{children}</div>;
}

function formatLastClose(item: SearchCatalogItem): string {
  if (item.lastClose === null) {
    return "-";
  }

  return formatPriceNumber(item.lastClose, item.currency);
}

function paginateItems(items: UserSymbolListItem[], page: number): UserSymbolListItem[] {
  const start = (page - 1) * userSymbolPageSize;
  return items.slice(start, start + userSymbolPageSize);
}

function getTotalPages(totalItems: number): number {
  return Math.max(1, Math.ceil(totalItems / userSymbolPageSize));
}

function clampPage(page: number, totalItems: number): number {
  return Math.min(page, getTotalPages(totalItems));
}

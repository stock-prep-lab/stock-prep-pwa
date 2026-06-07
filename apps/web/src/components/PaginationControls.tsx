type PaginationControlsProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function PaginationControls({
  currentPage,
  onPageChange,
  pageSize,
  totalItems,
  totalPages,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
      <p>
        {totalItems.toLocaleString("ja-JP")}件中 {pageRangeLabel(currentPage, pageSize, totalItems)}
      </p>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-teal-700 hover:text-teal-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
          disabled={currentPage <= 1}
          onClick={() => {
            onPageChange(currentPage - 1);
          }}
          type="button"
        >
          前へ
        </button>
        <span className="min-w-14 text-center text-zinc-700">
          {currentPage} / {totalPages}
        </span>
        <button
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:border-teal-700 hover:text-teal-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
          disabled={currentPage >= totalPages}
          onClick={() => {
            onPageChange(currentPage + 1);
          }}
          type="button"
        >
          次へ
        </button>
      </div>
    </div>
  );
}

function pageRangeLabel(currentPage: number, pageSize: number, totalItems: number): string {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return `${start}-${end}`;
}

export function WatchToggleButton({
  disabled = false,
  isWatched,
  onClick,
}: {
  disabled?: boolean;
  isWatched: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex min-h-10 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition",
        disabled
          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
          : isWatched
            ? "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-500"
            : "border-zinc-300 bg-white text-zinc-700 hover:border-teal-700 hover:text-teal-700",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {isWatched ? "ウォッチ解除" : "ウォッチ追加"}
    </button>
  );
}

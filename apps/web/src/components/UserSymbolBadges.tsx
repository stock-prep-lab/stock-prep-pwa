export function UserSymbolBadges({
  isHeld = false,
  isWatched = false,
  wasRecentlyViewed = false,
}: {
  isHeld?: boolean;
  isWatched?: boolean;
  wasRecentlyViewed?: boolean;
}) {
  const badges = [
    isHeld
      ? {
          className: "bg-emerald-50 text-emerald-700",
          label: "保有中",
        }
      : null,
    isWatched
      ? {
          className: "bg-amber-50 text-amber-700",
          label: "ウォッチ中",
        }
      : null,
    wasRecentlyViewed
      ? {
          className: "bg-sky-50 text-sky-700",
          label: "最近見た",
        }
      : null,
  ].filter((badge) => badge !== null);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.map((badge) => (
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ${badge.className}`}
          key={badge.label}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

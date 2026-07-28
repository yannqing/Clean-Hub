import { Button } from "@cleanhub/ui";

/**
 * Shared list pagination control.
 *
 * Renders a "Previous / Next" footer with an optional "X–Y of Z" count. It is
 * a pure presentational component: the owning list keeps `offset` (and the
 * data fetch) in its own state and reports every page change through
 * `onOffsetChange`.
 *
 * Two operating modes are supported because the backend list endpoints do not
 * all return a `total`:
 *
 * - `total` provided  → shows "X–Y of Z" and disables Next past the last page.
 * - `total` omitted   → hides the count and uses the `currentPageCount` heuristic
 *                       (disable Next when the current page is short).
 *
 * Labels are passed in by the caller so this component stays free of i18n
 * coupling (SaaS lists pass `m.common.previousPage/nextPage`, tenant lists pass
 * their own copy while they are not yet fully internationalized).
 */
type PaginationProps = {
  /** Zero-based index of the first item on the current page. */
  offset: number;
  /** Page size used to advance/retreat and to compute the "Y" bound. */
  pageSize: number;
  /** Total item count when known. Omit for lists whose API returns a bare array. */
  total?: number;
  /** Number of items actually returned for the current page. */
  currentPageCount: number;
  /** Explicit next-page availability when the caller fetched one look-ahead row. */
  hasNext?: boolean;
  /** Called with the next offset to load. */
  onOffsetChange: (nextOffset: number) => void;
  previousLabel: string;
  nextLabel: string;
  formatCountLabel?: (range: {
    from: number;
    to: number;
    total: number;
  }) => string;
};

export function Pagination({
  offset,
  pageSize,
  total,
  currentPageCount,
  hasNext: hasNextOverride,
  onOffsetChange,
  previousLabel,
  nextLabel,
  formatCountLabel,
}: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext =
    hasNextOverride ??
    (total != null ? offset + pageSize < total : currentPageCount >= pageSize);

  // When the page is empty (e.g. zero results) the "1–0 of 0" range is noise,
  // so prefer "0 of 0" in that case.
  const rangeStart = total != null && total > 0 ? offset + 1 : 0;
  const rangeEnd =
    total != null ? Math.min(offset + pageSize, total) : currentPageCount;

  return (
    <div className="flex items-center justify-between border-t px-5 py-3">
      {total != null ? (
        <span className="text-sm text-muted-foreground">
          {formatCountLabel
            ? formatCountLabel({
                from: rangeStart,
                to: rangeEnd,
                total,
              })
            : `${rangeStart}–${rangeEnd} of ${total}`}
        </span>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button
          disabled={!hasPrev}
          onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
          type="button"
          variant="outline"
        >
          {previousLabel}
        </Button>
        <Button
          disabled={!hasNext}
          onClick={() => onOffsetChange(offset + pageSize)}
          type="button"
          variant="outline"
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

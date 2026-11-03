export type PaginationEntry = number | "...";

/**
 * Keep pagination controls compact enough for a tablet while preserving the
 * first, last, current, and adjacent pages.
 */
export function buildPaginationWindow(
  current: number,
  total: number,
): PaginationEntry[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const page = Math.min(Math.max(current, 1), total);
  const pages: PaginationEntry[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);

  if (start > 2) {
    pages.push("...");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }

  if (end < total - 1) {
    pages.push("...");
  }

  pages.push(total);
  return pages;
}

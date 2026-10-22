/**
 * Shared optimistic-concurrency helpers.
 *
 * Branches, services, and prices all surface stale-write conflicts as an HTTP
 * 409 with a `*_VERSION_CONFLICT` error code (e.g. `BRANCH_VERSION_CONFLICT`,
 * `SERVICE_VERSION_CONFLICT`, `PRICE_VERSION_CONFLICT`). This helper lets a
 * list/detail view detect that case from an action result and swap in a
 * dedicated "refresh and try again" message instead of the raw error text.
 */

type VersionConflictLike = {
  code?: string;
  status?: number;
};

export function isVersionConflict(result: VersionConflictLike): boolean {
  if (result.status === 409) {
    return true;
  }

  return Boolean(result.code?.endsWith("_VERSION_CONFLICT"));
}

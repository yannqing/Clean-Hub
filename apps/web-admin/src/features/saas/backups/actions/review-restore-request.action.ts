import { webAdminApi } from "@/lib/api-client";

import type {
  ReviewAction,
  ReviewRestoreRequestActionResult,
  ReviewRestoreRequestInput,
} from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to review restore request.";
}

/** Persist a restore review transition through the SaaS API. */
export async function reviewRestoreRequestAction(
  restoreRequestId: string,
  action: ReviewAction,
  input?: ReviewRestoreRequestInput,
): Promise<ReviewRestoreRequestActionResult> {
  try {
    let result: Awaited<
      ReturnType<typeof webAdminApi.saas.restoreRequests.approve>
    >;

    switch (action) {
      case "approve":
        result = await webAdminApi.saas.restoreRequests.approve(
          restoreRequestId,
          input,
        );
        break;
      case "reject":
        result = await webAdminApi.saas.restoreRequests.reject(
          restoreRequestId,
          input,
        );
        break;
      case "complete":
        result = await webAdminApi.saas.restoreRequests.complete(
          restoreRequestId,
          input,
        );
        break;
      case "cancel":
        result = await webAdminApi.saas.restoreRequests.cancel(
          restoreRequestId,
          input,
        );
        break;
      default: {
        // Exhaustiveness guard — a new ReviewAction must be handled here.
        const exhaustive: never = action;
        throw new Error(`Unknown review action: ${String(exhaustive)}`);
      }
    }

    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

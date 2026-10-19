import { getDb, type Database } from "@cleanhub/db";

import { findBranchById } from "../../tenant/branches/branches.repository.js";
import {
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
import { MediaService } from "../../media/media.service.js";
import { findPosBranding, findPosMerchantName } from "./pos.repository.js";
import type { PosBranchMeInput, PosBranchSummary } from "./pos.types.js";

/**
 * Resolve the current POS user's branch.
 *
 * A POS terminal is single-store, so the cashier's first assigned branch is
 * treated as the active branch. Returns null when the user has no branch
 * assignment yet (frontend degrades gracefully).
 */
export async function getMyPosBranch(
  input: PosBranchMeInput,
  db: Database = getDb(),
): Promise<PosBranchSummary | null> {
  const tenantId = requirePosTenantId(input.authContext);
  const branchId = resolvePosBranchScope(input.authContext)?.[0];

  if (!branchId) {
    return null;
  }

  const [branch, merchantName, branding] = await Promise.all([
    findBranchById(db, {
      tenantId,
      branchId,
    }),
    findPosMerchantName(db, tenantId),
    findPosBranding(db, tenantId),
  ]);

  let posLogoUrl: string | null = null;
  if (branding?.posLogoObjectKey) {
    try {
      posLogoUrl = (
        await new MediaService().createDownloadLinkForKnownCommittedObject({
          tenantId,
          objectKey: branding.posLogoObjectKey,
        })
      ).downloadUrl;
    } catch {
      /* Branding never blocks checkout if storage is unavailable. */
    }
  }
  return branch
    ? {
        ...branch,
        merchantName: merchantName ?? "",
        posDisplayName: branding?.posDisplayName ?? merchantName ?? "",
        posLogoObjectKey: branding?.posLogoObjectKey ?? null,
        posLogoUrl,
      }
    : null;
}

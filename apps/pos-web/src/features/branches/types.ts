import type { PosBranchSummary } from "@cleanhub/api-client";

/**
 * Re-export the shared POS branch DTO so feature modules import from here,
 * keeping the API client as the single source of truth for wire shapes.
 */
export type { PosBranchSummary };

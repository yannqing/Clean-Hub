import type { AuditCategoryCode } from "@/i18n/messages-types";

/**
 * Categories the SaaS audit feed can contain.
 *
 * Codes only: the wording comes from `common.auditCategories`, which both
 * consoles share. Carrying English labels here as well left a second copy that
 * nothing rendered and that no translation check covered.
 *
 * Deliberately narrower than the full category list -- a SaaS-scoped feed never
 * holds the tenant or POS categories, so offering them would be a filter that
 * can only ever return nothing.
 */
export const auditEventCategoryOptions = [
  { value: "auth" },
  { value: "saas_platform" },
  { value: "saas_tenant" },
  { value: "saas_user" },
] as const satisfies ReadonlyArray<{ value: AuditCategoryCode }>;

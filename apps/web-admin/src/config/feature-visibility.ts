import type { SaasAdminRole } from "@cleanhub/domain";

import { webAdminRoutes } from "./routes";

/**
 * Toggle sidebar entries. Set a flag to `true` when the route is ready to show.
 *
 * - `backups`: backup worker and real dump/restore flow
 * - `saasConfigFeatureFlags` / `saasConfigLocalization`: per-tenant config lives
 *   under tenant settings; these /saas/config/* pages are placeholders only
 */
export const webAdminNavFeatureVisibility = {
  backups: false,
  saasConfigFeatureFlags: false,
  saasConfigLocalization: false,
} as const;

export type WebAdminNavFeature = keyof typeof webAdminNavFeatureVisibility;

export function isNavFeatureVisible(feature: WebAdminNavFeature): boolean {
  return webAdminNavFeatureVisibility[feature];
}

const hiddenNavHrefsByFeature: Record<WebAdminNavFeature, readonly string[]> = {
  backups: [
    webAdminRoutes.saas.system.backups,
    webAdminRoutes.tenant.system.backups,
  ],
  saasConfigFeatureFlags: [webAdminRoutes.saas.config.featureFlags],
  saasConfigLocalization: [webAdminRoutes.saas.config.localization],
};

function getHiddenNavHrefs(): Set<string> {
  const hrefs: string[] = [];

  for (const feature of Object.keys(
    webAdminNavFeatureVisibility,
  ) as WebAdminNavFeature[]) {
    if (!webAdminNavFeatureVisibility[feature]) {
      hrefs.push(...hiddenNavHrefsByFeature[feature]);
    }
  }

  return new Set(hrefs);
}

/**
 * SaaS routes the API restricts to `super_admin`.
 *
 * These mirror `requireSuperAdmin` / `requireSaasTenantsAccess(["super_admin"])`
 * on the backend. Support staff can still read logs, security events and
 * feedback, so only the genuinely privileged destinations are listed. Showing a
 * link the API will refuse is not a security hole — the backend is the
 * authority — but it invites a support user to fill in a form only to be
 * rejected on submit.
 */
const SUPER_ADMIN_ONLY_HREFS: readonly string[] = [
  webAdminRoutes.saas.config.tenants,
  webAdminRoutes.saas.users,
  webAdminRoutes.saas.config.platformSettings,
];

/** True when the role may open the given SaaS route. */
export function canSaasRoleAccessHref(
  role: SaasAdminRole | null,
  href: string,
): boolean {
  if (!SUPER_ADMIN_ONLY_HREFS.includes(href)) {
    return true;
  }

  return role === "super_admin";
}

export function filterSidebarSections<
  T extends { items: readonly { href: string }[] },
>(sections: readonly T[], role: SaasAdminRole | null = null): T[] {
  const hidden = getHiddenNavHrefs();

  return sections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !hidden.has(item.href) && canSaasRoleAccessHref(role, item.href),
    ),
  })) as T[];
}

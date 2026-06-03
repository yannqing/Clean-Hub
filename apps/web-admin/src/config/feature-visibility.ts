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

export function filterSidebarSections<
  T extends { items: readonly { href: string }[] },
>(sections: readonly T[]): T[] {
  const hidden = getHiddenNavHrefs();

  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !hidden.has(item.href)),
  })) as T[];
}

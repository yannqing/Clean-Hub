import { getDatabaseScope, getDb, platformTaxTemplates, runWithSystemDatabaseContext, type Database } from "@cleanhub/db";

function normalizedCountry(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z]/g, "");
}

/** Legacy country names remain readable; new records store the template's ISO code. */
export async function findPlatformTaxTemplateForCountry(db: Database, country: string) {
  const normalized = normalizedCountry(country);
  // Global templates are SaaS-owned under RLS. Read only this configuration
  // through a separate system scope; all tenant data stays in the caller scope.
  // SaaS transactions keep using their supplied db so unpublished changes are visible.
  const templates = getDatabaseScope()?.kind === "tenant"
    ? await runWithSystemDatabaseContext(() => getDb().select().from(platformTaxTemplates))
    : await db.select().from(platformTaxTemplates);
  return templates.find((template) =>
    normalizedCountry(template.countryCode) === normalized ||
    normalizedCountry(template.name) === normalized ||
    normalizedCountry(template.name.split(/\s[-–—]\s/, 1)[0] ?? "") === normalized ||
    (template.countryCode === "CI" && normalized === "ivorycoast")
  ) ?? null;
}

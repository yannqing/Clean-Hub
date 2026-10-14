import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { createId } from "@cleanhub/id";

import type { PlatformTaxTemplateRate } from "../schema/platform/settings.js";

/** Demo bootstrap only: business code still obtains every tax value from PostgreSQL. */
export async function seedDemoTaxTemplates(client: PoolClient, file: string): Promise<void> {
  const templates = JSON.parse(readFileSync(file, "utf8")) as Array<{
    countryCode: string; name: string; currencyCode: string; taxLabel: string;
    exemptionNotes: string | null; taxEnabled: boolean; pricesIncludeTax: boolean;
    rates: PlatformTaxTemplateRate[];
  }>;
  if (!Array.isArray(templates) || templates.length === 0) throw new Error("Demo tax configuration file is empty.");
  for (const template of templates) {
    if (!/^[A-Z]{2}$/.test(template.countryCode) || !/^[A-Z]{3}$/.test(template.currencyCode) ||
        !template.name?.trim() || !template.taxLabel?.trim() || !Array.isArray(template.rates) ||
        template.rates.filter((rate) => rate.isDefault).length !== 1) {
      throw new Error(`Incomplete demo tax template: ${template.countryCode}`);
    }
    // Preserve any usable template edited by SaaS. Only replace unconfigured,
    // unused legacy placeholders; seed is not a tax-template publishing API.
    await client.query(`
      INSERT INTO platform_tax_templates
        (id, country_code, name, currency_code, tax_label, exemption_notes, tax_enabled, prices_include_tax, rates)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT (country_code) DO UPDATE SET
        name = EXCLUDED.name, currency_code = EXCLUDED.currency_code,
        tax_label = EXCLUDED.tax_label, exemption_notes = EXCLUDED.exemption_notes,
        tax_enabled = EXCLUDED.tax_enabled, prices_include_tax = EXCLUDED.prices_include_tax,
        rates = EXCLUDED.rates, updated_at = now(), version = platform_tax_templates.version + 1
      WHERE (platform_tax_templates.currency_code IS NULL OR nullif(trim(platform_tax_templates.tax_label),'') IS NULL)
        AND NOT EXISTS (SELECT 1 FROM pos_channel_settings p WHERE p.tax_template_country_code = EXCLUDED.country_code)
    `, [createId(), template.countryCode, template.name, template.currencyCode, template.taxLabel,
      template.exemptionNotes, template.taxEnabled, template.pricesIncludeTax, JSON.stringify(template.rates)]);
  }
  // SQL applies the DB values, using ULIDs generated through @cleanhub/id.
  await client.query("CREATE TEMP TABLE demo_tax_class_ids (tenant_id varchar(26), rate_key text, id varchar(26)) ON COMMIT DROP");
  const { rows } = await client.query<{ tenant_id: string; rates: PlatformTaxTemplateRate[] }>(`
    SELECT t.id AS tenant_id, p.rates FROM tenants t JOIN platform_tax_templates p ON p.country_code = t.country
    WHERE t.id IN ('01KRERJN800000000000000001','01KRERJN810000000000000002','01KRERJN820000000000000003')
  `);
  for (const row of rows) {
    for (const [index, rate] of row.rates.entries()) {
      await client.query("INSERT INTO demo_tax_class_ids VALUES ($1,$2,$3)", [row.tenant_id, rate.key ?? `legacy-${index}`, createId()]);
    }
  }
}

import type { platformTaxTemplates } from "@cleanhub/db";
import { taxRateToScale } from "@cleanhub/domain/tax";

type TaxTemplate = typeof platformTaxTemplates.$inferSelect;

/** Legacy rows without fiscal metadata must be completed by SaaS before use. */
export function isReadyTaxTemplate(template: TaxTemplate): boolean {
  const fraction = /^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/;
  if (!/^[A-Z]{2}$/.test(template.countryCode) || !template.name.trim() ||
      !template.currencyCode || !/^[A-Z]{3}$/.test(template.currencyCode) ||
      !template.taxLabel?.trim() || template.rates.length === 0 ||
      template.rates.filter((rate) => rate.isDefault).length !== 1) return false;
  const names = new Set<string>();
  const keys = new Set<string>();
  for (const rate of template.rates) {
    const name = rate.name.trim().toLowerCase();
    if (!name || names.has(name) || !fraction.test(rate.rate)) return false;
    names.add(name);
    if (rate.key) {
      if (keys.has(rate.key)) return false;
      keys.add(rate.key);
    }
    if (rate.components) {
      if (!rate.isDefault || rate.components.length === 0 ||
          rate.components.some((part) => !part.name.trim() || !fraction.test(part.rate)) ||
          rate.components.reduce((sum, part) => sum + taxRateToScale(part.rate), BigInt(0)) !== taxRateToScale(rate.rate)) {
        return false;
      }
    }
  }
  return true;
}

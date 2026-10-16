import { and, eq, isNull } from "drizzle-orm";

import { taxRates, type Database } from "@cleanhub/db";

/**
 * Why a tax rate cannot be put on a service or product, or null if it can.
 *
 * The composite foreign key already stops a rate from another tenant, but it
 * cannot see soft deletion or archiving. An archived rate is one the owner
 * has retired: items that already carry it keep it, but it is not offered
 * for new assignments, so re-saving an item with its current archived rate
 * is allowed while moving another item onto it is not.
 */
export type TaxRateAssignmentProblem = "not_found" | "archived";

export async function checkTaxRateAssignment(
  db: Database,
  input: {
    tenantId: string;
    taxRateId: string | null | undefined;
    currentTaxRateId?: string | null;
  },
): Promise<TaxRateAssignmentProblem | null> {
  if (!input.taxRateId || input.taxRateId === input.currentTaxRateId) {
    return null;
  }
  const [rate] = await db
    .select({ archivedAt: taxRates.archivedAt })
    .from(taxRates)
    .where(
      and(
        eq(taxRates.tenantId, input.tenantId),
        eq(taxRates.id, input.taxRateId),
        isNull(taxRates.deletedAt),
      ),
    )
    .limit(1);
  if (!rate) return "not_found";
  return rate.archivedAt ? "archived" : null;
}

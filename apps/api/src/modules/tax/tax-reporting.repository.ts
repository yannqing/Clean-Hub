import { orders, type Database } from "@cleanhub/db";
import { and, sql, type SQL } from "drizzle-orm";

export type TaxComponentTotal = {
  name: string;
  rate: string;
  taxableAmount: string;
  taxAmount: string;
};

/** Aggregate immutable order snapshots, never today's template values. */
export async function sumOrderTaxComponents(
  db: Database,
  filters: SQL[],
): Promise<TaxComponentTotal[]> {
  const component = sql`jsonb_array_elements(coalesce(${orders.taxComponentsSnapshot}, '[]'::jsonb)) AS tax_component(value)`;
  const name = sql<string>`tax_component.value->>'name'`;
  const rate = sql<string>`tax_component.value->>'rate'`;
  const rows = await db.select({
    name,
    rate,
    taxableAmount: sql<string>`sum((tax_component.value->>'taxableAmount')::numeric)::text`,
    taxAmount: sql<string>`sum((tax_component.value->>'taxAmount')::numeric)::text`,
  }).from(orders).innerJoin(component, sql`true`).where(and(...filters))
    .groupBy(name, rate).orderBy(name, rate);
  return rows;
}

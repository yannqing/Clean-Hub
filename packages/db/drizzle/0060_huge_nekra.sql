-- Exclude soft-deleted rows from the payment idempotency key so it matches the
-- lookup, which filters on `deleted_at is null`. Without the predicate a
-- soft-deleted transaction permanently burns its key: the insert conflicts,
-- the lookup that should return the original finds nothing, and the retry
-- throws instead of replying idempotently.
--
-- NOTE: drizzle-kit also wanted to drop tenants_deleted_by_users_id_fk and
-- tenants_offboarded_by_users_id_fk here. Those were removed deliberately:
-- `tenants.deletedBy`/`offboardedBy` omit `.references()` in TypeScript to
-- avoid a circular table type (TS7022, see the note in schema/tenancy/tenants.ts)
-- and the foreign keys are enforced in the migrations instead. Dropping them
-- would silently remove real referential integrity.
DROP INDEX "payment_transactions_tenant_idempotency_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_tenant_idempotency_key_unique" ON "payment_transactions" USING btree ("tenant_id","idempotency_key") WHERE "payment_transactions"."deleted_at" is null;

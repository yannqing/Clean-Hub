DROP INDEX "customer_accounts_tenant_phone_unique";--> statement-breakpoint
DROP INDEX "customer_accounts_tenant_email_unique";--> statement-breakpoint
CREATE INDEX "customer_accounts_tenant_phone_idx" ON "customer_accounts" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_accounts_tenant_email_unique" ON "customer_accounts" USING btree ("tenant_id","email") WHERE "customer_accounts"."deleted_at" is null;
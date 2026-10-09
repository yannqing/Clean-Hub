CREATE TYPE "public"."payment_integration_provider" AS ENUM('wave', 'orange_money');--> statement-breakpoint
CREATE TYPE "public"."payment_integration_verification_status" AS ENUM('verified', 'invalid');--> statement-breakpoint
CREATE TABLE "tenant_payment_integrations" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"provider" "payment_integration_provider" NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"encryption_key_version" integer DEFAULT 1 NOT NULL,
	"credential_hint" varchar(160) NOT NULL,
	"verification_status" "payment_integration_verification_status" DEFAULT 'verified' NOT NULL,
	"pos_enabled" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"last_verification_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_payment_integrations" ADD CONSTRAINT "tenant_payment_integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_payment_integrations" ADD CONSTRAINT "tenant_payment_integrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_payment_integrations" ADD CONSTRAINT "tenant_payment_integrations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_payment_integrations_tenant_provider_unique" ON "tenant_payment_integrations" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "tenant_payment_integrations_enabled_idx" ON "tenant_payment_integrations" USING btree ("tenant_id","pos_enabled","verification_status");--> statement-breakpoint
CREATE INDEX "tenant_payment_integrations_updated_by_idx" ON "tenant_payment_integrations" USING btree ("updated_by");--> statement-breakpoint
ALTER TABLE public.tenant_payment_integrations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.tenant_payment_integrations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.tenant_payment_integrations
AS PERMISSIVE
FOR ALL
TO PUBLIC
USING (
  public.cleanhub_rls_bypass_enabled()
  OR tenant_id::text = public.cleanhub_current_tenant_id()
)
WITH CHECK (
  public.cleanhub_rls_bypass_enabled()
  OR tenant_id::text = public.cleanhub_current_tenant_id()
);

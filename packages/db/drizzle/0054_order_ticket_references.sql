CREATE TABLE "order_ticket_references" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(26) NOT NULL,
	"branch_id" varchar(26) NOT NULL,
	"order_id" varchar(26) NOT NULL,
	"ticket_id" varchar(26) NOT NULL,
	"ticket_no_snapshot" varchar(32),
	"ticket_remark_snapshot" text,
	"priority_snapshot" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"expected_pickup_at_snapshot" timestamp with time zone,
	"assistant_name_snapshot" varchar(120),
	"item_count" integer DEFAULT 0 NOT NULL,
	"item_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(26),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26)
);
--> statement-breakpoint
ALTER TABLE "order_ticket_references" ADD CONSTRAINT "order_ticket_references_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ticket_references" ADD CONSTRAINT "order_ticket_references_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ticket_references" ADD CONSTRAINT "order_ticket_references_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ticket_references" ADD CONSTRAINT "order_ticket_references_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ticket_references" ADD CONSTRAINT "order_ticket_references_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ticket_references" ADD CONSTRAINT "order_ticket_references_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_ticket_references_order_ticket_unique" ON "order_ticket_references" USING btree ("order_id","ticket_id");--> statement-breakpoint
CREATE INDEX "order_ticket_references_order_id_idx" ON "order_ticket_references" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_ticket_references_ticket_id_idx" ON "order_ticket_references" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "order_ticket_references_tenant_id_idx" ON "order_ticket_references" USING btree ("tenant_id");--> statement-breakpoint

ALTER TABLE public.order_ticket_references ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.order_ticket_references FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation
ON public.order_ticket_references
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
);--> statement-breakpoint

-- Backfill fulfilment context for orders that already settle ticket items.
-- Existing orders keep their history instead of showing an empty panel; the
-- ticket is read as it stands today because the checkout-time value was
-- never recorded.
INSERT INTO public.order_ticket_references (
  id,
  tenant_id,
  branch_id,
  order_id,
  ticket_id,
  ticket_no_snapshot,
  ticket_remark_snapshot,
  priority_snapshot,
  expected_pickup_at_snapshot,
  assistant_name_snapshot,
  item_count,
  item_amount,
  created_at,
  created_by,
  updated_at,
  updated_by
)
SELECT
  substr(replace(gen_random_uuid()::text, '-', ''), 1, 26),
  grouped.tenant_id,
  grouped.branch_id,
  grouped.order_id,
  grouped.ticket_id,
  t.ticket_no,
  t.remark,
  t.priority,
  t.expected_pickup_at,
  p.display_name,
  grouped.item_count,
  grouped.item_amount,
  now(),
  NULL,
  now(),
  NULL
FROM (
  SELECT
    oi.tenant_id,
    oi.branch_id,
    oi.order_id,
    oi.ticket_id,
    count(*)::int AS item_count,
    coalesce(sum(oi.line_amount), 0) AS item_amount
  FROM public.order_items oi
  WHERE oi.ticket_id IS NOT NULL
    AND oi.deleted_at IS NULL
  GROUP BY oi.tenant_id, oi.branch_id, oi.order_id, oi.ticket_id
) AS grouped
JOIN public.service_tickets t ON t.id = grouped.ticket_id
LEFT JOIN public.user_profiles p ON p.user_id = t.assistant_id
ON CONFLICT (order_id, ticket_id) DO NOTHING;

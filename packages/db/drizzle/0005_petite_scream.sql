WITH ranked_active_refunds AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, order_id
      ORDER BY created_at ASC, id ASC
    ) AS active_rank
  FROM refund_requests
  WHERE deleted_at IS NULL
    AND status IN ('pending', 'processing')
)
UPDATE refund_requests
SET
  status = 'rejected',
  rejection_reason = 'Superseded while enforcing one active refund request per order.',
  updated_at = now(),
  version = version + 1
WHERE id IN (
  SELECT id FROM ranked_active_refunds WHERE active_rank > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_active_order_unique" ON "refund_requests" USING btree ("tenant_id","order_id") WHERE "refund_requests"."deleted_at" is null and "refund_requests"."status" in ('pending', 'processing');

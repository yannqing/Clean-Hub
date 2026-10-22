-- Demo discount definitions for local development.
-- IDs are deterministic ULIDs so the seed remains idempotent.

WITH active_tenants AS (
  SELECT
    tenant.id AS tenant_id,
    left(tenant.id, 10) || upper(substr(md5('discount:welcome10:' || tenant.id), 1, 16)) AS code_discount_id,
    left(tenant.id, 10) || upper(substr(md5('discount:auto5:' || tenant.id), 1, 16)) AS automatic_discount_id
  FROM tenants AS tenant
  WHERE tenant.status = 'active'
    AND tenant.deleted_at IS NULL
)
INSERT INTO discounts (
  id,
  tenant_id,
  title,
  method,
  type,
  enabled,
  value_type,
  value_amount,
  eligibility,
  minimum_requirement,
  starts_at,
  all_branches,
  pos_enabled,
  customer_mobile_enabled,
  delivery_enabled,
  country_scope,
  country_codes,
  tags
)
SELECT
  code_discount_id,
  tenant_id,
  'WELCOME10',
  'code'::discount_method,
  'amount_off_order'::discount_type,
  true,
  'percentage'::discount_value_type,
  10,
  'all_customers'::discount_eligibility,
  'none'::discount_minimum_requirement,
  '2026-01-01 00:00:00+00'::timestamptz,
  true,
  true,
  false,
  false,
  'all'::discount_country_scope,
  '[]'::jsonb,
  '["welcome", "seed"]'::jsonb
FROM active_tenants
UNION ALL
SELECT
  automatic_discount_id,
  tenant_id,
  'Automatic 5% off',
  'automatic'::discount_method,
  'amount_off_order'::discount_type,
  true,
  'percentage'::discount_value_type,
  5,
  'all_customers'::discount_eligibility,
  'none'::discount_minimum_requirement,
  '2026-01-01 00:00:00+00'::timestamptz,
  true,
  true,
  false,
  false,
  'all'::discount_country_scope,
  '[]'::jsonb,
  '["automatic", "seed"]'::jsonb
FROM active_tenants
ON CONFLICT (id) DO NOTHING;

WITH active_tenants AS (
  SELECT
    tenant.id AS tenant_id,
    left(tenant.id, 10) || upper(substr(md5('discount:welcome10:' || tenant.id), 1, 16)) AS discount_id,
    left(tenant.id, 10) || upper(substr(md5('discount-code:welcome10:' || tenant.id), 1, 16)) AS code_id
  FROM tenants AS tenant
  WHERE tenant.status = 'active'
    AND tenant.deleted_at IS NULL
)
INSERT INTO discount_codes (
  id,
  tenant_id,
  discount_id,
  code
)
SELECT
  code_id,
  tenant_id,
  discount_id,
  'WELCOME10'
FROM active_tenants
ON CONFLICT (id) DO NOTHING;

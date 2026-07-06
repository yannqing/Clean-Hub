-- Mobile MVP end-to-end seed data.
--
-- Safe to run repeatedly. This complements the normal demo seed with the
-- credentials and driver assignment required by real `/mobile/*` E2E checks.
--
-- Credentials:
--   Customer account: 13800000001 / zhang.wei@example.com, password 123456
--   Driver:           mobile.driver1@cleanhub.local, password 123456
--   Owner:            tenant.admin1@cleanhub.local, password 123456

INSERT INTO tenant_settings (
  id,
  tenant_id,
  default_language,
  default_currency,
  timezone,
  pilot_status
)
VALUES (
  '01SEEDM0B0TST00000000001',
  '01KRERJN800000000000000001',
  'fr',
  'CNY',
  'Asia/Shanghai',
  'pilot'
)
ON CONFLICT (tenant_id) DO UPDATE SET
  default_language = EXCLUDED.default_language,
  default_currency = EXCLUDED.default_currency,
  timezone = EXCLUDED.timezone,
  pilot_status = EXCLUDED.pilot_status,
  updated_at = now();

INSERT INTO tenant_feature_flags (
  id,
  tenant_id,
  laundry_enabled,
  car_wash_enabled,
  retail_products_enabled,
  delivery_enabled,
  notifications_enabled
)
VALUES (
  '01SEEDM0B0TFF00000000001',
  '01KRERJN800000000000000001',
  true,
  true,
  true,
  true,
  true
)
ON CONFLICT (tenant_id) DO UPDATE SET
  laundry_enabled = EXCLUDED.laundry_enabled,
  car_wash_enabled = EXCLUDED.car_wash_enabled,
  retail_products_enabled = EXCLUDED.retail_products_enabled,
  delivery_enabled = EXCLUDED.delivery_enabled,
  notifications_enabled = EXCLUDED.notifications_enabled,
  updated_at = now();

-- Password hash = scrypt of "123456", reused from the development user seed.
INSERT INTO customer_credentials (
  id,
  tenant_id,
  customer_account_id,
  password_hash,
  failed_attempts,
  locked_until
)
VALUES (
  '01SEEDM0B0CRD00000000001',
  '01KRERJN800000000000000001',
  '01SEED0100ACC0000000000001',
  'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
  0,
  NULL
)
ON CONFLICT (customer_account_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  password_hash = EXCLUDED.password_hash,
  failed_attempts = 0,
  locked_until = NULL,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO users (
  id,
  tenant_id,
  user_type,
  email,
  normalized_email,
  password_hash,
  pin_hash,
  status
)
VALUES (
  '01SEEDM0B0USR00000000001',
  '01KRERJN800000000000000001',
  'tenant',
  'mobile.driver1@cleanhub.local',
  'mobile.driver1@cleanhub.local',
  'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
  'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  user_type = EXCLUDED.user_type,
  email = EXCLUDED.email,
  normalized_email = EXCLUDED.normalized_email,
  password_hash = EXCLUDED.password_hash,
  pin_hash = EXCLUDED.pin_hash,
  status = EXCLUDED.status,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO user_profiles (
  user_id,
  display_name,
  first_name,
  last_name,
  language,
  timezone
)
VALUES (
  '01SEEDM0B0USR00000000001',
  'Mobile Driver 1',
  'Mobile',
  'Driver 1',
  'fr',
  'Asia/Shanghai'
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  language = EXCLUDED.language,
  timezone = EXCLUDED.timezone,
  updated_at = now();

INSERT INTO user_roles (
  id,
  user_id,
  role_id,
  tenant_id,
  branch_id
)
SELECT
  '01SEEDM0B0URL00000000001',
  '01SEEDM0B0USR00000000001',
  roles.id,
  '01KRERJN800000000000000001',
  '01KRERJN8G0000000000000040'
FROM roles
WHERE
  roles.tenant_id = '01KRERJN800000000000000001'
  AND roles.scope = 'tenant'
  AND roles.code = 'driver'
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  role_id = EXCLUDED.role_id,
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  revoked_at = NULL;

INSERT INTO delivery_tasks (
  id,
  tenant_id,
  branch_id,
  assignee_user_id,
  customer_id,
  order_id,
  ticket_id,
  type,
  status,
  expected_at,
  customer_name,
  customer_phone,
  address,
  notes,
  created_by,
  updated_by
)
VALUES (
  '01SEEDM0B0DLV00000000001',
  '01KRERJN800000000000000001',
  '01KRERJN8G0000000000000040',
  '01SEEDM0B0USR00000000001',
  '01SEED0100CPS0000000000001',
  '01SEED01000RD0000000000002',
  '01SEED0100TKT0000000000001',
  'pickup',
  'pending_dispatch',
  date_trunc('day', now()) + interval '10 hours',
  'Zhang Wei',
  '13800000001',
  '100 Renmin Road, Huangpu District, Shanghai',
  'Mobile E2E seeded task',
  '01SEEDM0B0USR00000000001',
  '01SEEDM0B0USR00000000001'
)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  assignee_user_id = EXCLUDED.assignee_user_id,
  customer_id = EXCLUDED.customer_id,
  order_id = EXCLUDED.order_id,
  ticket_id = EXCLUDED.ticket_id,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  expected_at = EXCLUDED.expected_at,
  customer_name = EXCLUDED.customer_name,
  customer_phone = EXCLUDED.customer_phone,
  address = EXCLUDED.address,
  notes = EXCLUDED.notes,
  exception_reason = NULL,
  started_at = NULL,
  arrived_at = NULL,
  picked_up_at = NULL,
  signed_at = NULL,
  exception_at = NULL,
  deleted_at = NULL,
  updated_by = EXCLUDED.updated_by,
  updated_at = now();

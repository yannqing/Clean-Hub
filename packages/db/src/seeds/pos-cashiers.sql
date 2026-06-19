-- POS cashier seed accounts for in-store staff workflows.
--
-- Belongs to Demo Tenant 1 (CLEAN-001, id 01KRERJN800000000000000001) so they
-- share the terminal binding configured by POS_TENANT_CODE=CLEAN-001.
--
-- Idempotent: safe to run repeatedly via ON CONFLICT ... DO UPDATE.
-- Run after dev-accounts.sql (this file assumes the tenant row exists).
--
-- Credentials (all 4 accounts):
--   Password: 123456   (scrypt$16384$8$1$...)
--   PIN:      1234     (same value as dev-accounts.sql; column is NOT NULL)
--
-- Accounts (tenantCode: CLEAN-001):
--   pos.cashier1@cleanhub.local
--   pos.cashier2@cleanhub.local
--   pos.cashier3@cleanhub.local
--   pos.cashier4@cleanhub.local

-- Reuse the exact scrypt hashes used by dev-accounts.sql so the credentials
-- match the documented "Password: 123456 / PIN: 1234".
--   password_hash = scrypt of "123456"
--   pin_hash      = scrypt of "1234"

-- 1) Cashier role for Demo Tenant 1 (absent from dev-accounts.sql).
INSERT INTO roles (id, tenant_id, scope, code, name, description, status, is_system)
VALUES
  (
    '01KRERJN8F0000000000000030',
    '01KRERJN800000000000000001',
    'tenant',
    'cashier',
    'Cashier',
    'Development POS cashier role for demo tenant 1.',
    'active',
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  scope = EXCLUDED.scope,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  is_system = EXCLUDED.is_system,
  updated_at = now();

-- 1b) A demo branch for Demo Tenant 1 so cashiers are scoped to a real store.
-- The branch id is referenced by user_roles.branch_id below.
INSERT INTO branches (
  id,
  tenant_id,
  name,
  address,
  phone,
  default_language,
  default_currency,
  receipt_name,
  status
)
VALUES
  (
    '01KRERJN8G0000000000000040',
    '01KRERJN800000000000000001',
    'CleanHub 旗舰店',
    '上海市黄浦区南京东路 1 号',
    '+86 21 0000 0000',
    'zh-CN',
    'CNY',
    'CleanHub 旗舰店',
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  default_language = EXCLUDED.default_language,
  default_currency = EXCLUDED.default_currency,
  receipt_name = EXCLUDED.receipt_name,
  status = EXCLUDED.status,
  updated_at = now();

-- 2) Four tenant cashier users bound to Demo Tenant 1.
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
VALUES
  (
    '01KRERJN8F0000000000000031',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier1@cleanhub.local',
    'pos.cashier1@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8F0000000000000032',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier2@cleanhub.local',
    'pos.cashier2@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8F0000000000000033',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier3@cleanhub.local',
    'pos.cashier3@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8F0000000000000034',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier4@cleanhub.local',
    'pos.cashier4@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  user_type = EXCLUDED.user_type,
  email = EXCLUDED.email,
  normalized_email = EXCLUDED.normalized_email,
  password_hash = EXCLUDED.password_hash,
  pin_hash = EXCLUDED.pin_hash,
  status = EXCLUDED.status,
  updated_at = now();

-- 3) Display names for the POS shell profile card.
INSERT INTO user_profiles (user_id, display_name, first_name, last_name, language, timezone)
VALUES
  ('01KRERJN8F0000000000000031', '收银员 01', 'Cashier', '01', 'zh-CN', 'Asia/Shanghai'),
  ('01KRERJN8F0000000000000032', '收银员 02', 'Cashier', '02', 'zh-CN', 'Asia/Shanghai'),
  ('01KRERJN8F0000000000000033', '收银员 03', 'Cashier', '03', 'zh-CN', 'Asia/Shanghai'),
  ('01KRERJN8F0000000000000034', '收银员 04', 'Cashier', '04', 'zh-CN', 'Asia/Shanghai')
ON CONFLICT (user_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  language = EXCLUDED.language,
  timezone = EXCLUDED.timezone,
  updated_at = now();

-- 4) Grant the cashier role to each user, scoped to the demo branch.
INSERT INTO user_roles (id, user_id, role_id, tenant_id, branch_id)
VALUES
  (
    '01KRERJN8F0000000000000035',
    '01KRERJN8F0000000000000031',
    '01KRERJN8F0000000000000030',
    '01KRERJN800000000000000001',
    '01KRERJN8G0000000000000040'
  ),
  (
    '01KRERJN8F0000000000000036',
    '01KRERJN8F0000000000000032',
    '01KRERJN8F0000000000000030',
    '01KRERJN800000000000000001',
    '01KRERJN8G0000000000000040'
  ),
  (
    '01KRERJN8F0000000000000037',
    '01KRERJN8F0000000000000033',
    '01KRERJN8F0000000000000030',
    '01KRERJN800000000000000001',
    '01KRERJN8G0000000000000040'
  ),
  (
    '01KRERJN8F0000000000000038',
    '01KRERJN8F0000000000000034',
    '01KRERJN8F0000000000000030',
    '01KRERJN800000000000000001',
    '01KRERJN8G0000000000000040'
  )
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  role_id = EXCLUDED.role_id,
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  revoked_at = NULL;

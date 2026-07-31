-- POS cashier seed accounts for in-store staff workflows.
--
-- Belongs to Demo Tenant 1 (CLEAN-001, id 01KRERJN800000000000000001) so they
-- belong to tenant CLEAN-001 and sign in only after the current terminal is enrolled.
--
-- Idempotent: safe to run repeatedly via ON CONFLICT ... DO UPDATE.
-- Run after dev-accounts.sql (this file assumes the tenant row exists).
--
-- Credentials:
--   Password: 123456   (scrypt$16384$8$1$...)
--   PINs are unique inside the demo store so PIN-only POS login can identify
--   one cashier without asking for an email:
--     cashier1: 111111
--     cashier2: 222222
--     cashier3: 333333
--     cashier4: 444444
--
-- Accounts (tenantCode: CLEAN-001):
--   pos.cashier1@cleanhub.local
--   pos.cashier2@cleanhub.local
--   pos.cashier3@cleanhub.local
--   pos.cashier4@cleanhub.local

-- Reuse the exact password hash used by dev-accounts.sql while keeping
-- per-cashier PIN hashes unique.
--   password_hash = scrypt of "123456"

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
    'scrypt$16384$8$1$7ugUwkZpcy6LP3VgB0KPsw$5t0vJzCFF9emiEphspE9eyUKiOqhb90uWtPziVLDyaOrN6ZloVmIJ4nmIqhdu0-5qUSyQabA6Rc7AmSSTWYnJg',
    'active'
  ),
  (
    '01KRERJN8F0000000000000032',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier2@cleanhub.local',
    'pos.cashier2@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$pS_-EXvVi_eAbcoazT8WgA$44Hz_hg6WZ2PsaAJerwjZGqQ1WUxYiiKnRV-tE6wfHLxNXSgfsHaUPiPgGx9hWgeTOLUBwbE0vKTkhV3hZ_wTQ',
    'active'
  ),
  (
    '01KRERJN8F0000000000000033',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier3@cleanhub.local',
    'pos.cashier3@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$T2X9vBzDLGgM4-tJ1pbDZQ$b59hH78n4adrWDpfMpv8SEL48Ner__sVYUnEGalzxcura0D-KIQJ5xBAOJk7YFdeNCPMWjdI2I_Wu2gg1X1bIg',
    'active'
  ),
  (
    '01KRERJN8F0000000000000034',
    '01KRERJN800000000000000001',
    'tenant',
    'pos.cashier4@cleanhub.local',
    'pos.cashier4@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$H4ynKAmeCRh3ecwQzj3Pjg$OEoejBuNwZnZKkr8-g42uUb5jioSa-VgHRmlGklmVTeIMsyWwHdr_QYRP9ULHK0OCTThOgAYHhfL6sVoBgavxQ',
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

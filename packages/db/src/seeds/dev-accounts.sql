-- Development seed accounts for local onboarding and shared team testing.
--
-- Consolidated from the previous migration-based seed (0001) plus the PIN
-- backfill (0004). Safe to run repeatedly: every statement is idempotent via
-- ON CONFLICT ... DO UPDATE. Run after `pnpm db:migrate` against a fresh DB.
--
-- Credentials (all accounts):
--   Password: 123456
--   PIN:      1234
--
-- SaaS accounts:
--   saas.admin1@cleanhub.local
--   saas.admin2@cleanhub.local
--   saas.support1@cleanhub.local
--
-- Tenant admin accounts:
--   tenant.admin1@cleanhub.local / tenantCode: CLEAN-001
--   tenant.admin2@cleanhub.local / tenantCode: CLEAN-002
--   tenant.admin3@cleanhub.local / tenantCode: CLEAN-003

INSERT INTO tenants (id, name, pressing_code)
VALUES
  ('01KRERJN800000000000000001', 'CleanHub Demo Tenant 1', 'CLEAN-001'),
  ('01KRERJN810000000000000002', 'CleanHub Demo Tenant 2', 'CLEAN-002'),
  ('01KRERJN820000000000000003', 'CleanHub Demo Tenant 3', 'CLEAN-003')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  pressing_code = EXCLUDED.pressing_code;

INSERT INTO roles (id, tenant_id, scope, code, name, description, status, is_system)
VALUES
  (
    '01KRERJN830000000000000004',
    NULL,
    'saas',
    'super_admin',
    'Super Admin',
    'Development SaaS super administrator role.',
    'active',
    true
  ),
  (
    '01KRERJN840000000000000005',
    NULL,
    'saas',
    'support',
    'Support',
    'Development SaaS support role.',
    'active',
    true
  ),
  (
    '01KRERJN850000000000000006',
    '01KRERJN800000000000000001',
    'tenant',
    'owner',
    'Owner',
    'Development tenant owner role for demo tenant 1.',
    'active',
    true
  ),
  (
    '01KRERJN860000000000000007',
    '01KRERJN810000000000000002',
    'tenant',
    'owner',
    'Owner',
    'Development tenant owner role for demo tenant 2.',
    'active',
    true
  ),
  (
    '01KRERJN870000000000000008',
    '01KRERJN820000000000000003',
    'tenant',
    'owner',
    'Owner',
    'Development tenant owner role for demo tenant 3.',
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

-- Password hash = scrypt of "123456"; pin_hash = scrypt of "1234".
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
    '01KRERJN880000000000000009',
    NULL,
    'saas',
    'saas.admin1@cleanhub.local',
    'saas.admin1@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN890000000000000010',
    NULL,
    'saas',
    'saas.admin2@cleanhub.local',
    'saas.admin2@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8A0000000000000011',
    NULL,
    'saas',
    'saas.support1@cleanhub.local',
    'saas.support1@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8B0000000000000012',
    '01KRERJN800000000000000001',
    'tenant',
    'tenant.admin1@cleanhub.local',
    'tenant.admin1@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8C0000000000000013',
    '01KRERJN810000000000000002',
    'tenant',
    'tenant.admin2@cleanhub.local',
    'tenant.admin2@cleanhub.local',
    'scrypt$16384$8$1$O7xxPy2DQrG9YMNu-u_xog$G7NCynZTZJSR7BIhTSKeS3HZ2j1ndbqocnAiB7KNg6lSnRW3pvuoriUZ6fiIrkL8GDI1E77IoL6zGKf4YHLZjA',
    'scrypt$16384$8$1$1rL2WhD7u7pABXpIKWzgew$-clsYJRVuXDZAK_rVKcEMP787BdWlxOxzbm99_Bf_z2mtXZ60byKXNUTXLVj0ZhdPQsd-zsbM9VyZuyeMczs-g',
    'active'
  ),
  (
    '01KRERJN8D0000000000000014',
    '01KRERJN820000000000000003',
    'tenant',
    'tenant.admin3@cleanhub.local',
    'tenant.admin3@cleanhub.local',
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

INSERT INTO user_profiles (user_id, display_name, first_name, last_name, language, timezone)
VALUES
  ('01KRERJN880000000000000009', 'SaaS Admin 1', 'SaaS', 'Admin 1', 'en', 'Asia/Shanghai'),
  ('01KRERJN890000000000000010', 'SaaS Admin 2', 'SaaS', 'Admin 2', 'en', 'Asia/Shanghai'),
  ('01KRERJN8A0000000000000011', 'SaaS Support 1', 'SaaS', 'Support 1', 'en', 'Asia/Shanghai'),
  ('01KRERJN8B0000000000000012', 'Tenant Admin 1', 'Tenant', 'Admin 1', 'en', 'Asia/Shanghai'),
  ('01KRERJN8C0000000000000013', 'Tenant Admin 2', 'Tenant', 'Admin 2', 'en', 'Asia/Shanghai'),
  ('01KRERJN8D0000000000000014', 'Tenant Admin 3', 'Tenant', 'Admin 3', 'en', 'Asia/Shanghai')
ON CONFLICT (user_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  language = EXCLUDED.language,
  timezone = EXCLUDED.timezone,
  updated_at = now();

INSERT INTO user_roles (id, user_id, role_id, tenant_id, branch_id)
VALUES
  (
    '01KRERJN8E0000000000000015',
    '01KRERJN880000000000000009',
    '01KRERJN830000000000000004',
    NULL,
    NULL
  ),
  (
    '01KRERJN8F0000000000000016',
    '01KRERJN890000000000000010',
    '01KRERJN830000000000000004',
    NULL,
    NULL
  ),
  (
    '01KRERJN8G0000000000000017',
    '01KRERJN8A0000000000000011',
    '01KRERJN840000000000000005',
    NULL,
    NULL
  ),
  (
    '01KRERJN8H0000000000000018',
    '01KRERJN8B0000000000000012',
    '01KRERJN850000000000000006',
    '01KRERJN800000000000000001',
    NULL
  ),
  (
    '01KRERJN8J0000000000000019',
    '01KRERJN8C0000000000000013',
    '01KRERJN860000000000000007',
    '01KRERJN810000000000000002',
    NULL
  ),
  (
    '01KRERJN8K0000000000000020',
    '01KRERJN8D0000000000000014',
    '01KRERJN870000000000000008',
    '01KRERJN820000000000000003',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  role_id = EXCLUDED.role_id,
  tenant_id = EXCLUDED.tenant_id,
  branch_id = EXCLUDED.branch_id,
  revoked_at = NULL;

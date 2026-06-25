-- Mobile MVP RBAC seed.
--
-- Idempotent: safe to run repeatedly via ON CONFLICT ... DO UPDATE / DO NOTHING.
-- Run after dev-accounts.sql so Demo Tenant 1 (CLEAN-001) exists.

INSERT INTO roles (id, tenant_id, scope, code, name, description, status, is_system)
VALUES
  (
    '01KRERJN8M0000000000000050',
    '01KRERJN800000000000000001',
    'tenant',
    'driver',
    'Driver',
    'Development mobile delivery driver role for demo tenant 1.',
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

INSERT INTO permissions (id, scope, code, name, description)
VALUES
  (
    '01KRERJN8M0000000000000051',
    'tenant',
    'mobile.delivery.read',
    'Read mobile delivery tasks',
    'Allows a driver to read mobile delivery tasks assigned to them.'
  ),
  (
    '01KRERJN8M0000000000000052',
    'tenant',
    'mobile.delivery.update_status',
    'Update mobile delivery task status',
    'Allows a driver to advance assigned mobile delivery task status.'
  ),
  (
    '01KRERJN8M0000000000000053',
    'tenant',
    'mobile.delivery.upload_proof',
    'Upload mobile delivery proof',
    'Allows a driver to upload pickup, dropoff, and signature proofs.'
  )
ON CONFLICT (id) DO UPDATE
SET
  scope = EXCLUDED.scope,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
VALUES
  ('01KRERJN8M0000000000000050', '01KRERJN8M0000000000000051'),
  ('01KRERJN8M0000000000000050', '01KRERJN8M0000000000000052'),
  ('01KRERJN8M0000000000000050', '01KRERJN8M0000000000000053')
ON CONFLICT DO NOTHING;

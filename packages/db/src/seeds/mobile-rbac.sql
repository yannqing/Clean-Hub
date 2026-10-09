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
ON CONFLICT (tenant_id, scope, code) DO UPDATE
SET
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
ON CONFLICT (code) DO UPDATE
SET
  scope = EXCLUDED.scope,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT role.tenant_id, role.id, permission.id
FROM roles role
CROSS JOIN permissions permission
WHERE
  role.tenant_id = '01KRERJN800000000000000001'
  AND role.scope = 'tenant'
  AND role.code = 'driver'
  AND permission.code IN (
    'mobile.delivery.read',
    'mobile.delivery.update_status',
    'mobile.delivery.upload_proof'
  )
ON CONFLICT DO NOTHING;

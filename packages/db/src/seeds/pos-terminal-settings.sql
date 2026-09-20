-- POS terminal settings and hardware device seed data for Demo Tenant 1.
--
-- Run AFTER dev-accounts.sql AND pos-cashiers.sql. This file assumes:
--   tenant = 01KRERJN800000000000000001 (CLEAN-001)
--   branch = 01KRERJN8G0000000000000040 (CleanHub 旗舰店)
--   user   = 01KRERJN8F0000000000000031 (cashier1, used as created_by/updated_by)
--
-- Idempotent: every statement uses ON CONFLICT ... DO UPDATE.
-- IDs use the 01SEED01... prefix convention for business data.
--
-- Coverage:
--   hardware_configs (3) — printer, scanner, cash drawer bound to the front POS terminal
--   pos_terminal_settings (2) — two demo POS terminals with different configs
--     and telemetry states (one recently online, one stale with a sync error)

-- ───────────────────────────────────────────────
-- 0) Shared constants for readability
-- ───────────────────────────────────────────────
-- tenant_id : 01KRERJN800000000000000001
-- branch_id : 01KRERJN8G0000000000000040
-- user_id   : 01KRERJN8F0000000000000031 (cashier1)

-- ───────────────────────────────────────────────
-- 1) POS terminal settings
-- ───────────────────────────────────────────────
-- Terminal 1: 前台收银机 — default payment = cash, auto-print on, 5min lock
-- Terminal 2: 后台收银机 — default payment = card, auto-print off, 10min lock
INSERT INTO pos_terminal_settings (
  id, tenant_id, branch_id,
  device_id, label,
  device_type, platform, platform_version, app_version,
  rounding_rule,
  auto_print_receipt, print_copies,
  lock_timeout_seconds,
  status, sync_status, last_seen_at, last_synced_at, last_sync_error,
  created_by, updated_by, version
) VALUES
  (
    '01SEED0100PTS0000000000001',
    '01KRERJN800000000000000001',
    '01KRERJN8G0000000000000040',
    'pos-web-default',
    '前台收银机',
    'desktop',
    'macOS',
    '15',
    '0.1.0',
    'none',
    true,
    1,
    300,
    'active',
    'synced',
    now() - interval '2 minutes',
    now() - interval '3 minutes',
    NULL,
    '01KRERJN8F0000000000000031',
    '01KRERJN8F0000000000000031',
    1
  ),
  (
    '01SEED0100PTS0000000000002',
    '01KRERJN800000000000000001',
    '01KRERJN8G0000000000000040',
    'pos-web-backoffice',
    '后台收银机',
    'tablet',
    'Android',
    '14',
    '0.1.0',
    'round_jiao',
    false,
    2,
    600,
    'active',
    'error',
    now() - interval '30 minutes',
    now() - interval '45 minutes',
    'Demo terminal could not upload its latest offline queue.',
    '01KRERJN8F0000000000000031',
    '01KRERJN8F0000000000000031',
    1
  )
ON CONFLICT (tenant_id, device_id) DO UPDATE SET
  branch_id             = EXCLUDED.branch_id,
  label                 = EXCLUDED.label,
  device_type           = EXCLUDED.device_type,
  platform              = EXCLUDED.platform,
  platform_version      = EXCLUDED.platform_version,
  app_version           = EXCLUDED.app_version,
  rounding_rule         = EXCLUDED.rounding_rule,
  auto_print_receipt    = EXCLUDED.auto_print_receipt,
  print_copies          = EXCLUDED.print_copies,
  lock_timeout_seconds  = EXCLUDED.lock_timeout_seconds,
  status                = EXCLUDED.status,
  sync_status           = EXCLUDED.sync_status,
  last_seen_at           = EXCLUDED.last_seen_at,
  last_synced_at         = EXCLUDED.last_synced_at,
  last_sync_error        = EXCLUDED.last_sync_error,
  updated_by            = EXCLUDED.updated_by,
  updated_at            = now(),
  version               = pos_terminal_settings.version + 1;

-- ───────────────────────────────────────────────
-- 2) POS peripherals for the front terminal
-- ───────────────────────────────────────────────
INSERT INTO hardware_configs (
  id, tenant_id, terminal_id,
  device_type, name, connection_type,
  config, status,
  created_by, updated_by, version
) VALUES
  (
    '01SEED0100DKV0000000000001',
    '01KRERJN800000000000000001',
    '01SEED0100PTS0000000000001',
    'printer',
    '前台小票打印机',
    'network',
    '{"ip": "192.168.1.100", "port": 9100, "paperWidth": 80}',
    'active',
    '01KRERJN8F0000000000000031',
    '01KRERJN8F0000000000000031',
    1
  ),
  (
    '01SEED0100DKV0000000000002',
    '01KRERJN800000000000000001',
    '01SEED0100PTS0000000000001',
    'scanner',
    '前台条码扫描枪',
    'usb',
    '{"mode": "continuous"}',
    'active',
    '01KRERJN8F0000000000000031',
    '01KRERJN8F0000000000000031',
    1
  ),
  (
    '01SEED0100DKV0000000000003',
    '01KRERJN800000000000000001',
    '01SEED0100PTS0000000000001',
    'cash_drawer',
    '前台收银钱箱',
    'usb',
    '{"openCommand": "x1Bx70x00x19xFA"}',
    'active',
    '01KRERJN8F0000000000000031',
    '01KRERJN8F0000000000000031',
    1
  )
ON CONFLICT (id) DO UPDATE SET
  tenant_id       = EXCLUDED.tenant_id,
  terminal_id     = EXCLUDED.terminal_id,
  device_type     = EXCLUDED.device_type,
  name            = EXCLUDED.name,
  connection_type = EXCLUDED.connection_type,
  config          = EXCLUDED.config,
  status          = EXCLUDED.status,
  updated_by      = EXCLUDED.updated_by,
  updated_at      = now(),
  version         = hardware_configs.version + 1;

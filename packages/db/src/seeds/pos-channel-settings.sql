-- Tenant-level POS Channel settings for Demo Tenant 1.
--
-- Run AFTER dev-accounts.sql. This file assumes:
--   tenant = 01KRERJN800000000000000001 (CLEAN-001)
--   owner  = 01KRERJN8B0000000000000012 (tenant.admin1@cleanhub.local)
--
-- Idempotent: safe to run repeatedly via ON CONFLICT ... DO UPDATE.

INSERT INTO pos_channel_settings (
  id,
  tenant_id,
  cash_tracking_enabled,
  require_opening_float,
  require_closing_count,
  require_return_reason,
  recent_cart_retention_hours,
  offline_mode_enabled,
  sync_interval_seconds,
  device_offline_after_seconds,
  default_rounding_rule,
  default_auto_print_receipt,
  default_print_copies,
  default_lock_timeout_seconds,
  created_by,
  updated_by,
  version
)
VALUES (
  '01SEED0100PCS0000000000001',
  '01KRERJN800000000000000001',
  true,
  true,
  true,
  true,
  24,
  true,
  60,
  600,
  'none',
  true,
  1,
  300,
  '01KRERJN8B0000000000000012',
  '01KRERJN8B0000000000000012',
  1
)
ON CONFLICT (tenant_id) DO UPDATE
SET
  cash_tracking_enabled = EXCLUDED.cash_tracking_enabled,
  require_opening_float = EXCLUDED.require_opening_float,
  require_closing_count = EXCLUDED.require_closing_count,
  require_return_reason = EXCLUDED.require_return_reason,
  recent_cart_retention_hours = EXCLUDED.recent_cart_retention_hours,
  offline_mode_enabled = EXCLUDED.offline_mode_enabled,
  sync_interval_seconds = EXCLUDED.sync_interval_seconds,
  device_offline_after_seconds = EXCLUDED.device_offline_after_seconds,
  default_rounding_rule = EXCLUDED.default_rounding_rule,
  default_auto_print_receipt = EXCLUDED.default_auto_print_receipt,
  default_print_copies = EXCLUDED.default_print_copies,
  default_lock_timeout_seconds = EXCLUDED.default_lock_timeout_seconds,
  updated_by = EXCLUDED.updated_by,
  updated_at = now(),
  version = pos_channel_settings.version + 1;

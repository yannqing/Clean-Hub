-- Default Email notification templates and configs for Demo Tenant 1 (CLEAN-001).
--
-- This is seed data, not schema migration. It is intentionally idempotent and
-- uses fixed ULIDs so local/dev environments can be reseeded safely.

-- tenant_id : 01KRERJN800000000000000001

INSERT INTO notification_templates (
  id, tenant_id, template_code, template_name, notice_type, locale,
  title_template, content_template, variables, is_system, is_enabled
)
VALUES
  ('01SEED0200TPLORDCRT0000001', NULL, 'email.order.created', 'Order created email', 'business', 'en',
   'Order {{orderNo}} received',
   'Hi {{customerName}}, we received order {{orderNo}}. Total: {{totalAmount}}.',
   '[{"name":"orderNo"},{"name":"customerName"},{"name":"totalAmount"}]'::jsonb, true, true),
  ('01SEED0200TPLORDCRT0000002', NULL, 'email.order.created', 'Email commande creee', 'business', 'fr',
   'Commande {{orderNo}} recue',
   'Bonjour {{customerName}}, nous avons recu la commande {{orderNo}}. Total: {{totalAmount}}.',
   '[{"name":"orderNo"},{"name":"customerName"},{"name":"totalAmount"}]'::jsonb, true, true),
  ('01SEED0200TPLORDCRT0000003', NULL, 'email.order.created', '订单创建邮件', 'business', 'zh-CN',
   '订单 {{orderNo}} 已受理',
   '{{customerName}}，您的订单 {{orderNo}} 已受理。金额：{{totalAmount}}。',
   '[{"name":"orderNo"},{"name":"customerName"},{"name":"totalAmount"}]'::jsonb, true, true),

  ('01SEED0200TPLORDCMP0000001', NULL, 'email.order.completed', 'Order completed email', 'business', 'en',
   'Order {{orderNo}} completed',
   'Hi {{customerName}}, order {{orderNo}} is complete and ready. Total: {{totalAmount}}.',
   '[{"name":"orderNo"},{"name":"customerName"},{"name":"totalAmount"}]'::jsonb, true, true),
  ('01SEED0200TPLORDCMP0000002', NULL, 'email.order.completed', 'Email commande terminee', 'business', 'fr',
   'Commande {{orderNo}} terminee',
   'Bonjour {{customerName}}, la commande {{orderNo}} est terminee. Total: {{totalAmount}}.',
   '[{"name":"orderNo"},{"name":"customerName"},{"name":"totalAmount"}]'::jsonb, true, true),
  ('01SEED0200TPLORDCMP0000003', NULL, 'email.order.completed', '订单完成邮件', 'business', 'zh-CN',
   '订单 {{orderNo}} 已完成',
   '{{customerName}}，您的订单 {{orderNo}} 已完成。金额：{{totalAmount}}。',
   '[{"name":"orderNo"},{"name":"customerName"},{"name":"totalAmount"}]'::jsonb, true, true),

  ('01SEED0200TPLTKTOVD0000001', NULL, 'email.ticket.overdue', 'Overdue pickup email', 'business', 'en',
   'Pickup reminder for {{ticketNo}}',
   'Hi {{customerName}}, ticket {{ticketNo}} is ready for pickup. Expected pickup time: {{expectedPickupAt}}.',
   '[{"name":"ticketNo"},{"name":"customerName"},{"name":"expectedPickupAt"}]'::jsonb, true, true),
  ('01SEED0200TPLTKTOVD0000002', NULL, 'email.ticket.overdue', 'Rappel retrait email', 'business', 'fr',
   'Rappel retrait {{ticketNo}}',
   'Bonjour {{customerName}}, le ticket {{ticketNo}} est pret a etre retire. Date prevue: {{expectedPickupAt}}.',
   '[{"name":"ticketNo"},{"name":"customerName"},{"name":"expectedPickupAt"}]'::jsonb, true, true),
  ('01SEED0200TPLTKTOVD0000003', NULL, 'email.ticket.overdue', '逾期取件邮件', 'business', 'zh-CN',
   '取件提醒 {{ticketNo}}',
   '{{customerName}}，工单 {{ticketNo}} 已可取件，预计取件时间：{{expectedPickupAt}}。',
   '[{"name":"ticketNo"},{"name":"customerName"},{"name":"expectedPickupAt"}]'::jsonb, true, true),

  ('01SEED0200TPLDLVSTS0000001', NULL, 'email.delivery.status_changed', 'Delivery status email', 'business', 'en',
   'Delivery update: {{toStatus}}',
   'Hi {{customerName}}, your {{type}} delivery task is now {{toStatus}}.',
   '[{"name":"customerName"},{"name":"type"},{"name":"toStatus"}]'::jsonb, true, true),
  ('01SEED0200TPLDLVSTS0000002', NULL, 'email.delivery.status_changed', 'Email statut livraison', 'business', 'fr',
   'Mise a jour livraison: {{toStatus}}',
   'Bonjour {{customerName}}, votre livraison {{type}} est maintenant {{toStatus}}.',
   '[{"name":"customerName"},{"name":"type"},{"name":"toStatus"}]'::jsonb, true, true),
  ('01SEED0200TPLDLVSTS0000003', NULL, 'email.delivery.status_changed', '配送状态邮件', 'business', 'zh-CN',
   '配送状态更新：{{toStatus}}',
   '{{customerName}}，您的 {{type}} 配送任务状态已更新为 {{toStatus}}。',
   '[{"name":"customerName"},{"name":"type"},{"name":"toStatus"}]'::jsonb, true, true)
ON CONFLICT (id) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  locale = EXCLUDED.locale,
  title_template = EXCLUDED.title_template,
  content_template = EXCLUDED.content_template,
  variables = EXCLUDED.variables,
  is_system = EXCLUDED.is_system,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

INSERT INTO notification_configs (
  id, tenant_id, template_id, config_name, notice_type, trigger_type,
  trigger_event, channel, recipient_type, frequency_limit,
  frequency_window_minutes, is_enabled
)
VALUES
  ('01SEED0200CFGORDCRT0000001', '01KRERJN800000000000000001', '01SEED0200TPLORDCRT0000001',
   'Order created customer email', 'business', 'event', 'order.created', 'email', 'customer', 3, 60, true),
  ('01SEED0200CFGORDCMP0000001', '01KRERJN800000000000000001', '01SEED0200TPLORDCMP0000001',
   'Order completed customer email', 'business', 'event', 'order.completed', 'email', 'customer', 3, 60, true),
  ('01SEED0200CFGTKTOVD0000001', '01KRERJN800000000000000001', '01SEED0200TPLTKTOVD0000001',
   'Overdue pickup customer email', 'business', 'event', 'ticket.overdue', 'email', 'customer', 1, 1440, true),
  ('01SEED0200CFGDLVSTS0000001', '01KRERJN800000000000000001', '01SEED0200TPLDLVSTS0000001',
   'Delivery status customer email', 'business', 'event', 'delivery.status_changed', 'email', 'customer', 10, 60, true)
ON CONFLICT (id) DO UPDATE SET
  template_id = EXCLUDED.template_id,
  config_name = EXCLUDED.config_name,
  trigger_event = EXCLUDED.trigger_event,
  channel = EXCLUDED.channel,
  recipient_type = EXCLUDED.recipient_type,
  frequency_limit = EXCLUDED.frequency_limit,
  frequency_window_minutes = EXCLUDED.frequency_window_minutes,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

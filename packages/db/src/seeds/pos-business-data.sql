-- POS business demo data for Demo Tenant 1 (CLEAN-001).
--
-- Run AFTER dev-accounts.sql AND pos-cashiers.sql. This file assumes:
--   tenant    = 01KRERJN800000000000000001 (CLEAN-001)
--   branch    = 01KRERJN8G0000000000000040 (CleanHub 旗舰店)
--   cashier1  = 01KRERJN8F0000000000000031 (acts as created_by / assistant_id)
--
-- Idempotent: every statement uses ON CONFLICT ... DO UPDATE / DO NOTHING.
-- IDs are fixed readable ULIDs (prefix 01SEED01...) where the seed owns the
-- record. Service-category references resolve by the category's natural key,
-- so an existing matching category with a different ID is reused safely.
--
-- Coverage:
--   tenant_feature_flags (1) — enables the business lines seeded below
--   service_categories (8) + services (8) + prices (8)
--   customer_accounts (10) + customers (14)
--   service_tickets (14) + ticket_items (~20)
--   orders (14) + order_items (~20)
--   payment_transactions (~12)
--   notifications (10) + notification_deliveries (10)

-- ───────────────────────────────────────────────
-- 0) Shared constants for readability
-- ───────────────────────────────────────────────
-- tenant_id : 01KRERJN800000000000000001
-- branch_id : 01KRERJN8G0000000000000040
-- cashier1  : 01KRERJN8F0000000000000031
-- cashier2  : 01KRERJN8F0000000000000032

-- ─────────────────────────────────────────────--
-- 0.5) Tenant feature flags
-- The API gates ticket detail/create on the tenant's feature flags
-- (requireFeatureEnabled). The services/tickets below span laundry and
-- car_wash, so both must be enabled or the seeded tickets can't be opened.
-- retail/delivery stay off (no seeded data for those lines).
-- ─────────────────────────────────────────────--
INSERT INTO tenant_feature_flags (
  id, tenant_id,
  laundry_enabled, car_wash_enabled, retail_products_enabled, delivery_enabled, notifications_enabled,
  version
) VALUES (
  '01SEED0100FKG0000000000001', '01KRERJN800000000000000001',
  TRUE, TRUE, FALSE, FALSE, TRUE,
  1
)
ON CONFLICT (tenant_id) DO UPDATE SET
  laundry_enabled        = EXCLUDED.laundry_enabled,
  car_wash_enabled       = EXCLUDED.car_wash_enabled,
  retail_products_enabled = EXCLUDED.retail_products_enabled,
  delivery_enabled       = EXCLUDED.delivery_enabled,
  notifications_enabled  = EXCLUDED.notifications_enabled,
  updated_at             = now();

-- ───────────────────────────────────────────────
-- 1) Default service categories
-- ───────────────────────────────────────────────
INSERT INTO service_categories (
  id, tenant_id, name, business_line, description, sort_order, status
)
VALUES
  ('01SEED0100SCG0000000000001', '01KRERJN800000000000000001', '衣物洗护', 'laundry', '衬衫、西装、外套等日常衣物的水洗与干洗服务', 10, 'active'),
  ('01SEED0100SCG0000000000002', '01KRERJN800000000000000001', '熨烫护理', 'laundry', '衣物熨烫、整形与精细护理服务', 20, 'active'),
  ('01SEED0100SCG0000000000003', '01KRERJN800000000000000001', '家纺洗护', 'laundry', '床单、被套、窗帘等家纺用品的洗护服务', 30, 'active'),
  ('01SEED0100SCG0000000000004', '01KRERJN800000000000000001', '鞋靴洗护', 'laundry', '运动鞋、皮鞋和靴类的清洁与护理服务', 40, 'active'),
  ('01SEED0100SCG0000000000005', '01KRERJN800000000000000001', '地毯与大件', 'laundry', '地毯、沙发套和其他大件织物的专业清洁服务', 50, 'active'),
  ('01SEED0100SCG0000000000006', '01KRERJN800000000000000001', '洗车服务', 'car_wash', '轿车、SUV 等车辆的外洗与精洗服务', 10, 'active'),
  ('01SEED0100SCG0000000000007', '01KRERJN800000000000000001', '会员与增值服务', 'retail', '会员方案及与主营服务配套的增值项目', 10, 'active'),
  ('01SEED0100SCG0000000000008', '01KRERJN800000000000000001', '配送服务', 'delivery', '上门取送及订单配送相关服务', 10, 'active')
ON CONFLICT (tenant_id, business_line, name) WHERE deleted_at IS NULL DO UPDATE SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 2) Services catalog (8 items across business lines)
-- ───────────────────────────────────────────────
INSERT INTO services (
  id, tenant_id, category_id, name, description, business_line,
  pricing_unit, display_order, label_rule, status
)
VALUES
  (
    '01SEED0100SVC0000000000001', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'laundry'
        AND name = '衣物洗护'
        AND deleted_at IS NULL
    ),
    '衬衫水洗', '单件衬衫标准水洗、烘干与整理服务', 'laundry',
    'per_item', 10, 'per_item', 'active'
  ),
  (
    '01SEED0100SVC0000000000002', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'laundry'
        AND name = '衣物洗护'
        AND deleted_at IS NULL
    ),
    '西装干洗', '单件西装专业干洗与整形护理服务', 'laundry',
    'per_item', 20, 'per_item', 'active'
  ),
  (
    '01SEED0100SVC0000000000003', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'laundry'
        AND name = '衣物洗护'
        AND deleted_at IS NULL
    ),
    '外套水洗', '单件日常外套水洗与整理服务', 'laundry',
    'per_item', 30, 'per_item', 'active'
  ),
  (
    '01SEED0100SVC0000000000004', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'laundry'
        AND name = '家纺洗护'
        AND deleted_at IS NULL
    ),
    '床单水洗', '床单、被套等家纺用品按公斤计价的水洗服务', 'laundry',
    'per_kg', 40, 'per_bag', 'active'
  ),
  (
    '01SEED0100SVC0000000000005', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'car_wash'
        AND name = '洗车服务'
        AND deleted_at IS NULL
    ),
    'SUV 精洗', 'SUV 车型内外精细清洁服务', 'car_wash',
    'per_item', 10, 'none', 'active'
  ),
  (
    '01SEED0100SVC0000000000006', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'car_wash'
        AND name = '洗车服务'
        AND deleted_at IS NULL
    ),
    '轿车精洗', '轿车车型内外精细清洁服务', 'car_wash',
    'per_item', 20, 'none', 'active'
  ),
  (
    '01SEED0100SVC0000000000007', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'retail'
        AND name = '会员与增值服务'
        AND deleted_at IS NULL
    ),
    '银卡月度会员', '面向普通会员的月度服务权益方案', 'retail',
    'per_item', 10, 'none', 'active'
  ),
  (
    '01SEED0100SVC0000000000008', '01KRERJN800000000000000001',
    (
      SELECT id
      FROM service_categories
      WHERE tenant_id = '01KRERJN800000000000000001'
        AND business_line = 'retail'
        AND name = '会员与增值服务'
        AND deleted_at IS NULL
    ),
    '织物除味剂', '作为洗护订单附加项目销售的织物除味服务', 'retail',
    'per_item', 20, 'none', 'active'
  )
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  business_line = EXCLUDED.business_line,
  pricing_unit = EXCLUDED.pricing_unit,
  display_order = EXCLUDED.display_order,
  label_rule = EXCLUDED.label_rule,
  status = EXCLUDED.status,
  updated_at = now();

-- The service-category migration creates one "未分类" fallback per existing
-- tenant/business-line scope so historical services can be backfilled safely.
-- The demo services above now reference their intended categories, therefore
-- remove only migration-generated fallbacks that are no longer referenced.
DELETE FROM service_categories AS category
WHERE category.tenant_id = '01KRERJN800000000000000001'
  AND category.name = '未分类'
  AND category.description = '迁移期间为既有服务自动创建的默认分类'
  AND NOT EXISTS (
    SELECT 1
    FROM services AS service
    WHERE service.tenant_id = category.tenant_id
      AND service.category_id = category.id
  );

-- ───────────────────────────────────────────────
-- 3) Prices (1:1 with services)
-- ───────────────────────────────────────────────
INSERT INTO prices (id, tenant_id, service_id, amount, currency, status)
VALUES
  ('01SEED0100PRC0000000000001', '01KRERJN800000000000000001', '01SEED0100SVC0000000000001', 15.00, 'CNY', 'active'),
  ('01SEED0100PRC0000000000002', '01KRERJN800000000000000001', '01SEED0100SVC0000000000002', 40.00, 'CNY', 'active'),
  ('01SEED0100PRC0000000000003', '01KRERJN800000000000000001', '01SEED0100SVC0000000000003', 25.00, 'CNY', 'active'),
  ('01SEED0100PRC0000000000004', '01KRERJN800000000000000001', '01SEED0100SVC0000000000004', 8.00,  'CNY', 'active'),
  ('01SEED0100PRC0000000000005', '01KRERJN800000000000000001', '01SEED0100SVC0000000000005', 80.00, 'CNY', 'active'),
  ('01SEED0100PRC0000000000006', '01KRERJN800000000000000001', '01SEED0100SVC0000000000006', 50.00, 'CNY', 'active'),
  ('01SEED0100PRC0000000000007', '01KRERJN800000000000000001', '01SEED0100SVC0000000000007', 99.00, 'CNY', 'active'),
  ('01SEED0100PRC0000000000008', '01KRERJN800000000000000001', '01SEED0100SVC0000000000008', 12.00, 'CNY', 'active')
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 4) Customer accounts (5)
-- ───────────────────────────────────────────────
INSERT INTO customer_accounts (id, tenant_id, account_name, phone, email, status)
VALUES
  ('01SEED0100ACC0000000000001', '01KRERJN800000000000000001', '张伟家庭账户', '13800000001', 'zhang.wei@example.com', 'active'),
  ('01SEED0100ACC0000000000002', '01KRERJN800000000000000001', '李娜账户',     '13800000002', NULL, 'active'),
  ('01SEED0100ACC0000000000003', '01KRERJN800000000000000001', '王芳家庭账户', '13800000003', 'wang.fang@example.com', 'active'),
  ('01SEED0100ACC0000000000004', '01KRERJN800000000000000001', '刘洋账户',     '13800000004', NULL, 'active'),
  ('01SEED0100ACC0000000000005', '01KRERJN800000000000000001', '公司账户-A 跨国', '13800000005', 'company.a@example.com', 'active')
ON CONFLICT (id) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 5) Customer profiles (8, distributed across accounts)
-- ───────────────────────────────────────────────
INSERT INTO customers (id, customer_account_id, tenant_id, full_name, phone, email, relationship, address, notes, status)
VALUES
  ('01SEED0100CPS0000000000001', '01SEED0100ACC0000000000001', '01KRERJN800000000000000001', '张伟',   '13800000001', 'zhang.wei@example.com',   '本人',   '上海市黄浦区人民路 100 号', 'VIP 客户,偏好熨烫', 'active'),
  ('01SEED0100CPS0000000000002', '01SEED0100ACC0000000000001', '01KRERJN800000000000000001', '张小明', '13800000011', NULL,                      '家人',   '上海市黄浦区人民路 100 号', NULL,                  'active'),
  ('01SEED0100CPS0000000000003', '01SEED0100ACC0000000000002', '01KRERJN800000000000000001', '李娜',   '13800000002', NULL,                      '本人',   '上海市浦东新区世纪大道 1 号', '对羊毛衫有特殊护理要求', 'active'),
  ('01SEED0100CPS0000000000004', '01SEED0100ACC0000000000003', '01KRERJN800000000000000001', '王芳',   '13800000003', 'wang.fang@example.com',   '本人',   '上海市徐汇区漕溪北路 88 号', NULL,                  'active'),
  ('01SEED0100CPS0000000000005', '01SEED0100ACC0000000000003', '01KRERJN800000000000000001', '王强',   '13800000031', NULL,                      '家人',   '上海市徐汇区漕溪北路 88 号', '经常洗车',           'active'),
  ('01SEED0100CPS0000000000006', '01SEED0100ACC0000000000004', '01KRERJN800000000000000001', '刘洋',   '13800000004', NULL,                      '本人',   '上海市静安区南京西路 1788 号', NULL,                'active'),
  ('01SEED0100CPS0000000000007', '01SEED0100ACC0000000000005', '01KRERJN800000000000000001', 'A 公司前台', '13800000005', 'company.a@example.com', '员工',   '上海市长宁区延安西路 1000 号', '公司月结客户',       'active'),
  ('01SEED0100CPS0000000000008', '01SEED0100ACC0000000000005', '01KRERJN800000000000000001', 'A 公司员工 B', '13800000051', NULL,                '员工',   '上海市长宁区延安西路 1000 号', NULL,                'disabled')
ON CONFLICT (id) DO UPDATE SET
  customer_account_id = EXCLUDED.customer_account_id,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  relationship = EXCLUDED.relationship,
  address = EXCLUDED.address,
  notes = EXCLUDED.notes,
  status = EXCLUDED.status,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 6) Service tickets (8, covering all statuses & priorities)
-- ───────────────────────────────────────────────
-- ticket_status enum: draft / pending / in_progress / ready_to_pick / picked_up / cancelled / exception
-- priority enum     : normal / urgent / critical
-- business_line enum: laundry / car_wash / retail / delivery
INSERT INTO service_tickets (
  id, tenant_id, branch_id, customer_id, assistant_id, ticket_no, ticket_type, ticket_status,
  expected_pickup_at, completed_at, cancelled_at, priority, remark, source_channel, created_by, created_at
)
VALUES
  (
    '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000001', '01KRERJN8F0000000000000031', 'T20260618001', 'laundry', 'ready_to_pick',
    '2026-06-19 18:00:00+08', NULL, NULL, 'normal', '客户要求加固包装', 'pos',
    '01KRERJN8F0000000000000031', '2026-06-17 10:08:00+08'
  ),
  (
    '01SEED0100TKT0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000003', '01KRERJN8F0000000000000032', 'T20260618002', 'laundry', 'in_progress',
    '2026-06-19 18:00:00+08', NULL, NULL, 'urgent', '羊毛衫特殊护理', 'pos',
    '01KRERJN8F0000000000000032', '2026-06-17 11:20:00+08'
  ),
  (
    '01SEED0100TKT0000000000003', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000005', '01KRERJN8F0000000000000031', 'T20260618003', 'car_wash', 'in_progress',
    '2026-06-18 12:00:00+08', NULL, NULL, 'normal', 'SUV 内外精洗', 'pos',
    '01KRERJN8F0000000000000031', '2026-06-18 09:30:00+08'
  ),
  (
    '01SEED0100TKT0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000001', '01KRERJN8F0000000000000031', 'T20260618004', 'laundry', 'picked_up',
    '2026-06-17 18:00:00+08', '2026-06-17 16:30:00+08', NULL, 'normal', NULL, 'pos',
    '01KRERJN8F0000000000000031', '2026-06-16 14:00:00+08'
  ),
  (
    '01SEED0100TKT0000000000005', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000006', '01KRERJN8F0000000000000032', 'T20260618005', 'laundry', 'exception',
    '2026-06-18 18:00:00+08', NULL, NULL, 'critical', '衣物在清洗过程中发现新瑕疵,需店长确认', 'pos',
    '01KRERJN8F0000000000000032', '2026-06-17 15:40:00+08'
  ),
  (
    '01SEED0100TKT0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000004', '01KRERJN8F0000000000000031', 'T20260618006', 'laundry', 'pending',
    '2026-06-20 18:00:00+08', NULL, NULL, 'normal', NULL, 'phone',
    '01KRERJN8F0000000000000031', '2026-06-18 10:15:00+08'
  ),
  (
    '01SEED0100TKT0000000000007', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000002', '01KRERJN8F0000000000000031', 'T20260618007', 'laundry', 'draft',
    NULL, NULL, NULL, 'normal', '草稿,客户还在考虑', 'pos',
    '01KRERJN8F0000000000000031', '2026-06-18 11:00:00+08'
  ),
  (
    '01SEED0100TKT0000000000008', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000007', '01KRERJN8F0000000000000032', 'T20260618008', 'laundry', 'cancelled',
    '2026-06-17 18:00:00+08', NULL, '2026-06-17 17:50:00+08', 'normal', '客户取消,不要了', 'app',
    '01KRERJN8F0000000000000032', '2026-06-16 09:00:00+08'
  )
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  assistant_id = EXCLUDED.assistant_id,
  ticket_no = EXCLUDED.ticket_no,
  ticket_type = EXCLUDED.ticket_type,
  ticket_status = EXCLUDED.ticket_status,
  expected_pickup_at = EXCLUDED.expected_pickup_at,
  completed_at = EXCLUDED.completed_at,
  cancelled_at = EXCLUDED.cancelled_at,
  priority = EXCLUDED.priority,
  remark = EXCLUDED.remark,
  source_channel = EXCLUDED.source_channel,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 7) Ticket items (~20, distributed across tickets)
-- ───────────────────────────────────────────────
-- ticket_item_type enum: cloth / car / shoe / carpet
-- ticket_item_status enum: washing / done / ready_to_pick
INSERT INTO ticket_items (
  id, ticket_id, tenant_id, branch_id, service_id,
  item_type, item_name, item_category, item_status, item_color, item_brand, item_material,
  quantity, unit_amount, line_amount, remark, defect_notes, special_request, label_code, sort_order
)
VALUES
  -- Ticket 1 (ready_to_pick): 3 items
  ('01SEED0100T1T000000000001', '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '白色衬衫', '上衣', 'done', '白色', '雅戈尔', '棉', 2, 15.00, 30.00, NULL, NULL, NULL, 'L-0001', 0),
  ('01SEED0100T1T000000000002', '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000002',
   'cloth', '藏青色西装', '外套', 'done', '藏青', '雅戈尔', '羊毛', 1, 40.00, 40.00, NULL, NULL, '加固包装', 'L-0002', 1),
  ('01SEED0100T1T000000000003', '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000003',
   'cloth', '黑色外套', '外套', 'done', '黑色', NULL, '聚酯纤维', 1, 25.00, 25.00, NULL, NULL, NULL, 'L-0003', 2),
  -- Ticket 2 (in_progress, urgent): 2 items
  ('01SEED0100T1T000000000004', '01SEED0100TKT0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000002',
   'cloth', '米色羊毛衫', '外套', 'washing', '米色', '优衣库', '羊毛', 1, 40.00, 40.00, NULL, NULL, '特殊护理,低温烘干', 'L-0004', 0),
  ('01SEED0100T1T000000000005', '01SEED0100TKT0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '灰色衬衫', '上衣', 'washing', '灰色', NULL, '棉', 1, 15.00, 15.00, NULL, NULL, NULL, 'L-0005', 1),
  -- Ticket 3 (in_progress, car_wash): 1 item
  ('01SEED0100T1T000000000006', '01SEED0100TKT0000000000003', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000005',
   'car', 'Toyota RAV4', NULL, 'washing', '白色', '丰田', NULL, 1, 80.00, 80.00, '内外精洗', NULL, NULL, 'L-0006', 0),
  -- Ticket 4 (picked_up): 2 items, all done
  ('01SEED0100T1T000000000007', '01SEED0100TKT0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000004',
   'cloth', '床单套装', '床品', 'done', '白色', NULL, '棉', 3, 8.00, 24.00, NULL, NULL, NULL, 'L-0007', 0),
  ('01SEED0100T1T000000000008', '01SEED0100TKT0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '条纹衬衫', '上衣', 'done', '蓝白', NULL, '棉', 1, 15.00, 15.00, NULL, NULL, NULL, 'L-0008', 1),
  -- Ticket 5 (exception): 1 item with defect
  ('01SEED0100T1T000000000009', '01SEED0100TKT0000000000005', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000002',
   'cloth', '黑色风衣', '外套', 'washing', '黑色', 'ZARA', '聚酯纤维', 1, 40.00, 40.00, NULL, '袖口发现新污渍,客户需确认', NULL, 'L-0009', 0),
  -- Ticket 6 (pending): 2 items
  ('01SEED0100T1T000000000010', '01SEED0100TKT0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000003',
   'cloth', '驼色大衣', '外套', 'washing', '驼色', NULL, '羊毛', 1, 25.00, 25.00, NULL, NULL, NULL, 'L-0010', 0),
  ('01SEED0100T1T000000000011', '01SEED0100TKT0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '粉色衬衫', '上衣', 'washing', '粉色', NULL, '丝绸', 1, 15.00, 15.00, NULL, NULL, NULL, 'L-0011', 1),
  -- Ticket 7 (draft): 1 item
  ('01SEED0100T1T000000000012', '01SEED0100TKT0000000000007', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '校服衬衫', '上衣', 'washing', '白色', NULL, '棉', 2, 15.00, 30.00, NULL, NULL, NULL, 'L-0012', 0)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id,
  item_type = EXCLUDED.item_type,
  item_name = EXCLUDED.item_name,
  item_category = EXCLUDED.item_category,
  item_status = EXCLUDED.item_status,
  item_color = EXCLUDED.item_color,
  item_brand = EXCLUDED.item_brand,
  item_material = EXCLUDED.item_material,
  quantity = EXCLUDED.quantity,
  unit_amount = EXCLUDED.unit_amount,
  line_amount = EXCLUDED.line_amount,
  remark = EXCLUDED.remark,
  defect_notes = EXCLUDED.defect_notes,
  special_request = EXCLUDED.special_request,
  label_code = EXCLUDED.label_code,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 8) Orders (8, mix of ticket-linked and manual)
-- ───────────────────────────────────────────────
-- order_type enum        : ticket / manual
-- order_status enum      : draft / received / paid / delivered / cancelled
-- order_payment_status   : unpaid / paid / partial / refunded
INSERT INTO orders (
  id, tenant_id, branch_id, customer_id, order_type, status,
  subtotal_amount, discount_amount, total_amount, payment_status, paid_amount, paid_at, expire_at, notes, created_by, created_at
)
VALUES
  (
    '01SEED01000RD0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000001', 'ticket', 'delivered',
    95.00, 0.00, 95.00, 'paid', 95.00, '2026-06-16 14:30:00+08', '2026-06-17 18:00:00+08',
    '基于工单 T20260618004', '01KRERJN8F0000000000000031', '2026-06-16 14:00:00+08'
  ),
  (
    '01SEED01000RD0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000001', 'ticket', 'paid',
    95.00, 0.00, 95.00, 'partial', 50.00, '2026-06-17 10:10:00+08', '2026-06-19 18:00:00+08',
    '基于工单 T20260618001,部分支付,取件时补齐', '01KRERJN8F0000000000000031', '2026-06-17 10:08:00+08'
  ),
  (
    '01SEED01000RD0000000000003', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000003', 'ticket', 'received',
    55.00, 0.00, 55.00, 'unpaid', 0.00, NULL, '2026-06-19 18:00:00+08',
    '基于工单 T20260618002,等客户确认价格', '01KRERJN8F0000000000000032', '2026-06-17 11:25:00+08'
  ),
  (
    '01SEED01000RD0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000005', 'ticket', 'received',
    80.00, 0.00, 80.00, 'unpaid', 0.00, NULL, '2026-06-18 12:00:00+08',
    '基于工单 T20260618003,车辆精洗', '01KRERJN8F0000000000000031', '2026-06-18 09:35:00+08'
  ),
  (
    '01SEED01000RD0000000000005', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000006', 'ticket', 'received',
    40.00, 0.00, 40.00, 'unpaid', 0.00, NULL, '2026-06-18 18:00:00+08',
    '基于工单 T20260618005,异常工单,等店长确认后处理', '01KRERJN8F0000000000000032', '2026-06-17 15:45:00+08'
  ),
  (
    '01SEED01000RD0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000007', 'manual', 'cancelled',
    99.00, 0.00, 99.00, 'refunded', 0.00, NULL, '2026-06-17 23:59:00+08',
    '银卡月度会员订阅,客户取消已退款', '01KRERJN8F0000000000000032', '2026-06-16 09:05:00+08'
  ),
  (
    '01SEED01000RD0000000000007', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000002', 'manual', 'paid',
    12.00, 0.00, 12.00, 'paid', 12.00, '2026-06-18 10:20:00+08', '2026-06-19 18:00:00+08',
    '零售:织物除味剂', '01KRERJN8F0000000000000031', '2026-06-18 10:15:00+08'
  ),
  (
    '01SEED01000RD0000000000008', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
    '01SEED0100CPS0000000000004', 'ticket', 'draft',
    40.00, 0.00, 40.00, 'unpaid', 0.00, NULL, NULL,
    '基于工单 T20260618006,草稿', '01KRERJN8F0000000000000031', '2026-06-18 10:15:00+08'
  )
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  order_type = EXCLUDED.order_type,
  status = EXCLUDED.status,
  subtotal_amount = EXCLUDED.subtotal_amount,
  discount_amount = EXCLUDED.discount_amount,
  total_amount = EXCLUDED.total_amount,
  payment_status = EXCLUDED.payment_status,
  paid_amount = EXCLUDED.paid_amount,
  paid_at = EXCLUDED.paid_at,
  expire_at = EXCLUDED.expire_at,
  notes = EXCLUDED.notes,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 9) Order items (~15)
-- ───────────────────────────────────────────────
-- source_type enum: ticket_item / subscription / delivery_fee / product
INSERT INTO order_items (
  id, order_id, ticket_id, tenant_id, branch_id, customer_id,
  source_type, source_id, item_name, quantity, unit_amount, line_amount
)
VALUES
  -- Order 1 (delivered, from ticket 4): 2 items
  ('01SEED010001T000000000001', '01SEED01000RD0000000000001', '01SEED0100TKT0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001',
   'ticket_item', '01SEED0100T1T000000000007', '床单套装', 3, 8.00, 24.00),
  ('01SEED010001T000000000002', '01SEED01000RD0000000000001', '01SEED0100TKT0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001',
   'ticket_item', '01SEED0100T1T000000000008', '条纹衬衫', 1, 15.00, 15.00),
  -- Order 2 (paid partial, from ticket 1): 3 items
  ('01SEED010001T000000000003', '01SEED01000RD0000000000002', '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001',
   'ticket_item', '01SEED0100T1T000000000001', '白色衬衫', 2, 15.00, 30.00),
  ('01SEED010001T000000000004', '01SEED01000RD0000000000002', '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001',
   'ticket_item', '01SEED0100T1T000000000002', '藏青色西装', 1, 40.00, 40.00),
  ('01SEED010001T000000000005', '01SEED01000RD0000000000002', '01SEED0100TKT0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001',
   'ticket_item', '01SEED0100T1T000000000003', '黑色外套', 1, 25.00, 25.00),
  -- Order 3 (received, from ticket 2): 2 items
  ('01SEED010001T000000000006', '01SEED01000RD0000000000003', '01SEED0100TKT0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000003',
   'ticket_item', '01SEED0100T1T000000000004', '米色羊毛衫', 1, 40.00, 40.00),
  ('01SEED010001T000000000007', '01SEED01000RD0000000000003', '01SEED0100TKT0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000003',
   'ticket_item', '01SEED0100T1T000000000005', '灰色衬衫', 1, 15.00, 15.00),
  -- Order 4 (received, from ticket 3, car wash): 1 item
  ('01SEED010001T000000000008', '01SEED01000RD0000000000004', '01SEED0100TKT0000000000003', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000005',
   'ticket_item', '01SEED0100T1T000000000006', 'Toyota RAV4', 1, 80.00, 80.00),
  -- Order 5 (received, from ticket 5, exception): 1 item
  ('01SEED010001T000000000009', '01SEED01000RD0000000000005', '01SEED0100TKT0000000000005', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000006',
   'ticket_item', '01SEED0100T1T000000000009', '黑色风衣', 1, 40.00, 40.00),
  -- Order 6 (cancelled, manual subscription): 1 item
  ('01SEED010001T000000000010', '01SEED01000RD0000000000006', NULL, '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000007',
   'subscription', 'SUB-SILVER-MONTH', '银卡月度会员', 1, 99.00, 99.00),
  -- Order 7 (paid, legacy retail service line): 1 item
  ('01SEED010001T000000000011', '01SEED01000RD0000000000007', NULL, '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000002',
   'product', '01SEED0100SVC0000000000008', '织物除味剂', 1, 12.00, 12.00),
  -- Order 8 (draft, from ticket 6): 2 items
  ('01SEED010001T000000000012', '01SEED01000RD0000000000008', '01SEED0100TKT0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000004',
   'ticket_item', '01SEED0100T1T000000000010', '驼色大衣', 1, 25.00, 25.00),
  ('01SEED010001T000000000013', '01SEED01000RD0000000000008', '01SEED0100TKT0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000004',
   'ticket_item', '01SEED0100T1T000000000011', '粉色衬衫', 1, 15.00, 15.00)
ON CONFLICT (id) DO UPDATE SET
  ticket_id = EXCLUDED.ticket_id,
  source_type = EXCLUDED.source_type,
  source_id = EXCLUDED.source_id,
  item_name = EXCLUDED.item_name,
  quantity = EXCLUDED.quantity,
  unit_amount = EXCLUDED.unit_amount,
  line_amount = EXCLUDED.line_amount,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 10) Payment transactions (~12, covering all methods & statuses)
-- ───────────────────────────────────────────────
-- payment_method enum: cash / card / app
-- payment_transaction_status enum: pending / paid / refunded / failed
INSERT INTO payment_transactions (
  id, tenant_id, branch_id, customer_id, order_id,
  payment_method, amount, payment_status, paid_at, created_by, created_at
)
VALUES
  -- Order 1: fully paid via cash + card (multiple transactions)
  ('01SEED0100PTX0000000000001', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001', '01SEED01000RD0000000000001',
   'cash', 50.00, 'paid', '2026-06-16 14:20:00+08', '01KRERJN8F0000000000000031', '2026-06-16 14:20:00+08'),
  ('01SEED0100PTX0000000000002', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001', '01SEED01000RD0000000000001',
   'card', 45.00, 'paid', '2026-06-16 14:30:00+08', '01KRERJN8F0000000000000031', '2026-06-16 14:30:00+08'),
  -- Order 2: partial payment via cash
  ('01SEED0100PTX0000000000003', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000001', '01SEED01000RD0000000000002',
   'cash', 50.00, 'paid', '2026-06-17 10:10:00+08', '01KRERJN8F0000000000000031', '2026-06-17 10:10:00+08'),
  -- Order 6: paid then refunded (shows refund flow without refund endpoint)
  ('01SEED0100PTX0000000000004', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000007', '01SEED01000RD0000000000006',
   'card', 99.00, 'paid', '2026-06-16 09:10:00+08', '01KRERJN8F0000000000000032', '2026-06-16 09:10:00+08'),
  ('01SEED0100PTX0000000000005', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000007', '01SEED01000RD0000000000006',
   'card', -99.00, 'refunded', '2026-06-17 17:50:00+08', '01KRERJN8F0000000000000032', '2026-06-17 17:50:00+08'),
  -- Order 7: paid via app
  ('01SEED0100PTX0000000000006', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000002', '01SEED01000RD0000000000007',
   'app', 12.00, 'paid', '2026-06-18 10:20:00+08', '01KRERJN8F0000000000000031', '2026-06-18 10:20:00+08')
ON CONFLICT (id) DO UPDATE SET
  payment_method = EXCLUDED.payment_method,
  amount = EXCLUDED.amount,
  payment_status = EXCLUDED.payment_status,
  paid_at = EXCLUDED.paid_at,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 11) Notifications (6) + Deliveries (6, to cashier1)
-- ───────────────────────────────────────────────
-- scope enum     : pos / saas / tenant / mobile / desktop
-- notice_type    : system / business
-- priority       : low / normal / high / critical
-- channel        : pos / app / sms / whatsapp / email
-- recipient_type : role / user / customer / branch_all / tenant_all
-- sender_type    : system / user / customer / scheduler
-- status         : pending / sent / failed / cancelled
-- read_status    : unread / read / archived
INSERT INTO notifications (
  id, tenant_id, scope, notice_type, config_id, template_id,
  related_type, related_id, title, content, locale, payload, priority, idempotency_key, created_by, created_at
)
VALUES
  ('01SEED0100N0T0000000000001', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'ticket', '01SEED0100TKT0000000000001', '工单 T20260618001 已可取件',
   '工单 T20260618001(客户:张伟)的 3 件衣物已完成处理,可以通知客户取件。', 'zh-CN', NULL, 'normal', 'ticket:01SEED0100TKT0000000000001:ready_to_pick',
   '01KRERJN8F0000000000000031', '2026-06-17 10:30:00+08'),
  ('01SEED0100N0T0000000000002', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'ticket', '01SEED0100TKT0000000000005', '工单 T20260618005 标记为异常',
   '工单 T20260618005(客户:刘洋)的黑色风衣袖口发现新污渍,需要店长确认处理方式。', 'zh-CN', NULL, 'high', 'ticket:01SEED0100TKT0000000000005:exception',
   '01KRERJN8F0000000000000032', '2026-06-17 16:00:00+08'),
  ('01SEED0100N0T0000000000003', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   NULL, NULL, '钱箱现金不足',
   '当前钱箱现金余额低于预警阈值,请安排补充。', 'zh-CN', NULL, 'high', 'pos:low_cash:2026-06-18',
   '01KRERJN8F0000000000000031', '2026-06-18 09:15:00+08'),
  ('01SEED0100N0T0000000000004', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   NULL, NULL, '店长广播:下午新流程培训',
   '今天 15:00 在会议室进行 POS 新流程培训,请所有当班店员参加。', 'zh-CN', NULL, 'normal', 'pos:broadcast:training:2026-06-17',
   '01KRERJN8B0000000000000012', '2026-06-17 14:20:00+08'),
  ('01SEED0100N0T0000000000005', NULL, 'saas', 'system', NULL, NULL,
   NULL, NULL, '系统将于今晚维护',
   '系统将于今晚 23:00 至次日 02:00 进行维护升级,期间 POS 端无法使用,请提前安排工作。', 'zh-CN', NULL, 'critical', 'system:maintenance:2026-06-17',
   '01KRERJN880000000000000009', '2026-06-17 11:00:00+08'),
  ('01SEED0100N0T0000000000006', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'order', '01SEED01000RD0000000000007', '零售订单已完成支付',
   '织物除味剂的零售订单已完成支付,金额 12 元。', 'zh-CN', NULL, 'low', 'order:01SEED01000RD0000000000007:paid',
   '01KRERJN8F0000000000000031', '2026-06-18 10:20:00+08')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  locale = EXCLUDED.locale,
  priority = EXCLUDED.priority,
  notice_type = EXCLUDED.notice_type,
  scope = EXCLUDED.scope,
  related_type = EXCLUDED.related_type,
  related_id = EXCLUDED.related_id,
  updated_at = now();

INSERT INTO notification_deliveries (
  id, tenant_id, notification_id, channel, recipient_type, recipient_id,
  sender_type, sender_id, status, read_status, priority, sent_at, read_at, created_by, created_at
)
VALUES
  ('01SEED0100DKV0000000000001', '01KRERJN800000000000000001', '01SEED0100N0T0000000000001', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'unread', 'normal', '2026-06-17 10:30:00+08', NULL, '01KRERJN8F0000000000000031', '2026-06-17 10:30:00+08'),
  ('01SEED0100DKV0000000000002', '01KRERJN800000000000000001', '01SEED0100N0T0000000000002', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'unread', 'high', '2026-06-17 16:00:00+08', NULL, '01KRERJN8F0000000000000032', '2026-06-17 16:00:00+08'),
  ('01SEED0100DKV0000000000003', '01KRERJN800000000000000001', '01SEED0100N0T0000000000003', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'unread', 'high', '2026-06-18 09:15:00+08', NULL, '01KRERJN8F0000000000000031', '2026-06-18 09:15:00+08'),
  ('01SEED0100DKV0000000000004', '01KRERJN800000000000000001', '01SEED0100N0T0000000000004', 'pos', 'user', '01KRERJN8F0000000000000031',
   'user', '01KRERJN8B0000000000000012', 'sent', 'read', 'normal', '2026-06-17 14:20:00+08', '2026-06-17 16:30:00+08', '01KRERJN8B0000000000000012', '2026-06-17 14:20:00+08'),
  ('01SEED0100DKV0000000000005', NULL, '01SEED0100N0T0000000000005', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'read', 'critical', '2026-06-17 11:00:00+08', '2026-06-17 11:05:00+08', '01KRERJN880000000000000009', '2026-06-17 11:00:00+08'),
  ('01SEED0100DKV0000000000006', '01KRERJN800000000000000001', '01SEED0100N0T0000000000006', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'archived', 'low', '2026-06-18 10:20:00+08', '2026-06-18 10:25:00+08', '01KRERJN8F0000000000000031', '2026-06-18 10:20:00+08')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  read_status = EXCLUDED.read_status,
  priority = EXCLUDED.priority,
  sent_at = EXCLUDED.sent_at,
  read_at = EXCLUDED.read_at,
  updated_at = now();

-- ───────────────────────────────────────────────
-- 12) Additional POS demo data for richer dashboards
-- These rows are intentionally dated around 2026-07-08 so the POS home page
-- has non-empty today metrics and recent activity after a fresh seed.
-- ───────────────────────────────────────────────

INSERT INTO customer_accounts (id, tenant_id, account_name, phone, email, status, created_at)
VALUES
  ('01SEED0100ACC0000000000006', '01KRERJN800000000000000001', '陈晨家庭账户', '13800000006', 'chen.chen@example.com', 'active', '2026-07-08 09:05:00+08'),
  ('01SEED0100ACC0000000000007', '01KRERJN800000000000000001', '赵敏账户',     '13800000007', 'zhao.min@example.com',   'active', '2026-07-08 09:32:00+08'),
  ('01SEED0100ACC0000000000008', '01KRERJN800000000000000001', '周杰账户',     '13800000008', NULL,                    'active', '2026-07-08 10:15:00+08'),
  ('01SEED0100ACC0000000000009', '01KRERJN800000000000000001', '孙怡家庭账户', '13800000009', 'sun.yi@example.com',     'active', '2026-07-08 11:20:00+08'),
  ('01SEED0100ACC0000000000010', '01KRERJN800000000000000001', '吴迪账户',     '13800000010', 'wu.di@example.com',      'active', '2026-07-08 12:10:00+08')
ON CONFLICT (id) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO customers (id, customer_account_id, tenant_id, full_name, phone, email, relationship, address, notes, status, created_at)
VALUES
  ('01SEED0100CPS0000000000009', '01SEED0100ACC0000000000006', '01KRERJN800000000000000001', '陈晨',   '13800000006', 'chen.chen@example.com', '本人', '上海市黄浦区北京东路 66 号', '偏好短信通知', 'active', '2026-07-08 09:05:00+08'),
  ('01SEED0100CPS0000000000010', '01SEED0100ACC0000000000006', '01KRERJN800000000000000001', '陈小雨', '13800000061', NULL,                   '家人', '上海市黄浦区北京东路 66 号', NULL, 'active', '2026-07-08 09:08:00+08'),
  ('01SEED0100CPS0000000000011', '01SEED0100ACC0000000000007', '01KRERJN800000000000000001', '赵敏',   '13800000007', 'zhao.min@example.com', '本人', '上海市浦东新区花木路 188 号', '高频洗衣客户', 'active', '2026-07-08 09:32:00+08'),
  ('01SEED0100CPS0000000000012', '01SEED0100ACC0000000000008', '01KRERJN800000000000000001', '周杰',   '13800000008', NULL,                   '本人', '上海市静安区万航渡路 99 号', '车辆洗护客户', 'active', '2026-07-08 10:15:00+08'),
  ('01SEED0100CPS0000000000013', '01SEED0100ACC0000000000009', '01KRERJN800000000000000001', '孙怡',   '13800000009', 'sun.yi@example.com',   '本人', '上海市徐汇区衡山路 200 号', NULL, 'active', '2026-07-08 11:20:00+08'),
  ('01SEED0100CPS0000000000014', '01SEED0100ACC0000000000010', '01KRERJN800000000000000001', '吴迪',   '13800000010', 'wu.di@example.com',    '本人', '上海市长宁区天山路 88 号', '现金付款', 'active', '2026-07-08 12:10:00+08')
ON CONFLICT (id) DO UPDATE SET
  customer_account_id = EXCLUDED.customer_account_id,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  relationship = EXCLUDED.relationship,
  address = EXCLUDED.address,
  notes = EXCLUDED.notes,
  status = EXCLUDED.status,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO service_tickets (
  id, tenant_id, branch_id, customer_id, assistant_id, ticket_no, ticket_type, ticket_status,
  expected_pickup_at, completed_at, cancelled_at, priority, remark, source_channel, created_by, created_at
)
VALUES
  ('01SEED0100TKT0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000009', '01KRERJN8F0000000000000031', 'T20260708001', 'laundry', 'pending',
   '2026-07-09 18:00:00+08', NULL, NULL, 'normal', '今日新客,普通水洗', 'pos',
   '01KRERJN8F0000000000000031', '2026-07-08 09:12:00+08'),
  ('01SEED0100TKT0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000011', '01KRERJN8F0000000000000032', 'T20260708002', 'laundry', 'in_progress',
   '2026-07-10 18:00:00+08', NULL, NULL, 'urgent', '礼服加急护理', 'pos',
   '01KRERJN8F0000000000000032', '2026-07-08 09:45:00+08'),
  ('01SEED0100TKT0000000000011', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000012', '01KRERJN8F0000000000000031', 'T20260708003', 'car_wash', 'ready_to_pick',
   '2026-07-08 17:00:00+08', '2026-07-08 14:40:00+08', NULL, 'normal', '车辆已完成精洗,等待取车', 'pos',
   '01KRERJN8F0000000000000031', '2026-07-08 10:25:00+08'),
  ('01SEED0100TKT0000000000012', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000013', '01KRERJN8F0000000000000032', 'T20260708004', 'laundry', 'exception',
   '2026-07-09 12:00:00+08', NULL, NULL, 'critical', '丝绸裙摆污渍需要客户确认', 'phone',
   '01KRERJN8F0000000000000032', '2026-07-08 11:35:00+08'),
  ('01SEED0100TKT0000000000013', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000014', '01KRERJN8F0000000000000031', 'T20260708005', 'laundry', 'picked_up',
   '2026-07-08 13:30:00+08', '2026-07-08 13:05:00+08', NULL, 'normal', '客户已取件', 'pos',
   '01KRERJN8F0000000000000031', '2026-07-08 12:20:00+08'),
  ('01SEED0100TKT0000000000014', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000010', '01KRERJN8F0000000000000032', 'T20260708006', 'laundry', 'draft',
   NULL, NULL, NULL, 'normal', '亲子衣物待确认价格', 'pos',
   '01KRERJN8F0000000000000032', '2026-07-08 13:15:00+08')
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  assistant_id = EXCLUDED.assistant_id,
  ticket_no = EXCLUDED.ticket_no,
  ticket_type = EXCLUDED.ticket_type,
  ticket_status = EXCLUDED.ticket_status,
  expected_pickup_at = EXCLUDED.expected_pickup_at,
  completed_at = EXCLUDED.completed_at,
  cancelled_at = EXCLUDED.cancelled_at,
  priority = EXCLUDED.priority,
  remark = EXCLUDED.remark,
  source_channel = EXCLUDED.source_channel,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO ticket_items (
  id, ticket_id, tenant_id, branch_id, service_id,
  item_type, item_name, item_category, item_status, item_color, item_brand, item_material,
  quantity, unit_amount, line_amount, remark, defect_notes, special_request, label_code, sort_order
)
VALUES
  ('01SEED0100T1T000000000013', '01SEED0100TKT0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '蓝色衬衫', '上衣', 'washing', '蓝色', '海澜之家', '棉', 3, 15.00, 45.00, NULL, NULL, NULL, 'L-0013', 0),
  ('01SEED0100T1T000000000014', '01SEED0100TKT0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000003',
   'cloth', '浅灰夹克', '外套', 'washing', '浅灰', NULL, '聚酯纤维', 1, 25.00, 25.00, NULL, NULL, NULL, 'L-0014', 1),
  ('01SEED0100T1T000000000015', '01SEED0100TKT0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000002',
   'cloth', '黑色礼服', '礼服', 'washing', '黑色', NULL, '羊毛混纺', 1, 40.00, 40.00, NULL, NULL, '加急,单独包装', 'L-0015', 0),
  ('01SEED0100T1T000000000016', '01SEED0100TKT0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '白色衬衫', '上衣', 'washing', '白色', NULL, '棉', 2, 15.00, 30.00, NULL, NULL, NULL, 'L-0016', 1),
  ('01SEED0100T1T000000000017', '01SEED0100TKT0000000000011', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000006',
   'car', 'Tesla Model 3', NULL, 'ready_to_pick', '白色', 'Tesla', NULL, 1, 50.00, 50.00, '外观精洗', NULL, NULL, 'L-0017', 0),
  ('01SEED0100T1T000000000018', '01SEED0100TKT0000000000012', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000002',
   'cloth', '米白丝绸长裙', '裙装', 'exception', '米白', NULL, '丝绸', 1, 40.00, 40.00, NULL, '裙摆旧污渍扩散,需确认', '手洗', 'L-0018', 0),
  ('01SEED0100T1T000000000019', '01SEED0100TKT0000000000013', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000001',
   'cloth', '商务衬衫', '上衣', 'done', '白色', NULL, '棉', 2, 15.00, 30.00, NULL, NULL, NULL, 'L-0019', 0),
  ('01SEED0100T1T000000000020', '01SEED0100TKT0000000000014', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100SVC0000000000004',
   'cloth', '儿童床品', '床品', 'washing', '粉色', NULL, '棉', 2, 8.00, 16.00, NULL, NULL, NULL, 'L-0020', 0)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id,
  item_type = EXCLUDED.item_type,
  item_name = EXCLUDED.item_name,
  item_category = EXCLUDED.item_category,
  item_status = EXCLUDED.item_status,
  item_color = EXCLUDED.item_color,
  item_brand = EXCLUDED.item_brand,
  item_material = EXCLUDED.item_material,
  quantity = EXCLUDED.quantity,
  unit_amount = EXCLUDED.unit_amount,
  line_amount = EXCLUDED.line_amount,
  remark = EXCLUDED.remark,
  defect_notes = EXCLUDED.defect_notes,
  special_request = EXCLUDED.special_request,
  label_code = EXCLUDED.label_code,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO orders (
  id, tenant_id, branch_id, customer_id, order_type, status,
  subtotal_amount, discount_amount, total_amount, payment_status, paid_amount, paid_at, expire_at, notes, created_by, created_at
)
VALUES
  ('01SEED01000RD0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000009', 'ticket', 'received',
   70.00, 0.00, 70.00, 'unpaid', 0.00, NULL, '2026-07-09 18:00:00+08',
   '基于工单 T20260708001,今日未收款', '01KRERJN8F0000000000000031', '2026-07-08 09:15:00+08'),
  ('01SEED01000RD0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000011', 'ticket', 'paid',
   70.00, 0.00, 70.00, 'partial', 30.00, '2026-07-08 09:50:00+08', '2026-07-10 18:00:00+08',
   '基于工单 T20260708002,已收定金', '01KRERJN8F0000000000000032', '2026-07-08 09:50:00+08'),
  ('01SEED01000RD0000000000011', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000012', 'ticket', 'paid',
   50.00, 0.00, 50.00, 'paid', 50.00, '2026-07-08 10:30:00+08', '2026-07-08 17:00:00+08',
   '基于工单 T20260708003,车辆精洗', '01KRERJN8F0000000000000031', '2026-07-08 10:30:00+08'),
  ('01SEED01000RD0000000000012', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000013', 'ticket', 'received',
   40.00, 0.00, 40.00, 'unpaid', 0.00, NULL, '2026-07-09 12:00:00+08',
   '基于工单 T20260708004,异常确认后付款', '01KRERJN8F0000000000000032', '2026-07-08 11:40:00+08'),
  ('01SEED01000RD0000000000013', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000014', 'ticket', 'delivered',
   30.00, 0.00, 30.00, 'paid', 30.00, '2026-07-08 12:35:00+08', '2026-07-08 13:30:00+08',
   '基于工单 T20260708005,现金已结清', '01KRERJN8F0000000000000031', '2026-07-08 12:30:00+08'),
  ('01SEED01000RD0000000000014', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040',
   '01SEED0100CPS0000000000010', 'manual', 'paid',
   12.00, 0.00, 12.00, 'paid', 12.00, '2026-07-08 13:25:00+08', '2026-07-09 18:00:00+08',
   '零售:织物除味剂', '01KRERJN8F0000000000000032', '2026-07-08 13:20:00+08')
ON CONFLICT (id) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  order_type = EXCLUDED.order_type,
  status = EXCLUDED.status,
  subtotal_amount = EXCLUDED.subtotal_amount,
  discount_amount = EXCLUDED.discount_amount,
  total_amount = EXCLUDED.total_amount,
  payment_status = EXCLUDED.payment_status,
  paid_amount = EXCLUDED.paid_amount,
  paid_at = EXCLUDED.paid_at,
  expire_at = EXCLUDED.expire_at,
  notes = EXCLUDED.notes,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO order_items (
  id, order_id, ticket_id, tenant_id, branch_id, customer_id,
  source_type, source_id, item_name, quantity, unit_amount, line_amount
)
VALUES
  ('01SEED010001T000000000014', '01SEED01000RD0000000000009', '01SEED0100TKT0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000009',
   'ticket_item', '01SEED0100T1T000000000013', '蓝色衬衫', 3, 15.00, 45.00),
  ('01SEED010001T000000000015', '01SEED01000RD0000000000009', '01SEED0100TKT0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000009',
   'ticket_item', '01SEED0100T1T000000000014', '浅灰夹克', 1, 25.00, 25.00),
  ('01SEED010001T000000000016', '01SEED01000RD0000000000010', '01SEED0100TKT0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000011',
   'ticket_item', '01SEED0100T1T000000000015', '黑色礼服', 1, 40.00, 40.00),
  ('01SEED010001T000000000017', '01SEED01000RD0000000000010', '01SEED0100TKT0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000011',
   'ticket_item', '01SEED0100T1T000000000016', '白色衬衫', 2, 15.00, 30.00),
  ('01SEED010001T000000000018', '01SEED01000RD0000000000011', '01SEED0100TKT0000000000011', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000012',
   'ticket_item', '01SEED0100T1T000000000017', 'Tesla Model 3', 1, 50.00, 50.00),
  ('01SEED010001T000000000019', '01SEED01000RD0000000000012', '01SEED0100TKT0000000000012', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000013',
   'ticket_item', '01SEED0100T1T000000000018', '米白丝绸长裙', 1, 40.00, 40.00),
  ('01SEED010001T000000000020', '01SEED01000RD0000000000013', '01SEED0100TKT0000000000013', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000014',
   'ticket_item', '01SEED0100T1T000000000019', '商务衬衫', 2, 15.00, 30.00),
  ('01SEED010001T000000000021', '01SEED01000RD0000000000014', NULL, '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000010',
   'product', '01SEED0100SVC0000000000008', '织物除味剂', 1, 12.00, 12.00)
ON CONFLICT (id) DO UPDATE SET
  ticket_id = EXCLUDED.ticket_id,
  source_type = EXCLUDED.source_type,
  source_id = EXCLUDED.source_id,
  item_name = EXCLUDED.item_name,
  quantity = EXCLUDED.quantity,
  unit_amount = EXCLUDED.unit_amount,
  line_amount = EXCLUDED.line_amount,
  updated_at = now();

-- Keep the legacy seed rows semantically compatible with the product domain:
-- the old `product` source rows still point to service records and therefore
-- remain service-kind rows until an explicit service-to-SKU mapping is approved.
UPDATE order_items
SET item_kind = CASE source_type
  WHEN 'subscription' THEN 'subscription'::order_item_kind
  WHEN 'delivery_fee' THEN 'delivery_fee'::order_item_kind
  ELSE 'service'::order_item_kind
END
WHERE id LIKE '01SEED010001T%';

UPDATE order_items AS oi
SET service_id = ti.service_id
FROM ticket_items AS ti
WHERE oi.id LIKE '01SEED010001T%'
  AND oi.source_type = 'ticket_item'
  AND oi.source_id = ti.id
  AND oi.tenant_id = ti.tenant_id
  AND oi.ticket_id = ti.ticket_id
  AND oi.service_id IS NULL
  AND ti.service_id IS NOT NULL;

UPDATE order_items AS oi
SET service_id = s.id
FROM services AS s
WHERE oi.id LIKE '01SEED010001T%'
  AND oi.source_type = 'product'
  AND oi.source_id = s.id
  AND oi.tenant_id = s.tenant_id
  AND oi.service_id IS NULL;

INSERT INTO payment_transactions (
  id, tenant_id, branch_id, customer_id, order_id,
  payment_method, amount, payment_status, paid_at, created_by, created_at
)
VALUES
  ('01SEED0100PTX0000000000007', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000011', '01SEED01000RD0000000000010',
   'cash', 30.00, 'paid', '2026-07-08 09:50:00+08', '01KRERJN8F0000000000000032', '2026-07-08 09:50:00+08'),
  ('01SEED0100PTX0000000000008', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000012', '01SEED01000RD0000000000011',
   'card', 50.00, 'paid', '2026-07-08 10:30:00+08', '01KRERJN8F0000000000000031', '2026-07-08 10:30:00+08'),
  ('01SEED0100PTX0000000000009', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000014', '01SEED01000RD0000000000013',
   'cash', 30.00, 'paid', '2026-07-08 12:35:00+08', '01KRERJN8F0000000000000031', '2026-07-08 12:35:00+08'),
  ('01SEED0100PTX0000000000010', '01KRERJN800000000000000001', '01KRERJN8G0000000000000040', '01SEED0100CPS0000000000010', '01SEED01000RD0000000000014',
   'app', 12.00, 'paid', '2026-07-08 13:25:00+08', '01KRERJN8F0000000000000032', '2026-07-08 13:25:00+08')
ON CONFLICT (id) DO UPDATE SET
  payment_method = EXCLUDED.payment_method,
  amount = EXCLUDED.amount,
  payment_status = EXCLUDED.payment_status,
  paid_at = EXCLUDED.paid_at,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO notifications (
  id, tenant_id, scope, notice_type, config_id, template_id,
  related_type, related_id, title, content, locale, payload, priority, idempotency_key, created_by, created_at
)
VALUES
  ('01SEED0100N0T0000000000007', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'ticket', '01SEED0100TKT0000000000011', '工单 T20260708003 已可取件',
   '工单 T20260708003(客户:周杰)的车辆精洗已完成,等待客户取车。', 'zh-CN', NULL, 'normal', 'ticket:01SEED0100TKT0000000000011:ready_to_pick',
   '01KRERJN8F0000000000000031', '2026-07-08 14:45:00+08'),
  ('01SEED0100N0T0000000000008', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'ticket', '01SEED0100TKT0000000000012', '工单 T20260708004 需要确认',
   '工单 T20260708004(客户:孙怡)的丝绸长裙出现异常,请联系客户确认处理方式。', 'zh-CN', NULL, 'critical', 'ticket:01SEED0100TKT0000000000012:exception',
   '01KRERJN8F0000000000000032', '2026-07-08 11:50:00+08'),
  ('01SEED0100N0T0000000000009', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'order', '01SEED01000RD0000000000009', '订单 T20260708001 待收款',
   '陈晨的今日订单尚未收款,请在取件前结清。', 'zh-CN', NULL, 'high', 'order:01SEED01000RD0000000000009:unpaid',
   '01KRERJN8F0000000000000031', '2026-07-08 09:20:00+08'),
  ('01SEED0100N0T0000000000010', '01KRERJN800000000000000001', 'pos', 'business', NULL, NULL,
   'order', '01SEED01000RD0000000000013', '现金收款已完成',
   '吴迪的订单已完成现金收款并交付。', 'zh-CN', NULL, 'low', 'order:01SEED01000RD0000000000013:paid',
   '01KRERJN8F0000000000000031', '2026-07-08 12:40:00+08')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  locale = EXCLUDED.locale,
  priority = EXCLUDED.priority,
  notice_type = EXCLUDED.notice_type,
  scope = EXCLUDED.scope,
  related_type = EXCLUDED.related_type,
  related_id = EXCLUDED.related_id,
  created_at = EXCLUDED.created_at,
  updated_at = now();

INSERT INTO notification_deliveries (
  id, tenant_id, notification_id, channel, recipient_type, recipient_id,
  sender_type, sender_id, status, read_status, priority, sent_at, read_at, created_by, created_at
)
VALUES
  ('01SEED0100DKV0000000000007', '01KRERJN800000000000000001', '01SEED0100N0T0000000000007', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'unread', 'normal', '2026-07-08 14:45:00+08', NULL, '01KRERJN8F0000000000000031', '2026-07-08 14:45:00+08'),
  ('01SEED0100DKV0000000000008', '01KRERJN800000000000000001', '01SEED0100N0T0000000000008', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'unread', 'critical', '2026-07-08 11:50:00+08', NULL, '01KRERJN8F0000000000000032', '2026-07-08 11:50:00+08'),
  ('01SEED0100DKV0000000000009', '01KRERJN800000000000000001', '01SEED0100N0T0000000000009', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'unread', 'high', '2026-07-08 09:20:00+08', NULL, '01KRERJN8F0000000000000031', '2026-07-08 09:20:00+08'),
  ('01SEED0100DKV0000000000010', '01KRERJN800000000000000001', '01SEED0100N0T0000000000010', 'pos', 'user', '01KRERJN8F0000000000000031',
   'system', NULL, 'sent', 'read', 'low', '2026-07-08 12:40:00+08', '2026-07-08 12:45:00+08', '01KRERJN8F0000000000000031', '2026-07-08 12:40:00+08')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  read_status = EXCLUDED.read_status,
  priority = EXCLUDED.priority,
  sent_at = EXCLUDED.sent_at,
  read_at = EXCLUDED.read_at,
  created_at = EXCLUDED.created_at,
  updated_at = now();

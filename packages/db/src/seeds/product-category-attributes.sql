-- PRD-aligned retail product categories and category metafields for Demo Tenant 1.
--
-- Run AFTER pos-business-data.sql. That seed creates the CLEAN-001 feature-flag
-- row and currently resets retail_products_enabled, so this seed enables retail
-- products again before inserting the catalog metadata.
--
-- Scope:
--   tenant : 01KRERJN800000000000000001 (CLEAN-001)
--   actor  : 01KRERJN8B0000000000000012 (tenant.admin1@cleanhub.local)
--
-- The PRD explicitly covers retail sales of detergent, hangers, laundry bags,
-- vehicle fragrance, packaging consumables, receipt paper, garment labels,
-- finished-item stickers and A4 invoices. SKU, barcode, price and inventory
-- fields are deliberately omitted because they already belong to the core
-- product/SKU/inventory model.
-- The PRD does not enumerate scents, materials, forms, sizes or similar option
-- values; those candidates are conservative laundry/retail industry defaults.
--
-- Idempotency:
--   * stable, deterministic 26-character seed ULIDs;
--   * upserts use each table's active natural key and the matching partial-index
--     predicate;
--   * definitions and options resolve their parents through natural-key joins.

BEGIN;

UPDATE tenant_feature_flags
SET
  retail_products_enabled = TRUE,
  updated_by = '01KRERJN8B0000000000000012',
  updated_at = now(),
  version = version + 1
WHERE tenant_id = '01KRERJN800000000000000001'
  AND retail_products_enabled IS DISTINCT FROM TRUE;

WITH seed_categories(seed_order, code, name, sort_order) AS (
  VALUES
    (1, 'laundry_care', '洗护用品', 10),
    (2, 'hangers', '衣架', 20),
    (3, 'laundry_bags', '洗衣袋', 30),
    (4, 'car_fragrances', '车载香氛', 40),
    (5, 'packaging_supplies', '包装耗材', 50),
    (6, 'label_printing_supplies', '标签打印耗材', 60),
    (7, 'other_retail', '其他零售商品', 70)
)
INSERT INTO product_categories (
  id,
  tenant_id,
  parent_id,
  name,
  code,
  sort_order,
  status,
  created_by,
  updated_by
)
SELECT
  '01SEED0300CAT' || lpad(seed_order::text, 13, '0'),
  '01KRERJN800000000000000001',
  NULL,
  name,
  code,
  sort_order,
  'active',
  '01KRERJN8B0000000000000012',
  '01KRERJN8B0000000000000012'
FROM seed_categories
ON CONFLICT (tenant_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL
DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_by = EXCLUDED.updated_by,
  updated_at = now(),
  version = product_categories.version + 1
WHERE (
  product_categories.parent_id,
  product_categories.name,
  product_categories.sort_order,
  product_categories.status
) IS DISTINCT FROM (
  EXCLUDED.parent_id,
  EXCLUDED.name,
  EXCLUDED.sort_order,
  EXCLUDED.status
);

WITH seed_definitions(
  seed_order,
  category_code,
  code,
  name,
  value_type,
  sort_order
) AS (
  VALUES
    (1, 'laundry_care', 'product_type', '产品类型', 'single_select', 10),
    (2, 'laundry_care', 'form', '产品形态', 'single_select', 20),
    (3, 'laundry_care', 'scent', '香型', 'single_select', 30),
    (4, 'laundry_care', 'fabric_suitability', '适用面料', 'multi_select', 40),
    (5, 'laundry_care', 'color_suitability', '适用衣物颜色', 'multi_select', 50),
    (6, 'laundry_care', 'net_content', '净含量', 'text', 60),
    (7, 'laundry_care', 'usage_instructions', '使用说明', 'text', 70),

    (8, 'hangers', 'hanger_type', '衣架类型', 'single_select', 10),
    (9, 'hangers', 'material', '材质', 'multi_select', 20),
    (10, 'hangers', 'color', '颜色', 'multi_select', 30),
    (11, 'hangers', 'size', '尺寸规格', 'single_select', 40),
    (12, 'hangers', 'features', '功能特点', 'multi_select', 50),
    (13, 'hangers', 'pack_quantity', '包装数量', 'text', 60),

    (14, 'laundry_bags', 'bag_type', '洗衣袋类型', 'single_select', 10),
    (15, 'laundry_bags', 'material', '材质', 'multi_select', 20),
    (16, 'laundry_bags', 'closure', '封口方式', 'single_select', 30),
    (17, 'laundry_bags', 'size', '尺寸规格', 'single_select', 40),
    (18, 'laundry_bags', 'color', '颜色', 'multi_select', 50),
    (19, 'laundry_bags', 'capacity', '容量', 'text', 60),
    (20, 'laundry_bags', 'pack_quantity', '包装数量', 'text', 70),

    (21, 'car_fragrances', 'fragrance_form', '香氛形态', 'single_select', 10),
    (22, 'car_fragrances', 'scent', '香型', 'single_select', 20),
    (23, 'car_fragrances', 'duration', '留香时长', 'text', 30),
    (24, 'car_fragrances', 'volume', '容量', 'text', 40),
    (25, 'car_fragrances', 'refillable', '是否可补充', 'single_select', 50),

    (26, 'packaging_supplies', 'packaging_type', '包装类型', 'single_select', 10),
    (27, 'packaging_supplies', 'material', '材质', 'multi_select', 20),
    (28, 'packaging_supplies', 'transparency', '透明度', 'single_select', 30),
    (29, 'packaging_supplies', 'closure', '封口方式', 'single_select', 40),
    (30, 'packaging_supplies', 'dimensions', '尺寸', 'text', 50),
    (31, 'packaging_supplies', 'thickness', '厚度', 'text', 60),
    (32, 'packaging_supplies', 'pack_quantity', '包装数量', 'text', 70),
    (33, 'packaging_supplies', 'color', '颜色', 'multi_select', 80),

    (34, 'label_printing_supplies', 'supply_type', '耗材类型', 'single_select', 10),
    (35, 'label_printing_supplies', 'print_method', '打印方式', 'single_select', 20),
    (36, 'label_printing_supplies', 'format', '规格格式', 'single_select', 30),
    (37, 'label_printing_supplies', 'adhesive', '粘胶类型', 'single_select', 40),
    (38, 'label_printing_supplies', 'color', '颜色', 'single_select', 50),
    (39, 'label_printing_supplies', 'dimensions', '尺寸', 'text', 60),
    (40, 'label_printing_supplies', 'roll_length_or_quantity', '卷长或数量', 'text', 70),
    (41, 'label_printing_supplies', 'printer_compatibility', '适用打印机', 'text', 80),

    (42, 'other_retail', 'color', '颜色', 'multi_select', 10),
    (43, 'other_retail', 'material', '材质', 'multi_select', 20),
    (44, 'other_retail', 'dimensions', '尺寸', 'text', 30)
)
INSERT INTO product_category_attribute_definitions (
  id,
  tenant_id,
  category_id,
  code,
  name,
  value_type,
  required,
  sort_order,
  status,
  created_by,
  updated_by
)
SELECT
  '01SEED0300DEF' || lpad(seed_definitions.seed_order::text, 13, '0'),
  '01KRERJN800000000000000001',
  product_categories.id,
  seed_definitions.code,
  seed_definitions.name,
  seed_definitions.value_type::product_category_attribute_value_type,
  FALSE,
  seed_definitions.sort_order,
  'active',
  '01KRERJN8B0000000000000012',
  '01KRERJN8B0000000000000012'
FROM seed_definitions
JOIN product_categories
  ON product_categories.tenant_id = '01KRERJN800000000000000001'
 AND product_categories.code = seed_definitions.category_code
 AND product_categories.deleted_at IS NULL
ON CONFLICT (tenant_id, category_id, code)
  WHERE deleted_at IS NULL
DO UPDATE SET
  name = EXCLUDED.name,
  value_type = EXCLUDED.value_type,
  required = EXCLUDED.required,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_by = EXCLUDED.updated_by,
  updated_at = now(),
  version = product_category_attribute_definitions.version + 1
WHERE (
  product_category_attribute_definitions.name,
  product_category_attribute_definitions.value_type,
  product_category_attribute_definitions.required,
  product_category_attribute_definitions.sort_order,
  product_category_attribute_definitions.status
) IS DISTINCT FROM (
  EXCLUDED.name,
  EXCLUDED.value_type,
  EXCLUDED.required,
  EXCLUDED.sort_order,
  EXCLUDED.status
);

WITH seed_options(
  seed_order,
  category_code,
  definition_code,
  code,
  label,
  sort_order
) AS (
  VALUES
    (1, 'laundry_care', 'product_type', 'laundry_detergent', '洗涤剂', 10),
    (2, 'laundry_care', 'product_type', 'fabric_softener', '衣物柔顺剂', 20),
    (3, 'laundry_care', 'product_type', 'stain_remover', '去渍剂', 30),
    (4, 'laundry_care', 'product_type', 'bleach', '漂白剂', 40),
    (5, 'laundry_care', 'product_type', 'laundry_disinfectant', '衣物消毒剂', 50),
    (6, 'laundry_care', 'product_type', 'fabric_deodorizer', '织物除味剂', 60),
    (7, 'laundry_care', 'product_type', 'fragrance_booster', '留香珠', 70),
    (8, 'laundry_care', 'product_type', 'other', '其他', 80),
    (9, 'laundry_care', 'form', 'liquid', '液体', 10),
    (10, 'laundry_care', 'form', 'powder', '粉末', 20),
    (11, 'laundry_care', 'form', 'gel', '凝胶', 30),
    (12, 'laundry_care', 'form', 'capsule', '凝珠', 40),
    (13, 'laundry_care', 'form', 'tablet', '片剂', 50),
    (14, 'laundry_care', 'form', 'spray', '喷雾', 60),
    (15, 'laundry_care', 'form', 'solid', '固体', 70),
    (16, 'laundry_care', 'scent', 'unscented', '无香', 10),
    (17, 'laundry_care', 'scent', 'fresh', '清新', 20),
    (18, 'laundry_care', 'scent', 'floral', '花香', 30),
    (19, 'laundry_care', 'scent', 'lavender', '薰衣草', 40),
    (20, 'laundry_care', 'scent', 'citrus', '柑橘', 50),
    (21, 'laundry_care', 'scent', 'fruity', '果香', 60),
    (22, 'laundry_care', 'scent', 'ocean', '海洋', 70),
    (23, 'laundry_care', 'scent', 'woody', '木质香', 80),
    (24, 'laundry_care', 'scent', 'other', '其他', 90),
    (25, 'laundry_care', 'fabric_suitability', 'all_fabrics', '所有面料', 10),
    (26, 'laundry_care', 'fabric_suitability', 'cotton', '棉', 20),
    (27, 'laundry_care', 'fabric_suitability', 'linen', '亚麻', 30),
    (28, 'laundry_care', 'fabric_suitability', 'wool', '羊毛', 40),
    (29, 'laundry_care', 'fabric_suitability', 'silk', '丝绸', 50),
    (30, 'laundry_care', 'fabric_suitability', 'synthetic', '合成纤维', 60),
    (31, 'laundry_care', 'fabric_suitability', 'denim', '牛仔布', 70),
    (32, 'laundry_care', 'fabric_suitability', 'delicate', '精细面料', 80),
    (33, 'laundry_care', 'color_suitability', 'all_colors', '所有颜色', 10),
    (34, 'laundry_care', 'color_suitability', 'whites', '白色衣物', 20),
    (35, 'laundry_care', 'color_suitability', 'colors', '彩色衣物', 30),
    (36, 'laundry_care', 'color_suitability', 'darks', '深色衣物', 40),

    (37, 'hangers', 'hanger_type', 'standard', '标准衣架', 10),
    (38, 'hangers', 'hanger_type', 'shirt', '衬衫衣架', 20),
    (39, 'hangers', 'hanger_type', 'suit', '西装衣架', 30),
    (40, 'hangers', 'hanger_type', 'coat', '大衣衣架', 40),
    (41, 'hangers', 'hanger_type', 'trouser', '裤架', 50),
    (42, 'hangers', 'hanger_type', 'skirt', '裙架', 60),
    (43, 'hangers', 'hanger_type', 'children', '儿童衣架', 70),
    (44, 'hangers', 'hanger_type', 'multi_layer', '多层衣架', 80),
    (45, 'hangers', 'material', 'plastic', '塑料', 10),
    (46, 'hangers', 'material', 'wood', '木质', 20),
    (47, 'hangers', 'material', 'metal', '金属', 30),
    (48, 'hangers', 'material', 'velvet', '植绒', 40),
    (49, 'hangers', 'material', 'foam', '海绵', 50),
    (50, 'hangers', 'color', 'black', '黑色', 10),
    (51, 'hangers', 'color', 'white', '白色', 20),
    (52, 'hangers', 'color', 'gray', '灰色', 30),
    (53, 'hangers', 'color', 'blue', '蓝色', 40),
    (54, 'hangers', 'color', 'pink', '粉色', 50),
    (55, 'hangers', 'color', 'brown', '棕色', 60),
    (56, 'hangers', 'color', 'beige', '米色', 70),
    (57, 'hangers', 'color', 'multicolor', '多色', 80),
    (58, 'hangers', 'size', 'children', '儿童款', 10),
    (59, 'hangers', 'size', 'standard', '标准款', 20),
    (60, 'hangers', 'size', 'extra_wide', '加宽款', 30),
    (61, 'hangers', 'features', 'non_slip', '防滑', 10),
    (62, 'hangers', 'features', 'clips', '带夹子', 20),
    (63, 'hangers', 'features', 'swivel_hook', '旋转挂钩', 30),
    (64, 'hangers', 'features', 'foldable', '可折叠', 40),
    (65, 'hangers', 'features', 'padded', '加厚肩垫', 50),

    (66, 'laundry_bags', 'bag_type', 'wash_bag', '机洗洗衣袋', 10),
    (67, 'laundry_bags', 'bag_type', 'laundry_storage', '待洗衣物收纳袋', 20),
    (68, 'laundry_bags', 'bag_type', 'garment_bag', '衣物防尘袋', 30),
    (69, 'laundry_bags', 'bag_type', 'delivery_bag', '衣物配送袋', 40),
    (70, 'laundry_bags', 'material', 'mesh', '网眼布', 10),
    (71, 'laundry_bags', 'material', 'cotton', '棉', 20),
    (72, 'laundry_bags', 'material', 'polyester', '聚酯纤维', 30),
    (73, 'laundry_bags', 'material', 'nylon', '尼龙', 40),
    (74, 'laundry_bags', 'material', 'non_woven', '无纺布', 50),
    (75, 'laundry_bags', 'material', 'plastic', '塑料', 60),
    (76, 'laundry_bags', 'closure', 'zipper', '拉链', 10),
    (77, 'laundry_bags', 'closure', 'drawstring', '抽绳', 20),
    (78, 'laundry_bags', 'closure', 'hook_loop', '魔术贴', 30),
    (79, 'laundry_bags', 'closure', 'self_seal', '自封', 40),
    (80, 'laundry_bags', 'closure', 'open_top', '敞口', 50),
    (81, 'laundry_bags', 'size', 'small', '小号', 10),
    (82, 'laundry_bags', 'size', 'medium', '中号', 20),
    (83, 'laundry_bags', 'size', 'large', '大号', 30),
    (84, 'laundry_bags', 'size', 'extra_large', '特大号', 40),
    (85, 'laundry_bags', 'color', 'black', '黑色', 10),
    (86, 'laundry_bags', 'color', 'white', '白色', 20),
    (87, 'laundry_bags', 'color', 'gray', '灰色', 30),
    (88, 'laundry_bags', 'color', 'blue', '蓝色', 40),
    (89, 'laundry_bags', 'color', 'pink', '粉色', 50),
    (90, 'laundry_bags', 'color', 'brown', '棕色', 60),
    (91, 'laundry_bags', 'color', 'beige', '米色', 70),
    (92, 'laundry_bags', 'color', 'multicolor', '多色', 80),

    (93, 'car_fragrances', 'fragrance_form', 'hanging', '悬挂式', 10),
    (94, 'car_fragrances', 'fragrance_form', 'vent_clip', '出风口夹式', 20),
    (95, 'car_fragrances', 'fragrance_form', 'gel', '凝胶', 30),
    (96, 'car_fragrances', 'fragrance_form', 'spray', '喷雾', 40),
    (97, 'car_fragrances', 'fragrance_form', 'diffuser', '扩香器', 50),
    (98, 'car_fragrances', 'fragrance_form', 'can', '香膏罐', 60),
    (99, 'car_fragrances', 'fragrance_form', 'refill', '替换芯', 70),
    (100, 'car_fragrances', 'scent', 'fresh', '清新', 10),
    (101, 'car_fragrances', 'scent', 'floral', '花香', 20),
    (102, 'car_fragrances', 'scent', 'fruity', '果香', 30),
    (103, 'car_fragrances', 'scent', 'citrus', '柑橘', 40),
    (104, 'car_fragrances', 'scent', 'ocean', '海洋', 50),
    (105, 'car_fragrances', 'scent', 'woody', '木质香', 60),
    (106, 'car_fragrances', 'scent', 'vanilla', '香草', 70),
    (107, 'car_fragrances', 'scent', 'musk', '麝香', 80),
    (108, 'car_fragrances', 'scent', 'coffee', '咖啡', 90),
    (109, 'car_fragrances', 'scent', 'other', '其他', 100),
    (110, 'car_fragrances', 'refillable', 'yes', '是', 10),
    (111, 'car_fragrances', 'refillable', 'no', '否', 20),

    (112, 'packaging_supplies', 'packaging_type', 'packaging_bag', '包装袋', 10),
    (113, 'packaging_supplies', 'packaging_type', 'garment_cover', '衣物防尘罩', 20),
    (114, 'packaging_supplies', 'packaging_type', 'paper_bag', '纸袋', 30),
    (115, 'packaging_supplies', 'packaging_type', 'zip_bag', '自封袋', 40),
    (116, 'packaging_supplies', 'packaging_type', 'vacuum_bag', '真空袋', 50),
    (117, 'packaging_supplies', 'packaging_type', 'sealing_film', '封装膜', 60),
    (118, 'packaging_supplies', 'material', 'plastic', '塑料', 10),
    (119, 'packaging_supplies', 'material', 'paper', '纸', 20),
    (120, 'packaging_supplies', 'material', 'non_woven', '无纺布', 30),
    (121, 'packaging_supplies', 'material', 'biodegradable', '可生物降解材料', 40),
    (122, 'packaging_supplies', 'material', 'recycled', '再生材料', 50),
    (123, 'packaging_supplies', 'transparency', 'transparent', '透明', 10),
    (124, 'packaging_supplies', 'transparency', 'translucent', '半透明', 20),
    (125, 'packaging_supplies', 'transparency', 'opaque', '不透明', 30),
    (126, 'packaging_supplies', 'closure', 'open', '敞口', 10),
    (127, 'packaging_supplies', 'closure', 'self_seal', '自封', 20),
    (128, 'packaging_supplies', 'closure', 'zipper', '拉链', 30),
    (129, 'packaging_supplies', 'closure', 'drawstring', '抽绳', 40),
    (130, 'packaging_supplies', 'closure', 'heat_seal', '热封', 50),
    (131, 'packaging_supplies', 'color', 'black', '黑色', 10),
    (132, 'packaging_supplies', 'color', 'white', '白色', 20),
    (133, 'packaging_supplies', 'color', 'gray', '灰色', 30),
    (134, 'packaging_supplies', 'color', 'blue', '蓝色', 40),
    (135, 'packaging_supplies', 'color', 'pink', '粉色', 50),
    (136, 'packaging_supplies', 'color', 'brown', '棕色', 60),
    (137, 'packaging_supplies', 'color', 'beige', '米色', 70),
    (138, 'packaging_supplies', 'color', 'transparent', '透明', 80),
    (139, 'packaging_supplies', 'color', 'multicolor', '多色', 90),

    (140, 'label_printing_supplies', 'supply_type', 'receipt_roll', '小票纸卷', 10),
    (141, 'label_printing_supplies', 'supply_type', 'garment_label', '衣物标签', 20),
    (142, 'label_printing_supplies', 'supply_type', 'finished_product_sticker', '成品贴纸', 30),
    (143, 'label_printing_supplies', 'supply_type', 'a4_paper', 'A4 纸', 40),
    (144, 'label_printing_supplies', 'supply_type', 'barcode_label', '条码标签', 50),
    (145, 'label_printing_supplies', 'print_method', 'direct_thermal', '热敏打印', 10),
    (146, 'label_printing_supplies', 'print_method', 'thermal_transfer', '热转印', 20),
    (147, 'label_printing_supplies', 'print_method', 'impact_matrix', '针式打印', 30),
    (148, 'label_printing_supplies', 'print_method', 'inkjet', '喷墨打印', 40),
    (149, 'label_printing_supplies', 'print_method', 'laser', '激光打印', 50),
    (150, 'label_printing_supplies', 'format', 'width_80mm', '80 mm', 10),
    (151, 'label_printing_supplies', 'format', 'a4', 'A4', 20),
    (152, 'label_printing_supplies', 'format', 'custom', '自定义', 30),
    (153, 'label_printing_supplies', 'adhesive', 'none', '无粘胶', 10),
    (154, 'label_printing_supplies', 'adhesive', 'permanent', '永久胶', 20),
    (155, 'label_printing_supplies', 'adhesive', 'removable', '可移除胶', 30),
    (156, 'label_printing_supplies', 'color', 'white', '白色', 10),
    (157, 'label_printing_supplies', 'color', 'yellow', '黄色', 20),
    (158, 'label_printing_supplies', 'color', 'pink', '粉色', 30),
    (159, 'label_printing_supplies', 'color', 'blue', '蓝色', 40),
    (160, 'label_printing_supplies', 'color', 'green', '绿色', 50),

    (161, 'other_retail', 'color', 'black', '黑色', 10),
    (162, 'other_retail', 'color', 'white', '白色', 20),
    (163, 'other_retail', 'color', 'gray', '灰色', 30),
    (164, 'other_retail', 'color', 'red', '红色', 40),
    (165, 'other_retail', 'color', 'orange', '橙色', 50),
    (166, 'other_retail', 'color', 'yellow', '黄色', 60),
    (167, 'other_retail', 'color', 'green', '绿色', 70),
    (168, 'other_retail', 'color', 'blue', '蓝色', 80),
    (169, 'other_retail', 'color', 'purple', '紫色', 90),
    (170, 'other_retail', 'color', 'pink', '粉色', 100),
    (171, 'other_retail', 'color', 'brown', '棕色', 110),
    (172, 'other_retail', 'color', 'beige', '米色', 120),
    (173, 'other_retail', 'color', 'multicolor', '多色', 130),
    (174, 'other_retail', 'material', 'cotton', '棉', 10),
    (175, 'other_retail', 'material', 'polyester', '聚酯纤维', 20),
    (176, 'other_retail', 'material', 'wool', '羊毛', 30),
    (177, 'other_retail', 'material', 'silk', '丝绸', 40),
    (178, 'other_retail', 'material', 'linen', '亚麻', 50),
    (179, 'other_retail', 'material', 'leather', '真皮', 60),
    (180, 'other_retail', 'material', 'synthetic_leather', '人造革', 70),
    (181, 'other_retail', 'material', 'nylon', '尼龙', 80),
    (182, 'other_retail', 'material', 'canvas', '帆布', 90),
    (183, 'other_retail', 'material', 'denim', '牛仔布', 100),
    (184, 'other_retail', 'material', 'metal', '金属', 110),
    (185, 'other_retail', 'material', 'plastic', '塑料', 120),
    (186, 'other_retail', 'material', 'wood', '木材', 130),
    (187, 'other_retail', 'material', 'glass', '玻璃', 140),
    (188, 'other_retail', 'material', 'ceramic', '陶瓷', 150),
    (189, 'other_retail', 'material', 'paper', '纸', 160),
    (190, 'other_retail', 'material', 'non_woven', '无纺布', 170)
)
INSERT INTO product_category_attribute_options (
  id,
  tenant_id,
  definition_id,
  code,
  label,
  sort_order,
  status,
  created_by,
  updated_by
)
SELECT
  '01SEED0300PVX' || lpad(seed_options.seed_order::text, 13, '0'),
  '01KRERJN800000000000000001',
  product_category_attribute_definitions.id,
  seed_options.code,
  seed_options.label,
  seed_options.sort_order,
  'active',
  '01KRERJN8B0000000000000012',
  '01KRERJN8B0000000000000012'
FROM seed_options
JOIN product_categories
  ON product_categories.tenant_id = '01KRERJN800000000000000001'
 AND product_categories.code = seed_options.category_code
 AND product_categories.deleted_at IS NULL
JOIN product_category_attribute_definitions
  ON product_category_attribute_definitions.tenant_id =
       product_categories.tenant_id
 AND product_category_attribute_definitions.category_id =
       product_categories.id
 AND product_category_attribute_definitions.code =
       seed_options.definition_code
 AND product_category_attribute_definitions.deleted_at IS NULL
ON CONFLICT (tenant_id, definition_id, code)
  WHERE deleted_at IS NULL
DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_by = EXCLUDED.updated_by,
  updated_at = now(),
  version = product_category_attribute_options.version + 1
WHERE (
  product_category_attribute_options.label,
  product_category_attribute_options.sort_order,
  product_category_attribute_options.status
) IS DISTINCT FROM (
  EXCLUDED.label,
  EXCLUDED.sort_order,
  EXCLUDED.status
);

-- The runtime bootstrap previously created generic e-commerce categories.
-- Hide those from CLEAN-001 when they are not referenced by a live product.
-- Referenced categories remain untouched, and no historical row is deleted.
UPDATE product_categories AS category
SET
  status = 'inactive',
  updated_by = '01KRERJN8B0000000000000012',
  updated_at = now(),
  version = category.version + 1
WHERE category.tenant_id = '01KRERJN800000000000000001'
  AND category.code IN (
    'apparel',
    'footwear',
    'bags_accessories',
    'beauty_personal_care',
    'food_beverage',
    'electronics',
    'home_goods',
    'other'
  )
  AND category.deleted_at IS NULL
  AND category.status IS DISTINCT FROM 'inactive'
  AND NOT EXISTS (
    SELECT 1
    FROM products AS product
    WHERE product.tenant_id = category.tenant_id
      AND product.category_id = category.id
      AND product.deleted_at IS NULL
  );

COMMIT;

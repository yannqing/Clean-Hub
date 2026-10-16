import type { TenantProductCategoryAttributeValueType } from "./products.types.js";

type DefaultProductCategoryAttributeOption = {
  code: string;
  label: string;
  sortOrder: number;
};

type DefaultProductCategoryAttribute = {
  code: string;
  name: string;
  valueType: TenantProductCategoryAttributeValueType;
  required: boolean;
  sortOrder: number;
  options: DefaultProductCategoryAttributeOption[];
};

export type DefaultProductCategory = {
  code: string;
  name: string;
  sortOrder: number;
  attributes: DefaultProductCategoryAttribute[];
};

function options(
  values: ReadonlyArray<readonly [code: string, label: string]>,
): DefaultProductCategoryAttributeOption[] {
  return values.map(([code, label], index) => ({
    code,
    label,
    sortOrder: (index + 1) * 10,
  }));
}

const COLOR_OPTIONS = options([
  ["black", "黑色"],
  ["white", "白色"],
  ["gray", "灰色"],
  ["red", "红色"],
  ["orange", "橙色"],
  ["yellow", "黄色"],
  ["green", "绿色"],
  ["blue", "蓝色"],
  ["purple", "紫色"],
  ["pink", "粉色"],
  ["brown", "棕色"],
  ["beige", "米色"],
  ["multicolor", "多色"],
]);

function selectAttribute(input: {
  code: string;
  name: string;
  sortOrder: number;
  options: DefaultProductCategoryAttributeOption[];
  multiple?: boolean;
}): DefaultProductCategoryAttribute {
  return {
    code: input.code,
    name: input.name,
    valueType: input.multiple ? "multi_select" : "single_select",
    required: false,
    sortOrder: input.sortOrder,
    options: input.options,
  };
}

function textAttribute(
  code: string,
  name: string,
  sortOrder: number,
): DefaultProductCategoryAttribute {
  return {
    code,
    name,
    valueType: "text",
    required: false,
    sortOrder,
    options: [],
  };
}

export const DEFAULT_PRODUCT_CATEGORIES: DefaultProductCategory[] = [
  {
    code: "laundry_care",
    name: "洗护用品",
    sortOrder: 10,
    attributes: [
      selectAttribute({
        code: "product_type",
        name: "产品类型",
        sortOrder: 10,
        options: options([
          ["laundry_detergent", "洗涤剂"],
          ["fabric_softener", "衣物柔顺剂"],
          ["stain_remover", "去渍剂"],
          ["bleach", "漂白剂"],
          ["laundry_disinfectant", "衣物消毒剂"],
          ["fabric_deodorizer", "织物除味剂"],
          ["fragrance_booster", "留香珠"],
          ["other", "其他"],
        ]),
      }),
      selectAttribute({
        code: "form",
        name: "产品形态",
        sortOrder: 20,
        options: options([
          ["liquid", "液体"],
          ["powder", "粉末"],
          ["gel", "凝胶"],
          ["capsule", "凝珠"],
          ["tablet", "片剂"],
          ["spray", "喷雾"],
          ["solid", "固体"],
        ]),
      }),
      selectAttribute({
        code: "scent",
        name: "香型",
        sortOrder: 30,
        options: options([
          ["unscented", "无香"],
          ["fresh", "清新"],
          ["floral", "花香"],
          ["lavender", "薰衣草"],
          ["citrus", "柑橘"],
          ["fruity", "果香"],
          ["ocean", "海洋"],
          ["woody", "木质香"],
          ["other", "其他"],
        ]),
      }),
      selectAttribute({
        code: "fabric_suitability",
        name: "适用面料",
        sortOrder: 40,
        multiple: true,
        options: options([
          ["all_fabrics", "所有面料"],
          ["cotton", "棉"],
          ["linen", "亚麻"],
          ["wool", "羊毛"],
          ["silk", "丝绸"],
          ["synthetic", "合成纤维"],
          ["denim", "牛仔布"],
          ["delicate", "精细面料"],
        ]),
      }),
      selectAttribute({
        code: "color_suitability",
        name: "适用衣物颜色",
        sortOrder: 50,
        multiple: true,
        options: options([
          ["all_colors", "所有颜色"],
          ["whites", "白色衣物"],
          ["colors", "彩色衣物"],
          ["darks", "深色衣物"],
        ]),
      }),
      textAttribute("net_content", "净含量", 60),
      textAttribute("usage_instructions", "使用说明", 70),
    ],
  },
  {
    code: "hangers",
    name: "衣架",
    sortOrder: 20,
    attributes: [
      selectAttribute({
        code: "hanger_type",
        name: "衣架类型",
        sortOrder: 10,
        options: options([
          ["standard", "标准衣架"],
          ["shirt", "衬衫衣架"],
          ["suit", "西装衣架"],
          ["coat", "大衣衣架"],
          ["trouser", "裤架"],
          ["skirt", "裙架"],
          ["children", "儿童衣架"],
          ["multi_layer", "多层衣架"],
        ]),
      }),
      selectAttribute({
        code: "material",
        name: "材质",
        sortOrder: 20,
        multiple: true,
        options: options([
          ["plastic", "塑料"],
          ["wood", "木质"],
          ["metal", "金属"],
          ["velvet", "植绒"],
          ["foam", "海绵"],
        ]),
      }),
      selectAttribute({
        code: "color",
        name: "颜色",
        sortOrder: 30,
        multiple: true,
        options: options([
          ["black", "黑色"],
          ["white", "白色"],
          ["gray", "灰色"],
          ["blue", "蓝色"],
          ["pink", "粉色"],
          ["brown", "棕色"],
          ["beige", "米色"],
          ["multicolor", "多色"],
        ]),
      }),
      selectAttribute({
        code: "size",
        name: "尺寸规格",
        sortOrder: 40,
        options: options([
          ["children", "儿童款"],
          ["standard", "标准款"],
          ["extra_wide", "加宽款"],
        ]),
      }),
      selectAttribute({
        code: "features",
        name: "功能特点",
        sortOrder: 50,
        multiple: true,
        options: options([
          ["non_slip", "防滑"],
          ["clips", "带夹子"],
          ["swivel_hook", "旋转挂钩"],
          ["foldable", "可折叠"],
          ["padded", "加厚肩垫"],
        ]),
      }),
      textAttribute("pack_quantity", "包装数量", 60),
    ],
  },
  {
    code: "laundry_bags",
    name: "洗衣袋",
    sortOrder: 30,
    attributes: [
      selectAttribute({
        code: "bag_type",
        name: "洗衣袋类型",
        sortOrder: 10,
        options: options([
          ["wash_bag", "机洗洗衣袋"],
          ["laundry_storage", "待洗衣物收纳袋"],
          ["garment_bag", "衣物防尘袋"],
          ["delivery_bag", "衣物配送袋"],
        ]),
      }),
      selectAttribute({
        code: "material",
        name: "材质",
        sortOrder: 20,
        multiple: true,
        options: options([
          ["mesh", "网眼布"],
          ["cotton", "棉"],
          ["polyester", "聚酯纤维"],
          ["nylon", "尼龙"],
          ["non_woven", "无纺布"],
          ["plastic", "塑料"],
        ]),
      }),
      selectAttribute({
        code: "closure",
        name: "封口方式",
        sortOrder: 30,
        options: options([
          ["zipper", "拉链"],
          ["drawstring", "抽绳"],
          ["hook_loop", "魔术贴"],
          ["self_seal", "自封"],
          ["open_top", "敞口"],
        ]),
      }),
      selectAttribute({
        code: "size",
        name: "尺寸规格",
        sortOrder: 40,
        options: options([
          ["small", "小号"],
          ["medium", "中号"],
          ["large", "大号"],
          ["extra_large", "特大号"],
        ]),
      }),
      selectAttribute({
        code: "color",
        name: "颜色",
        sortOrder: 50,
        multiple: true,
        options: options([
          ["black", "黑色"],
          ["white", "白色"],
          ["gray", "灰色"],
          ["blue", "蓝色"],
          ["pink", "粉色"],
          ["brown", "棕色"],
          ["beige", "米色"],
          ["multicolor", "多色"],
        ]),
      }),
      textAttribute("capacity", "容量", 60),
      textAttribute("pack_quantity", "包装数量", 70),
    ],
  },
  {
    code: "car_fragrances",
    name: "车载香氛",
    sortOrder: 40,
    attributes: [
      selectAttribute({
        code: "fragrance_form",
        name: "香氛形态",
        sortOrder: 10,
        options: options([
          ["hanging", "悬挂式"],
          ["vent_clip", "出风口夹式"],
          ["gel", "凝胶"],
          ["spray", "喷雾"],
          ["diffuser", "扩香器"],
          ["can", "香膏罐"],
          ["refill", "替换芯"],
        ]),
      }),
      selectAttribute({
        code: "scent",
        name: "香型",
        sortOrder: 20,
        options: options([
          ["fresh", "清新"],
          ["floral", "花香"],
          ["fruity", "果香"],
          ["citrus", "柑橘"],
          ["ocean", "海洋"],
          ["woody", "木质香"],
          ["vanilla", "香草"],
          ["musk", "麝香"],
          ["coffee", "咖啡"],
          ["other", "其他"],
        ]),
      }),
      textAttribute("duration", "留香时长", 30),
      textAttribute("volume", "容量", 40),
      selectAttribute({
        code: "refillable",
        name: "是否可补充",
        sortOrder: 50,
        options: options([
          ["yes", "是"],
          ["no", "否"],
        ]),
      }),
    ],
  },
  {
    code: "packaging_supplies",
    name: "包装耗材",
    sortOrder: 50,
    attributes: [
      selectAttribute({
        code: "packaging_type",
        name: "包装类型",
        sortOrder: 10,
        options: options([
          ["packaging_bag", "包装袋"],
          ["garment_cover", "衣物防尘罩"],
          ["paper_bag", "纸袋"],
          ["zip_bag", "自封袋"],
          ["vacuum_bag", "真空袋"],
          ["sealing_film", "封装膜"],
        ]),
      }),
      selectAttribute({
        code: "material",
        name: "材质",
        sortOrder: 20,
        multiple: true,
        options: options([
          ["plastic", "塑料"],
          ["paper", "纸"],
          ["non_woven", "无纺布"],
          ["biodegradable", "可生物降解材料"],
          ["recycled", "再生材料"],
        ]),
      }),
      selectAttribute({
        code: "transparency",
        name: "透明度",
        sortOrder: 30,
        options: options([
          ["transparent", "透明"],
          ["translucent", "半透明"],
          ["opaque", "不透明"],
        ]),
      }),
      selectAttribute({
        code: "closure",
        name: "封口方式",
        sortOrder: 40,
        options: options([
          ["open", "敞口"],
          ["self_seal", "自封"],
          ["zipper", "拉链"],
          ["drawstring", "抽绳"],
          ["heat_seal", "热封"],
        ]),
      }),
      textAttribute("dimensions", "尺寸", 50),
      textAttribute("thickness", "厚度", 60),
      textAttribute("pack_quantity", "包装数量", 70),
      selectAttribute({
        code: "color",
        name: "颜色",
        sortOrder: 80,
        multiple: true,
        options: options([
          ["black", "黑色"],
          ["white", "白色"],
          ["gray", "灰色"],
          ["blue", "蓝色"],
          ["pink", "粉色"],
          ["brown", "棕色"],
          ["beige", "米色"],
          ["transparent", "透明"],
          ["multicolor", "多色"],
        ]),
      }),
    ],
  },
  {
    code: "label_printing_supplies",
    name: "标签打印耗材",
    sortOrder: 60,
    attributes: [
      selectAttribute({
        code: "supply_type",
        name: "耗材类型",
        sortOrder: 10,
        options: options([
          ["receipt_roll", "小票纸卷"],
          ["garment_label", "衣物标签"],
          ["finished_product_sticker", "成品贴纸"],
          ["a4_paper", "A4 纸"],
          ["barcode_label", "条码标签"],
        ]),
      }),
      selectAttribute({
        code: "print_method",
        name: "打印方式",
        sortOrder: 20,
        options: options([
          ["direct_thermal", "热敏打印"],
          ["thermal_transfer", "热转印"],
          ["impact_matrix", "针式打印"],
          ["inkjet", "喷墨打印"],
          ["laser", "激光打印"],
        ]),
      }),
      selectAttribute({
        code: "format",
        name: "规格格式",
        sortOrder: 30,
        options: options([
          ["width_80mm", "80 mm"],
          ["a4", "A4"],
          ["custom", "自定义"],
        ]),
      }),
      selectAttribute({
        code: "adhesive",
        name: "粘胶类型",
        sortOrder: 40,
        options: options([
          ["none", "无粘胶"],
          ["permanent", "永久胶"],
          ["removable", "可移除胶"],
        ]),
      }),
      selectAttribute({
        code: "color",
        name: "颜色",
        sortOrder: 50,
        options: options([
          ["white", "白色"],
          ["yellow", "黄色"],
          ["pink", "粉色"],
          ["blue", "蓝色"],
          ["green", "绿色"],
        ]),
      }),
      textAttribute("dimensions", "尺寸", 60),
      textAttribute("roll_length_or_quantity", "卷长或数量", 70),
      textAttribute("printer_compatibility", "适用打印机", 80),
    ],
  },
  {
    code: "other_retail",
    name: "其他零售商品",
    sortOrder: 70,
    attributes: [
      selectAttribute({
        code: "color",
        name: "颜色",
        sortOrder: 10,
        options: COLOR_OPTIONS,
        multiple: true,
      }),
      selectAttribute({
        code: "material",
        name: "材质",
        sortOrder: 20,
        multiple: true,
        options: options([
          ["cotton", "棉"],
          ["polyester", "聚酯纤维"],
          ["wool", "羊毛"],
          ["silk", "丝绸"],
          ["linen", "亚麻"],
          ["leather", "真皮"],
          ["synthetic_leather", "人造革"],
          ["nylon", "尼龙"],
          ["canvas", "帆布"],
          ["denim", "牛仔布"],
          ["metal", "金属"],
          ["plastic", "塑料"],
          ["wood", "木材"],
          ["glass", "玻璃"],
          ["ceramic", "陶瓷"],
          ["paper", "纸"],
          ["non_woven", "无纺布"],
        ]),
      }),
      textAttribute("dimensions", "尺寸", 30),
    ],
  },
];

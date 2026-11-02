import type { SupportedLocale } from "./locales.js";

/** Explicit schema guidance shared by admin and POS clients. */
export const schemaErrorMessages: Readonly<
  Record<string, Readonly<Record<SupportedLocale, string>>>
> = {
  "A balance due date is required for deferred payment.": {
    en: "A balance due date is required for deferred payment.",
    fr: "Indiquez la date d’échéance du solde pour un paiement différé.",
    "zh-CN": "延期付款必须填写尾款到期日。",
  },
  "A discount code is required for code discounts.": {
    en: "A discount code is required for code discounts.",
    fr: "Saisissez un code pour une remise par code.",
    "zh-CN": "折扣码优惠必须填写折扣码。",
  },
  "A discount without a minimum cannot contain minimum values.": {
    en: "A discount without a minimum cannot contain minimum values.",
    fr: "Une remise sans seuil ne peut pas contenir de valeurs minimales.",
    "zh-CN": "不设门槛的折扣不能包含最低金额或数量。",
  },
  "A failure reason is required.": {
    en: "A failure reason is required.",
    fr: "Indiquez le motif de l’échec.",
    "zh-CN": "请填写失败原因。",
  },
  "A non-successful card result requires a reason.": {
    en: "A non-successful card result requires a reason.",
    fr: "Indiquez le motif si le paiement par carte n’a pas réussi.",
    "zh-CN": "银行卡付款未成功时必须填写原因。",
  },
  "A product can have at most 10 images.": {
    en: "A product can have at most 10 images.",
    fr: "Un produit ne peut pas avoir plus de 10 images.",
    "zh-CN": "每个商品最多支持 10 张图片。",
  },
  "A reason and idempotency key are required when applying a discount code.": {
    en: "A reason and idempotency key are required when applying a discount code.",
    fr: "Indiquez un motif et une clé d’idempotence pour appliquer un code de remise.",
    "zh-CN": "应用折扣码时必须提供原因和幂等键。",
  },
  "A reason is required for deferred payment.": {
    en: "A reason is required for deferred payment.",
    fr: "Indiquez le motif du paiement différé.",
    "zh-CN": "延期付款必须填写原因。",
  },
  "A reason is required when cancelling a ticket.": {
    en: "A reason is required when cancelling a ticket.",
    fr: "Indiquez le motif de l’annulation du bon de service.",
    "zh-CN": "取消工单时必须填写原因。",
  },
  "A service can have at most 10 images.": {
    en: "A service can have at most 10 images.",
    fr: "Un service ne peut pas avoir plus de 10 images.",
    "zh-CN": "每个服务最多支持 10 张图片。",
  },
  "A successful card payment requires the TPE reference.": {
    en: "A successful card payment requires the TPE reference.",
    fr: "Un paiement par carte réussi exige la référence du TPE.",
    "zh-CN": "银行卡付款成功时必须填写 TPE 交易参考号。",
  },
  "A successful drawer result cannot include an error.": {
    en: "A successful drawer result cannot include an error.",
    fr: "Un résultat d’ouverture du tiroir réussi ne peut pas contenir d’erreur.",
    "zh-CN": "钱箱打开成功时不能包含错误信息。",
  },
  "A valid email destination is required.": {
    en: "A valid email destination is required.",
    fr: "Saisissez une adresse e-mail de destination valide.",
    "zh-CN": "请填写有效的收件邮箱。",
  },
  "A valid SMS phone number is required.": {
    en: "A valid SMS phone number is required.",
    fr: "Saisissez un numéro de téléphone valide pour le SMS.",
    "zh-CN": "请填写有效的短信接收手机号。",
  },
  "Add product images after importing.": {
    en: "Add product images after importing.",
    fr: "Ajoutez les images des produits après l’import.",
    "zh-CN": "请在导入完成后添加商品图片。",
  },
  "All-country shipping discounts cannot list countries.": {
    en: "All-country shipping discounts cannot list countries.",
    fr: "Une remise de livraison pour tous les pays ne peut pas désigner de pays particuliers.",
    "zh-CN": "全部国家的运费优惠不能指定具体国家。",
  },
  "All-customer discounts cannot list specific customers.": {
    en: "All-customer discounts cannot list specific customers.",
    fr: "Une remise pour tous les clients ne peut pas désigner de clients particuliers.",
    "zh-CN": "全部客户优惠不能指定具体客户。",
  },
  "allBranches discounts cannot list branches, and scoped discounts require at least one branch.":
    {
      en: "allBranches discounts cannot list branches, and scoped discounts require at least one branch.",
      fr: "Une remise pour toutes les succursales ne peut pas en lister ; une remise ciblée exige au moins une succursale.",
      "zh-CN": "全部门店优惠不能指定门店；指定范围的优惠必须至少选择一家门店。",
    },
  "Amount must be a decimal with up to 2 places.": {
    en: "Amount must be a decimal with up to 2 places.",
    fr: "Le montant doit comporter au plus 2 décimales.",
    "zh-CN": "金额最多支持两位小数。",
  },
  "Amount must be greater than zero.": {
    en: "Amount must be greater than zero.",
    fr: "Le montant doit être supérieur à zéro.",
    "zh-CN": "金额必须大于零。",
  },
  "An import can contain at most 500 item rows.": {
    en: "An import can contain at most 500 item rows.",
    fr: "Un import ne peut pas contenir plus de 500 lignes d’articles.",
    "zh-CN": "单次导入最多支持 500 行项目。",
  },
  "An order item cannot reference both a service and a product.": {
    en: "An order item cannot reference both a service and a product.",
    fr: "Une ligne de commande ne peut pas désigner à la fois un service et un produit.",
    "zh-CN": "同一个订单项目不能同时关联服务和商品。",
  },
  "Applicable item types do not match the business line.": {
    en: "Applicable item types do not match the business line.",
    fr: "Les types d’articles sélectionnés ne correspondent pas à l’activité.",
    "zh-CN": "所选物品类型与业务类型不一致。",
  },
  "Applicable item types must be unique.": {
    en: "Applicable item types must be unique.",
    fr: "Les types d’articles applicables ne doivent pas être en double.",
    "zh-CN": "适用物品类型不能重复。",
  },
  "At least one account field must be provided.": {
    en: "At least one account field must be provided.",
    fr: "Modifiez au moins un champ du compte.",
    "zh-CN": "请至少修改一个账户字段。",
  },
  "At least one branch field must be provided.": {
    en: "At least one branch field must be provided.",
    fr: "Modifiez au moins un champ de la succursale.",
    "zh-CN": "请至少修改一个门店字段。",
  },
  "At least one customer field must be provided.": {
    en: "At least one customer field must be provided.",
    fr: "Modifiez au moins un champ du client.",
    "zh-CN": "请至少修改一个客户字段。",
  },
  "At least one field must be provided.": {
    en: "At least one field must be provided.",
    fr: "Renseignez au moins un champ.",
    "zh-CN": "请至少填写一个字段。",
  },
  "At least one item field must be provided.": {
    en: "At least one item field must be provided.",
    fr: "Modifiez au moins un champ de l’article.",
    "zh-CN": "请至少修改一个项目字段。",
  },
  "At least one order field must be provided.": {
    en: "At least one order field must be provided.",
    fr: "Modifiez au moins un champ de la commande.",
    "zh-CN": "请至少修改一个订单字段。",
  },
  "At least one POS channel setting must be provided.": {
    en: "At least one POS channel setting must be provided.",
    fr: "Modifiez au moins un paramètre du canal POS.",
    "zh-CN": "请至少修改一项 POS 渠道设置。",
  },
  "At least one service field must be provided.": {
    en: "At least one service field must be provided.",
    fr: "Modifiez au moins un champ du service.",
    "zh-CN": "请至少修改一个服务字段。",
  },
  "At least one setting field must be provided.": {
    en: "At least one setting field must be provided.",
    fr: "Modifiez au moins un paramètre.",
    "zh-CN": "请至少修改一项设置。",
  },
  "At least one terminal field must be provided.": {
    en: "At least one terminal field must be provided.",
    fr: "Modifiez au moins un champ du terminal.",
    "zh-CN": "请至少修改一个终端字段。",
  },
  "At least one ticket field must be provided.": {
    en: "At least one ticket field must be provided.",
    fr: "Modifiez au moins un champ du bon de service.",
    "zh-CN": "请至少修改一个工单字段。",
  },
  "Attribute option IDs must be unique.": {
    en: "Attribute option IDs must be unique.",
    fr: "Les options d’attribut ne doivent pas être en double.",
    "zh-CN": "属性选项不能重复。",
  },
  "Automatic discounts cannot have a discount code.": {
    en: "Automatic discounts cannot have a discount code.",
    fr: "Une remise automatique ne peut pas avoir de code.",
    "zh-CN": "自动折扣不能设置折扣码。",
  },
  "Branch settings must have unique branch IDs.": {
    en: "Branch settings must have unique branch IDs.",
    fr: "Chaque succursale ne peut être configurée qu’une fois.",
    "zh-CN": "门店设置中的门店不能重复。",
  },
  "Buy-X-get-Y configuration is incomplete.": {
    en: "Buy-X-get-Y configuration is incomplete.",
    fr: "La configuration « Achetez X, recevez Y » est incomplète.",
    "zh-CN": "买 X 赠 Y 的配置不完整。",
  },
  "Buy-X-get-Y fields are only valid for that discount type.": {
    en: "Buy-X-get-Y fields are only valid for that discount type.",
    fr: "Les champs « Achetez X, recevez Y » sont réservés à ce type de remise.",
    "zh-CN": "买 X 赠 Y 的字段只能用于该类型的折扣。",
  },
  "Category attributes can only be submitted with an existing category ID.": {
    en: "Category attributes can only be submitted with an existing category ID.",
    fr: "Les attributs de catégorie exigent l’identifiant d’une catégorie existante.",
    "zh-CN": "提交分类属性时必须选择已有分类。",
  },
  "Choose an offered cash rounding step.": {
    en: "Choose an offered cash rounding step.",
    fr: "Choisissez un arrondi d’espèces proposé.",
    "zh-CN": "请选择可用的现金取整档位。",
  },
  "Closing time must be later than opening time.": {
    en: "Closing time must be later than opening time.",
    fr: "L’heure de fermeture doit être postérieure à l’heure d’ouverture.",
    "zh-CN": "闭店时间必须晚于开店时间。",
  },
  "createdAfter must be before createdBefore.": {
    en: "createdAfter must be before createdBefore.",
    fr: "La date de début doit précéder la date de fin.",
    "zh-CN": "起始时间必须早于结束时间。",
  },
  "createdAfter must be earlier than createdBefore.": {
    en: "createdAfter must be earlier than createdBefore.",
    fr: "La date de début doit précéder la date de fin.",
    "zh-CN": "起始时间必须早于结束时间。",
  },
  "currency is required exactly when an amount-based rule is configured.": {
    en: "currency is required exactly when an amount-based rule is configured.",
    fr: "La devise est obligatoire pour une règle fondée sur un montant, et doit être absente sinon.",
    "zh-CN": "仅在配置金额类规则时填写币种，其他情况不应填写。",
  },
  "Currency must be a 3-letter code.": {
    en: "Currency must be a 3-letter code.",
    fr: "La devise doit être un code de 3 lettres.",
    "zh-CN": "币种必须为三位字母代码。",
  },
  "Date must be a valid calendar date.": {
    en: "Date must be a valid calendar date.",
    fr: "Saisissez une date du calendrier valide.",
    "zh-CN": "请填写有效的日历日期。",
  },
  "Date range must be 366 days or fewer.": {
    en: "Date range must be 366 days or fewer.",
    fr: "La période ne peut pas dépasser 366 jours.",
    "zh-CN": "查询时间范围不能超过 366 天。",
  },
  "Discount targets must be unique.": {
    en: "Discount targets must be unique.",
    fr: "Les éléments ciblés par la remise ne doivent pas être en double.",
    "zh-CN": "折扣适用对象不能重复。",
  },
  "Either quantity or weight is required.": {
    en: "Either quantity or weight is required.",
    fr: "Renseignez la quantité ou le poids.",
    "zh-CN": "请填写数量或重量。",
  },
  "endsAt must be later than startsAt.": {
    en: "endsAt must be later than startsAt.",
    fr: "La date de fin doit être postérieure à la date de début.",
    "zh-CN": "结束时间必须晚于开始时间。",
  },
  "Every payment in a mixed tender must include an amount.": {
    en: "Every payment in a mixed tender must include an amount.",
    fr: "Chaque moyen d’un paiement mixte doit préciser son montant.",
    "zh-CN": "混合付款中的每笔付款都必须填写金额。",
  },
  "Free-shipping discounts must use the free value and no item targets.": {
    en: "Free-shipping discounts must use the free value and no item targets.",
    fr: "Une remise de livraison gratuite doit utiliser la valeur gratuite et ne peut pas cibler d’articles.",
    "zh-CN": "免运费优惠必须使用免费类型，且不能指定项目。",
  },
  "from and to must be provided together.": {
    en: "from and to must be provided together.",
    fr: "Renseignez les dates de début et de fin ensemble.",
    "zh-CN": "开始日期和结束日期必须同时填写。",
  },
  "from must be before or equal to to.": {
    en: "from must be before or equal to to.",
    fr: "La date de début doit précéder ou correspondre à la date de fin.",
    "zh-CN": "开始日期不能晚于结束日期。",
  },
  "Invalid decimal value.": {
    en: "Invalid decimal value.",
    fr: "Saisissez un nombre décimal valide.",
    "zh-CN": "请填写有效的小数。",
  },
  "Invalid ISO timestamp.": {
    en: "Invalid ISO timestamp.",
    fr: "Saisissez une date et une heure au format ISO valide.",
    "zh-CN": "请填写有效的 ISO 日期时间。",
  },
  "Item discounts require an amount and may only use applies-to targets.": {
    en: "Item discounts require an amount and may only use applies-to targets.",
    fr: "Une remise sur articles exige un montant et uniquement des éléments auxquels elle s’applique.",
    "zh-CN": "项目折扣必须填写优惠值，且只能配置适用项目。",
  },
  "Manager email is required.": {
    en: "Manager email is required.",
    fr: "L’adresse e-mail du responsable est obligatoire.",
    "zh-CN": "请填写经理邮箱。",
  },
  "Manager password is required.": {
    en: "Manager password is required.",
    fr: "Le mot de passe du responsable est obligatoire.",
    "zh-CN": "请填写经理密码。",
  },
  "Media object keys must be unique.": {
    en: "Media object keys must be unique.",
    fr: "Les clés des fichiers médias ne doivent pas être en double.",
    "zh-CN": "媒体文件标识不能重复。",
  },
  "Merchant name is required on every receipt.": {
    en: "Merchant name is required on every receipt.",
    fr: "Le nom du commerçant est obligatoire sur chaque reçu.",
    "zh-CN": "每张收据都必须包含商家名称。",
  },
  "minimum_amount requires only minimumPurchaseAmount.": {
    en: "minimum_amount requires only minimumPurchaseAmount.",
    fr: "Le seuil de montant exige uniquement un montant minimal d’achat.",
    "zh-CN": "金额门槛仅应填写最低消费金额。",
  },
  "minimum_quantity requires only minimumQuantity.": {
    en: "minimum_quantity requires only minimumQuantity.",
    fr: "Le seuil de quantité exige uniquement une quantité minimale.",
    "zh-CN": "数量门槛仅应填写最低购买数量。",
  },
  "Negative stock cannot be enabled when inventory tracking is disabled.": {
    en: "Negative stock cannot be enabled when inventory tracking is disabled.",
    fr: "Le stock négatif ne peut pas être activé si le suivi des stocks est désactivé.",
    "zh-CN": "未启用库存追踪时，不能允许负库存。",
  },
  "Opening stock must be zero when inventory tracking is disabled.": {
    en: "Opening stock must be zero when inventory tracking is disabled.",
    fr: "Le stock initial doit être nul si le suivi des stocks est désactivé.",
    "zh-CN": "未启用库存追踪时，期初库存必须为零。",
  },
  "Order discounts require an amount and cannot contain item targets.": {
    en: "Order discounts require an amount and cannot contain item targets.",
    fr: "Une remise sur commande exige un montant et ne peut pas cibler des articles.",
    "zh-CN": "整单折扣必须填写优惠值，且不能指定项目。",
  },
  "Payment idempotency keys must be unique within checkout.": {
    en: "Payment idempotency keys must be unique within checkout.",
    fr: "Les clés d’idempotence des paiements doivent être uniques dans cet encaissement.",
    "zh-CN": "同一次结款中的付款幂等键不能重复。",
  },
  "Percentage discounts cannot exceed 100.": {
    en: "Percentage discounts cannot exceed 100.",
    fr: "Une remise en pourcentage ne peut pas dépasser 100 %.",
    "zh-CN": "百分比折扣不能超过 100%。",
  },
  "PIN must be exactly 6 digits.": {
    en: "PIN must be exactly 6 digits.",
    fr: "Le code PIN doit comporter exactement 6 chiffres.",
    "zh-CN": "PIN 必须是六位数字。",
  },
  "Print status is required for a print receipt delivery.": {
    en: "Print status is required for a print receipt delivery.",
    fr: "Indiquez le statut d’impression pour une remise de reçu imprimé.",
    "zh-CN": "打印收据时必须提供打印状态。",
  },
  "Printer purpose must be receipt or label.": {
    en: "Printer purpose must be receipt or label.",
    fr: "L’usage de l’imprimante doit être « reçu » ou « étiquette ».",
    "zh-CN": "打印机用途必须为收据或标签。",
  },
  "Product media download items must be unique.": {
    en: "Product media download items must be unique.",
    fr: "Les fichiers médias de produit à télécharger ne doivent pas être en double.",
    "zh-CN": "待下载的商品媒体文件不能重复。",
  },
  "Product quantities must be whole numbers.": {
    en: "Product quantities must be whole numbers.",
    fr: "Les quantités de produits doivent être des nombres entiers.",
    "zh-CN": "商品数量必须为整数。",
  },
  "Products must be sold as one inventory unit per sale.": {
    en: "Products must be sold as one inventory unit per sale.",
    fr: "Les produits doivent être vendus à l’unité de stock.",
    "zh-CN": "商品必须以一个库存单位为销售单位。",
  },
  "Provide both POS branding fields when updating the merchant identity.": {
    en: "Provide both POS branding fields when updating the merchant identity.",
    fr: "Pour modifier l’identité du commerçant, transmettez le nom affiché et le logo du POS ensemble.",
    "zh-CN": "更新商家标识时，请同时提交 POS 展示名称和图标字段。",
  },
  "Provide either categoryId or categoryName, not both.": {
    en: "Provide either categoryId or categoryName, not both.",
    fr: "Indiquez l’identifiant ou le nom de la catégorie, sans les combiner.",
    "zh-CN": "分类标识和分类名称不能同时填写。",
  },
  "Quantity must be a decimal with up to 3 places.": {
    en: "Quantity must be a decimal with up to 3 places.",
    fr: "La quantité doit comporter au plus 3 décimales.",
    "zh-CN": "数量最多支持三位小数。",
  },
  "Quantity must be a positive whole number.": {
    en: "Quantity must be a positive whole number.",
    fr: "La quantité doit être un entier positif.",
    "zh-CN": "数量必须为正整数。",
  },
  "Quantity must be greater than zero.": {
    en: "Quantity must be greater than zero.",
    fr: "La quantité doit être supérieure à zéro.",
    "zh-CN": "数量必须大于零。",
  },
  "Reorder point must be zero when inventory tracking is disabled.": {
    en: "Reorder point must be zero when inventory tracking is disabled.",
    fr: "Le seuil de réapprovisionnement doit être nul si le suivi des stocks est désactivé.",
    "zh-CN": "未启用库存追踪时，补货阈值必须为零。",
  },
  "Retained media IDs must be unique.": {
    en: "Retained media IDs must be unique.",
    fr: "Les identifiants des médias conservés ne doivent pas être en double.",
    "zh-CN": "保留的媒体文件不能重复。",
  },
  "Retained service images must be unique.": {
    en: "Retained service images must be unique.",
    fr: "Les images du service conservées ne doivent pas être en double.",
    "zh-CN": "保留的服务图片不能重复。",
  },
  "Select at least one applicable item type.": {
    en: "Select at least one applicable item type.",
    fr: "Sélectionnez au moins un type d’article applicable.",
    "zh-CN": "请至少选择一种适用物品类型。",
  },
  "Select at least one available branch.": {
    en: "Select at least one available branch.",
    fr: "Sélectionnez au moins une succursale disponible.",
    "zh-CN": "请至少选择一家可用门店。",
  },
  "Selected country scope requires at least one country.": {
    en: "Selected country scope requires at least one country.",
    fr: "Sélectionnez au moins un pays pour cette portée géographique.",
    "zh-CN": "指定国家范围时必须至少选择一个国家。",
  },
  "Service images must be unique.": {
    en: "Service images must be unique.",
    fr: "Les images du service ne doivent pas être en double.",
    "zh-CN": "服务图片不能重复。",
  },
  "Service media download items must be unique.": {
    en: "Service media download items must be unique.",
    fr: "Les fichiers médias de service à télécharger ne doivent pas être en double.",
    "zh-CN": "待下载的服务媒体文件不能重复。",
  },
  "Shipping fields are only valid for free-shipping discounts.": {
    en: "Shipping fields are only valid for free-shipping discounts.",
    fr: "Les champs de livraison sont réservés aux remises de livraison gratuite.",
    "zh-CN": "配送相关字段仅适用于免运费优惠。",
  },
  "Specific-customer discounts require at least one customer.": {
    en: "Specific-customer discounts require at least one customer.",
    fr: "Une remise pour des clients précis exige au moins un client.",
    "zh-CN": "指定客户优惠必须至少选择一个客户。",
  },
  "Standard price exceeds the supported maximum.": {
    en: "Standard price exceeds the supported maximum.",
    fr: "Le prix standard dépasse le maximum autorisé.",
    "zh-CN": "标准价格超过支持的最大值。",
  },
  "Standard price must be a decimal with up to 2 places.": {
    en: "Standard price must be a decimal with up to 2 places.",
    fr: "Le prix standard doit comporter au plus 2 décimales.",
    "zh-CN": "标准价格最多支持两位小数。",
  },
  "Standard price must be greater than 0.": {
    en: "Standard price must be greater than 0.",
    fr: "Le prix standard doit être supérieur à zéro.",
    "zh-CN": "标准价格必须大于零。",
  },
  "Stock on hand must be zero when inventory tracking is disabled.": {
    en: "Stock on hand must be zero when inventory tracking is disabled.",
    fr: "Le stock disponible doit être nul si le suivi des stocks est désactivé.",
    "zh-CN": "未启用库存追踪时，现有库存必须为零。",
  },
  "Tax rate must be a fraction between 0 and 1, e.g. 0.18 for 18%.": {
    en: "Tax rate must be a fraction between 0 and 1, e.g. 0.18 for 18%.",
    fr: "Le taux doit être une fraction entre 0 et 1, par exemple 0,18 pour 18 %.",
    "zh-CN": "税率必须是 0 到 1 之间的小数，例如 18% 应填写 0.18。",
  },
  "tenantVersion cannot be updated by itself.": {
    en: "tenantVersion cannot be updated by itself.",
    fr: "La version du locataire ne peut pas être modifiée seule.",
    "zh-CN": "不能单独更新租户版本号。",
  },
  "tenantVersion is required when updating tenant details.": {
    en: "tenantVersion is required when updating tenant details.",
    fr: "La version du locataire est obligatoire pour modifier ses informations.",
    "zh-CN": "更新租户信息时必须提供租户版本号。",
  },
  "Tendered cash must cover the payment amount.": {
    en: "Tendered cash must cover the payment amount.",
    fr: "Les espèces reçues doivent couvrir le montant à payer.",
    "zh-CN": "实收现金不能小于应付金额。",
  },
  "The built-in hardware key must match the device type.": {
    en: "The built-in hardware key must match the device type.",
    fr: "La clé du matériel intégré doit correspondre au type d’appareil.",
    "zh-CN": "内置硬件标识必须与设备类型一致。",
  },
  "The default payment method must also be enabled.": {
    en: "The default payment method must also be enabled.",
    fr: "Le moyen de paiement par défaut doit aussi être activé.",
    "zh-CN": "默认付款方式必须同时处于启用状态。",
  },
  "Ticket number and item name are required on every label.": {
    en: "Ticket number and item name are required on every label.",
    fr: "Le numéro du bon et le nom de l’article sont obligatoires sur chaque étiquette.",
    "zh-CN": "每张标签都必须包含工单号和物品名称。",
  },
  "Timezone must be a valid IANA timezone.": {
    en: "Timezone must be a valid IANA timezone.",
    fr: "Choisissez un fuseau horaire IANA valide.",
    "zh-CN": "请选择有效的 IANA 时区。",
  },
  "Use either payment or payments, not both.": {
    en: "Use either payment or payments, not both.",
    fr: "Renseignez un paiement unique ou une liste de paiements, sans les combiner.",
    "zh-CN": "单笔付款和多笔付款不能同时提交。",
  },
  "Value must be greater than zero.": {
    en: "Value must be greater than zero.",
    fr: "La valeur doit être supérieure à zéro.",
    "zh-CN": "数值必须大于零。",
  },
  "Weight must be a decimal with up to 3 places.": {
    en: "Weight must be a decimal with up to 3 places.",
    fr: "Le poids doit comporter au plus 3 décimales.",
    "zh-CN": "重量最多支持三位小数。",
  },
  "Weight must be greater than zero.": {
    en: "Weight must be greater than zero.",
    fr: "Le poids doit être supérieur à zéro.",
    "zh-CN": "重量必须大于零。",
  },
  "Weight must have up to 3 decimal places.": {
    en: "Weight must have up to 3 decimal places.",
    fr: "Le poids doit comporter au plus 3 décimales.",
    "zh-CN": "重量最多支持三位小数。",
  },
};

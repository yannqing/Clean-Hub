import type { SupportedLocale } from "./locales.js";

/** Public back-office failures. Codes and business values are preserved. */
export const tenantErrorMessages: Readonly<
  Record<string, Readonly<Record<SupportedLocale, string>>>
> = {
  "The selected branch is outside the current user's scope.": {
    en: "The selected branch is outside the current user's scope.",
    fr: "La succursale sélectionnée dépasse vos accès.",
    "zh-CN": "所选门店超出了当前用户的访问范围。",
  },
  "Password must be at least {name} characters.": {
    en: "Password must be at least {name} characters.",
    fr: "Le mot de passe doit comporter au moins {name} caractères.",
    "zh-CN": "密码至少需要 {name} 个字符。",
  },
  "Password must be 128 characters or fewer.": {
    en: "Password must be 128 characters or fewer.",
    fr: "Le mot de passe ne doit pas dépasser 128 caractères.",
    "zh-CN": "密码不能超过 128 个字符。",
  },
  "Password must contain at least one number.": {
    en: "Password must contain at least one number.",
    fr: "Le mot de passe doit contenir au moins un chiffre.",
    "zh-CN": "密码必须至少包含一个数字。",
  },
  "Password must contain at least one symbol.": {
    en: "Password must contain at least one symbol.",
    fr: "Le mot de passe doit contenir au moins un caractère spécial.",
    "zh-CN": "密码必须至少包含一个特殊字符。",
  },
  "A customer account with this phone already exists.": {
    en: "A customer account with this phone already exists.",
    fr: "Un compte client utilise déjà ce numéro de téléphone.",
    "zh-CN": "已有客户账户使用此手机号。",
  },
  "A customer account with this email already exists.": {
    en: "A customer account with this email already exists.",
    fr: "Un compte client utilise déjà cette adresse e-mail.",
    "zh-CN": "已有客户账户使用此邮箱。",
  },
  "Car-wash services can only apply to vehicles.": {
    en: "Car-wash services can only apply to vehicles.",
    fr: "Les services de lavage automobile s’appliquent uniquement aux véhicules.",
    "zh-CN": "洗车服务只能适用于车辆。",
  },
  "Laundry services cannot apply to vehicles.": {
    en: "Laundry services cannot apply to vehicles.",
    fr: "Les services de blanchisserie ne s’appliquent pas aux véhicules.",
    "zh-CN": "洗衣服务不能适用于车辆。",
  },
  'Category attribute "{name}" is required.': {
    en: 'Category attribute "{name}" is required.',
    fr: "L’attribut de catégorie « {name} » est obligatoire.",
    "zh-CN": "分类属性“{name}”为必填项。",
  },
  'Category attribute "{name}" requires a text value.': {
    en: 'Category attribute "{name}" requires a text value.',
    fr: "Saisissez un texte pour l’attribut « {name} ».",
    "zh-CN": "分类属性“{name}”需要填写文本。",
  },
  'Category attribute "{name}" requires an option value.': {
    en: 'Category attribute "{name}" requires an option value.',
    fr: "Choisissez une option pour l’attribut « {name} ».",
    "zh-CN": "分类属性“{name}”需要选择选项。",
  },
  'Category attribute "{name}" requires at least one option.': {
    en: 'Category attribute "{name}" requires at least one option.',
    fr: "Choisissez au moins une option pour l’attribut « {name} ».",
    "zh-CN": "分类属性“{name}”需要至少选择一个选项。",
  },
  'Category attribute "{name}" contains duplicate options.': {
    en: 'Category attribute "{name}" contains duplicate options.',
    fr: "L’attribut « {name} » contient des options en double.",
    "zh-CN": "分类属性“{name}”包含重复选项。",
  },
  'Category attribute "{name}" only accepts one option.': {
    en: 'Category attribute "{name}" only accepts one option.',
    fr: "L’attribut « {name} » accepte une seule option.",
    "zh-CN": "分类属性“{name}”仅允许选择一个选项。",
  },
  'An option for category attribute "{name}" is invalid or inactive.': {
    en: 'An option for category attribute "{name}" is invalid or inactive.',
    fr: "Une option de l’attribut « {name} » est invalide ou inactive.",
    "zh-CN": "分类属性“{name}”的某个选项无效或已停用。",
  },
  'Several existing tax classes match "{name}". Resolve the duplicate classes before applying this template.':
    {
      en: 'Several existing tax classes match "{name}". Resolve the duplicate classes before applying this template.',
      fr: "Plusieurs catégories fiscales correspondent à « {name} ». Résolvez les doublons avant d’appliquer ce modèle.",
      "zh-CN": "存在多个匹配“{name}”的税类，请先处理重复税类再应用模板。",
    },
  'Existing tax class "{name}" is not in the country template. Reassign and remove it before applying the template.':
    {
      en: 'Existing tax class "{name}" is not in the country template. Reassign and remove it before applying the template.',
      fr: "La catégorie fiscale « {name} » ne figure pas dans le modèle du pays. Réattribuez ses articles puis supprimez-la avant d’appliquer le modèle.",
      "zh-CN":
        "已有税类“{name}”不在国家模板中，请先重新分配其关联项目并移除该税类。",
    },
  'Tax class "{name}" is still assigned to a service or product. Reassign those items before changing the country template.':
    {
      en: 'Tax class "{name}" is still assigned to a service or product. Reassign those items before changing the country template.',
      fr: "La catégorie fiscale « {name} » est encore utilisée par un service ou produit. Réattribuez ces articles avant de changer le modèle du pays.",
      "zh-CN":
        "税类“{name}”仍被服务或商品使用，请先重新分配这些项目再更改国家模板。",
    },
  'A tenant tax class named "{name}" already exists. Rename it before applying this template.':
    {
      en: 'A tenant tax class named "{name}" already exists. Rename it before applying this template.',
      fr: "Une catégorie fiscale nommée « {name} » existe déjà. Renommez-la avant d’appliquer ce modèle.",
      "zh-CN": "租户中已存在名为“{name}”的税类，请先重命名再应用模板。",
    },
  "A branch can only be configured once.": {
    en: "A branch can only be configured once.",
    fr: "Une succursale ne peut être configurée qu’une seule fois.",
    "zh-CN": "同一门店只能配置一次。",
  },
  "A category attribute does not belong to the selected category or is inactive.":
    {
      en: "A category attribute does not belong to the selected category or is inactive.",
      fr: "Un attribut n’appartient pas à la catégorie sélectionnée ou est inactif.",
      "zh-CN": "某个属性不属于所选分类或已停用。",
    },
  "A tax rate with this name already exists.": {
    en: "A tax rate with this name already exists.",
    fr: "Un taux de taxe portant ce nom existe déjà.",
    "zh-CN": "已存在同名税率。",
  },
  "An account with this email already exists.": {
    en: "An account with this email already exists.",
    fr: "Un compte utilise déjà cette adresse e-mail.",
    "zh-CN": "已有账号使用此邮箱。",
  },
  "Archived tax rates cannot be assigned.": {
    en: "Archived tax rates cannot be assigned.",
    fr: "Les taux de taxe archivés ne peuvent pas être attribués.",
    "zh-CN": "不能分配已归档的税率。",
  },
  "At least one profile field must be provided.": {
    en: "At least one profile field must be provided.",
    fr: "Renseignez au moins un champ du profil.",
    "zh-CN": "请至少填写一项个人资料。",
  },
  "At least one tenant setting must be provided.": {
    en: "At least one tenant setting must be provided.",
    fr: "Renseignez au moins un paramètre du locataire.",
    "zh-CN": "请至少填写一项租户设置。",
  },
  "Audit log was not found.": {
    en: "Audit log was not found.",
    fr: "Journal d’audit introuvable.",
    "zh-CN": "未找到审计日志。",
  },
  "Backup job was not found.": {
    en: "Backup job was not found.",
    fr: "Tâche de sauvegarde introuvable.",
    "zh-CN": "未找到备份任务。",
  },
  "Barcode already exists in this tenant.": {
    en: "Barcode already exists in this tenant.",
    fr: "Ce code-barres existe déjà pour ce locataire.",
    "zh-CN": "此条码在该租户中已存在。",
  },
  "Branch has been modified. Refresh and try again.": {
    en: "Branch has been modified. Refresh and try again.",
    fr: "La succursale a été modifiée. Actualisez puis réessayez.",
    "zh-CN": "门店已被修改，请刷新后重试。",
  },
  "Built-in hardware is managed by its POS terminal and cannot be deleted.": {
    en: "Built-in hardware is managed by its POS terminal and cannot be deleted.",
    fr: "Le matériel intégré est géré par son terminal POS et ne peut pas être supprimé ici.",
    "zh-CN": "内置硬件由所属 POS 终端管理，不能在此删除。",
  },
  "Built-in hardware is managed by its POS terminal and cannot be edited in tenant administration.":
    {
      en: "Built-in hardware is managed by its POS terminal and cannot be edited in tenant administration.",
      fr: "Le matériel intégré est géré par son terminal POS et ne peut pas être modifié dans l’administration du locataire.",
      "zh-CN": "内置硬件由所属 POS 终端管理，不能在租户后台修改。",
    },
  "Category attribute definitions must be unique.": {
    en: "Category attribute definitions must be unique.",
    fr: "Les définitions des attributs de catégorie doivent être uniques.",
    "zh-CN": "分类属性定义不能重复。",
  },
  "Category attributes require an existing product category.": {
    en: "Category attributes require an existing product category.",
    fr: "Les attributs nécessitent une catégorie de produit existante.",
    "zh-CN": "设置属性需要有效的商品分类。",
  },
  "Close the terminal's register session before changing its branch or status.":
    {
      en: "Close the terminal's register session before changing its branch or status.",
      fr: "Clôturez la session de caisse du terminal avant de changer sa succursale ou son statut.",
      "zh-CN": "更改终端门店或状态前，请先关闭其钱箱会话。",
    },
  "Close the terminal's register session before removing the terminal.": {
    en: "Close the terminal's register session before removing the terminal.",
    fr: "Clôturez la session de caisse du terminal avant de supprimer le terminal.",
    "zh-CN": "删除终端前，请先关闭其钱箱会话。",
  },
  "Comment was not found.": {
    en: "Comment was not found.",
    fr: "Commentaire introuvable.",
    "zh-CN": "未找到评论。",
  },
  "Compare-at price must be greater than the standard price.": {
    en: "Compare-at price must be greater than the standard price.",
    fr: "Le prix de comparaison doit être supérieur au prix standard.",
    "zh-CN": "划线价必须大于标准价格。",
  },
  "Could not generate a unique SKU. Please try again.": {
    en: "Could not generate a unique SKU. Please try again.",
    fr: "Impossible de générer un SKU unique. Veuillez réessayer.",
    "zh-CN": "无法生成唯一 SKU，请重试。",
  },
  "Country changes must be made by a SaaS administrator so the tax template and currency stay in sync.":
    {
      en: "Country changes must be made by a SaaS administrator so the tax template and currency stay in sync.",
      fr: "Un administrateur SaaS doit changer le pays pour synchroniser le modèle fiscal et la devise.",
      "zh-CN": "请由 SaaS 管理员更改国家，以同步税务模板和币种。",
    },
  "Country tax template changed. Refresh and retry.": {
    en: "Country tax template changed. Refresh and retry.",
    fr: "Le modèle fiscal du pays a changé. Actualisez puis réessayez.",
    "zh-CN": "国家税务模板已更改，请刷新后重试。",
  },
  "Country tax template is incomplete.": {
    en: "Country tax template is incomplete.",
    fr: "Le modèle fiscal du pays est incomplet.",
    "zh-CN": "国家税务模板尚未完善。",
  },
  "Country tax template was not found.": {
    en: "Country tax template was not found.",
    fr: "Modèle fiscal du pays introuvable.",
    "zh-CN": "未找到国家税务模板。",
  },
  "Currency changes must be made by a SaaS administrator together with the country tax template.":
    {
      en: "Currency changes must be made by a SaaS administrator together with the country tax template.",
      fr: "Un administrateur SaaS doit changer la devise avec le modèle fiscal du pays.",
      "zh-CN": "币种需要由 SaaS 管理员随国家税务模板统一调整。",
    },
  "Current PIN is incorrect.": {
    en: "Current PIN is incorrect.",
    fr: "Le PIN actuel est incorrect.",
    "zh-CN": "当前 PIN 不正确。",
  },
  "Current password is incorrect.": {
    en: "Current password is incorrect.",
    fr: "Le mot de passe actuel est incorrect.",
    "zh-CN": "当前密码不正确。",
  },
  "Customer account changed before it could be saved.": {
    en: "Customer account changed before it could be saved.",
    fr: "Le compte client a été modifié avant l’enregistrement. Actualisez puis réessayez.",
    "zh-CN": "客户账户在保存前已被修改，请刷新后重试。",
  },
  "Customer changed before it could be saved.": {
    en: "Customer changed before it could be saved.",
    fr: "Le client a été modifié avant l’enregistrement. Actualisez puis réessayez.",
    "zh-CN": "客户在保存前已被修改，请刷新后重试。",
  },
  "Customer was not found.": {
    en: "Customer was not found.",
    fr: "Client introuvable.",
    "zh-CN": "未找到客户。",
  },
  "Discount branch assignment exceeds the manager's branch scope.": {
    en: "Discount branch assignment exceeds the manager's branch scope.",
    fr: "Les succursales de cette remise dépassent les accès du responsable.",
    "zh-CN": "折扣门店超出了经理的访问范围。",
  },
  "Discount code already exists.": {
    en: "Discount code already exists.",
    fr: "Ce code de remise existe déjà.",
    "zh-CN": "该折扣码已存在。",
  },
  "Discount has been modified. Refresh and try again.": {
    en: "Discount has been modified. Refresh and try again.",
    fr: "La remise a été modifiée. Actualisez puis réessayez.",
    "zh-CN": "折扣已被修改，请刷新后重试。",
  },
  "Discount was not found.": {
    en: "Discount was not found.",
    fr: "Remise introuvable.",
    "zh-CN": "未找到折扣。",
  },
  "Enable the customer account before issuing a password.": {
    en: "Enable the customer account before issuing a password.",
    fr: "Activez le compte client avant de lui attribuer un mot de passe.",
    "zh-CN": "请先启用客户账户，再设置密码。",
  },
  "Hardware config has been modified. Refresh and try again.": {
    en: "Hardware config has been modified. Refresh and try again.",
    fr: "La configuration du matériel a été modifiée. Actualisez puis réessayez.",
    "zh-CN": "硬件配置已被修改，请刷新后重试。",
  },
  "Hardware config was not found.": {
    en: "Hardware config was not found.",
    fr: "Configuration du matériel introuvable.",
    "zh-CN": "未找到硬件配置。",
  },
  "Inactive branches cannot be newly assigned to a service.": {
    en: "Inactive branches cannot be newly assigned to a service.",
    fr: "Une succursale inactive ne peut pas être ajoutée à un service.",
    "zh-CN": "不能将已停用的门店新增至服务范围。",
  },
  "Inactive service categories cannot be assigned.": {
    en: "Inactive service categories cannot be assigned.",
    fr: "Une catégorie de service inactive ne peut pas être attribuée.",
    "zh-CN": "不能分配已停用的服务分类。",
  },
  "Manager accounts must be assigned to exactly one branch.": {
    en: "Manager accounts must be assigned to exactly one branch.",
    fr: "Un responsable doit être affecté à une seule succursale.",
    "zh-CN": "经理账号必须且只能分配一个门店。",
  },
  "Manager accounts require an email address.": {
    en: "Manager accounts require an email address.",
    fr: "Une adresse e-mail est obligatoire pour un responsable.",
    "zh-CN": "经理账号必须填写邮箱。",
  },
  "Manager and cashier accounts require exactly one branch.": {
    en: "Manager and cashier accounts require exactly one branch.",
    fr: "Un responsable ou caissier doit être affecté à une seule succursale.",
    "zh-CN": "经理和收银员账号必须且只能分配一个门店。",
  },
  "Managers can only manage cashier accounts in their branch.": {
    en: "Managers can only manage cashier accounts in their branch.",
    fr: "Un responsable peut uniquement gérer les caissiers de sa succursale.",
    "zh-CN": "经理只能管理其门店的收银员账号。",
  },
  "Managers cannot create all-branch discounts.": {
    en: "Managers cannot create all-branch discounts.",
    fr: "Un responsable ne peut pas créer de remise pour toutes les succursales.",
    "zh-CN": "经理不能创建适用于全部门店的折扣。",
  },
  "New PIN must differ from the current PIN.": {
    en: "New PIN must differ from the current PIN.",
    fr: "Le nouveau PIN doit être différent du PIN actuel.",
    "zh-CN": "新 PIN 不能与当前 PIN 相同。",
  },
  "New password must be different from the current password.": {
    en: "New password must be different from the current password.",
    fr: "Le nouveau mot de passe doit être différent du mot de passe actuel.",
    "zh-CN": "新密码不能与当前密码相同。",
  },
  "One or more comment attachments are invalid or expired.": {
    en: "One or more comment attachments are invalid or expired.",
    fr: "Une ou plusieurs pièces jointes sont invalides ou ont expiré.",
    "zh-CN": "部分评论附件无效或已过期。",
  },
  "One or more comment attachments are not accessible.": {
    en: "One or more comment attachments are not accessible.",
    fr: "Une ou plusieurs pièces jointes sont inaccessibles.",
    "zh-CN": "无权访问部分评论附件。",
  },
  "One or more comment attachments have already been used.": {
    en: "One or more comment attachments have already been used.",
    fr: "Une ou plusieurs pièces jointes ont déjà été utilisées.",
    "zh-CN": "部分评论附件已被使用。",
  },
  "One or more comment attachments were not found.": {
    en: "One or more comment attachments were not found.",
    fr: "Une ou plusieurs pièces jointes sont introuvables.",
    "zh-CN": "未找到部分评论附件。",
  },
  "One or more discount branches were not found.": {
    en: "One or more discount branches were not found.",
    fr: "Une ou plusieurs succursales de la remise sont introuvables.",
    "zh-CN": "未找到部分折扣门店。",
  },
  "One or more discount targets or customers are invalid.": {
    en: "One or more discount targets or customers are invalid.",
    fr: "Une ou plusieurs cibles de remise ou des clients sont invalides.",
    "zh-CN": "部分折扣对象或客户无效。",
  },
  "One or more media objects are not product images.": {
    en: "One or more media objects are not product images.",
    fr: "Un ou plusieurs fichiers ne sont pas des images de produit.",
    "zh-CN": "部分文件不是商品图片。",
  },
  "One or more mentioned staff members are not active in this tenant.": {
    en: "One or more mentioned staff members are not active in this tenant.",
    fr: "Un ou plusieurs employés mentionnés sont inactifs chez ce locataire.",
    "zh-CN": "部分被提及的员工不属于此租户的有效员工。",
  },
  "One or more product image upload tickets have expired.": {
    en: "One or more product image upload tickets have expired.",
    fr: "Une ou plusieurs autorisations d’envoi d’images de produit ont expiré.",
    "zh-CN": "部分商品图片上传凭证已过期。",
  },
  "One or more product images are being deleted.": {
    en: "One or more product images are being deleted.",
    fr: "Une ou plusieurs images de produit sont en cours de suppression.",
    "zh-CN": "部分商品图片正在删除。",
  },
  "One or more product images are not accessible.": {
    en: "One or more product images are not accessible.",
    fr: "Une ou plusieurs images de produit sont inaccessibles.",
    "zh-CN": "无权访问部分商品图片。",
  },
  "One or more product images have already been used.": {
    en: "One or more product images have already been used.",
    fr: "Une ou plusieurs images de produit ont déjà été utilisées.",
    "zh-CN": "部分商品图片已被使用。",
  },
  "One or more product images were not found.": {
    en: "One or more product images were not found.",
    fr: "Une ou plusieurs images de produit sont introuvables.",
    "zh-CN": "未找到部分商品图片。",
  },
  "One or more retained product images were not found.": {
    en: "One or more retained product images were not found.",
    fr: "Une ou plusieurs images de produit à conserver sont introuvables.",
    "zh-CN": "未找到部分需要保留的商品图片。",
  },
  "One or more retained service images were not found.": {
    en: "One or more retained service images were not found.",
    fr: "Une ou plusieurs images de service à conserver sont introuvables.",
    "zh-CN": "未找到部分需要保留的服务图片。",
  },
  "One or more selected branches were not found or are inactive.": {
    en: "One or more selected branches were not found or are inactive.",
    fr: "Une ou plusieurs succursales sélectionnées sont introuvables ou inactives.",
    "zh-CN": "部分所选门店不存在或已停用。",
  },
  "One or more selected branches were not found.": {
    en: "One or more selected branches were not found.",
    fr: "Une ou plusieurs succursales sélectionnées sont introuvables.",
    "zh-CN": "未找到部分所选门店。",
  },
  "One or more service image upload tickets have expired.": {
    en: "One or more service image upload tickets have expired.",
    fr: "Une ou plusieurs autorisations d’envoi d’images de service ont expiré.",
    "zh-CN": "部分服务图片上传凭证已过期。",
  },
  "One or more service images are invalid or have already been used.": {
    en: "One or more service images are invalid or have already been used.",
    fr: "Une ou plusieurs images de service sont invalides ou déjà utilisées.",
    "zh-CN": "部分服务图片无效或已被使用。",
  },
  "One or more service images are not accessible.": {
    en: "One or more service images are not accessible.",
    fr: "Une ou plusieurs images de service sont inaccessibles.",
    "zh-CN": "无权访问部分服务图片。",
  },
  "One or more service images have already been used.": {
    en: "One or more service images have already been used.",
    fr: "Une ou plusieurs images de service ont déjà été utilisées.",
    "zh-CN": "部分服务图片已被使用。",
  },
  "One or more service images were not found.": {
    en: "One or more service images were not found.",
    fr: "Une ou plusieurs images de service sont introuvables.",
    "zh-CN": "未找到部分服务图片。",
  },
  "Only the author or a tenant owner can delete this comment.": {
    en: "Only the author or a tenant owner can delete this comment.",
    fr: "Seuls l’auteur ou un propriétaire du locataire peuvent supprimer ce commentaire.",
    "zh-CN": "仅评论作者或租户店主可以删除此评论。",
  },
  "Only the author or tenant owner can delete this comment.": {
    en: "Only the author or tenant owner can delete this comment.",
    fr: "Seuls l’auteur ou le propriétaire du locataire peuvent supprimer ce commentaire.",
    "zh-CN": "仅评论作者或租户店主可以删除此评论。",
  },
  "Only the comment author can edit this comment.": {
    en: "Only the comment author can edit this comment.",
    fr: "Seul l’auteur peut modifier ce commentaire.",
    "zh-CN": "仅评论作者可以编辑此评论。",
  },
  "Owner accounts cannot be changed from employee management.": {
    en: "Owner accounts cannot be changed from employee management.",
    fr: "Le compte propriétaire ne peut pas être modifié depuis la gestion des employés.",
    "zh-CN": "不能在员工管理中更改店主账号。",
  },
  "POS channel settings were modified by another request. Please refresh and try again.":
    {
      en: "POS channel settings were modified by another request. Please refresh and try again.",
      fr: "Les paramètres du canal POS ont été modifiés. Actualisez puis réessayez.",
      "zh-CN": "POS 渠道设置已被其他请求修改，请刷新后重试。",
    },
  "POS terminal was not found.": {
    en: "POS terminal was not found.",
    fr: "Terminal POS introuvable.",
    "zh-CN": "未找到 POS 终端。",
  },
  "Payment credential encryption is not configured on the server.": {
    en: "Payment credential encryption is not configured on the server.",
    fr: "Le chiffrement des identifiants de paiement n’est pas configuré sur le serveur.",
    "zh-CN": "服务器尚未配置支付凭证加密。",
  },
  "Payment integration is not configured.": {
    en: "Payment integration is not configured.",
    fr: "L’intégration de paiement n’est pas configurée.",
    "zh-CN": "尚未配置支付接入。",
  },
  "Product SKU has been modified. Refresh and try again.": {
    en: "Product SKU has been modified. Refresh and try again.",
    fr: "Le SKU a été modifié. Actualisez puis réessayez.",
    "zh-CN": "商品 SKU 已被修改，请刷新后重试。",
  },
  "Product SKU was not found.": {
    en: "Product SKU was not found.",
    fr: "SKU du produit introuvable.",
    "zh-CN": "未找到商品 SKU。",
  },
  "Product category is inactive.": {
    en: "Product category is inactive.",
    fr: "La catégorie du produit est inactive.",
    "zh-CN": "商品分类已停用。",
  },
  "Product category was not found.": {
    en: "Product category was not found.",
    fr: "Catégorie de produit introuvable.",
    "zh-CN": "未找到商品分类。",
  },
  "Product has been modified. Refresh and try again.": {
    en: "Product has been modified. Refresh and try again.",
    fr: "Le produit a été modifié. Actualisez puis réessayez.",
    "zh-CN": "商品已被修改，请刷新后重试。",
  },
  "Product image has already been used.": {
    en: "Product image has already been used.",
    fr: "Cette image de produit a déjà été utilisée.",
    "zh-CN": "该商品图片已被使用。",
  },
  "Product image is not accessible.": {
    en: "Product image is not accessible.",
    fr: "Cette image de produit est inaccessible.",
    "zh-CN": "无权访问该商品图片。",
  },
  "Product image storage is unavailable.": {
    en: "Product image storage is unavailable.",
    fr: "Le stockage des images de produit est indisponible.",
    "zh-CN": "商品图片存储暂不可用。",
  },
  "Product was not found after it was updated.": {
    en: "Product was not found after it was updated.",
    fr: "Le produit est introuvable après la mise à jour.",
    "zh-CN": "更新后未找到商品。",
  },
  "Product was not found.": {
    en: "Product was not found.",
    fr: "Produit introuvable.",
    "zh-CN": "未找到商品。",
  },
  "Provide a merchant name or logo for the POS.": {
    en: "Provide a merchant name or logo for the POS.",
    fr: "Renseignez un nom de commerçant ou un logo pour le POS.",
    "zh-CN": "请为 POS 填写商家名称或上传图标。",
  },
  "SKU code already exists in this tenant.": {
    en: "SKU code already exists in this tenant.",
    fr: "Ce code SKU existe déjà pour ce locataire.",
    "zh-CN": "此 SKU 编码在该租户中已存在。",
  },
  "Select at least one branch that provides this service.": {
    en: "Select at least one branch that provides this service.",
    fr: "Sélectionnez au moins une succursale proposant ce service.",
    "zh-CN": "请至少选择一家提供该服务的门店。",
  },
  "Service category does not belong to the selected business line.": {
    en: "Service category does not belong to the selected business line.",
    fr: "La catégorie du service n’appartient pas à l’activité sélectionnée.",
    "zh-CN": "服务分类不属于所选业务线。",
  },
  "Service category was not found.": {
    en: "Service category was not found.",
    fr: "Catégorie de service introuvable.",
    "zh-CN": "未找到服务分类。",
  },
  "Service code already exists in this tenant.": {
    en: "Service code already exists in this tenant.",
    fr: "Ce code de service existe déjà pour ce locataire.",
    "zh-CN": "此服务编码在该租户中已存在。",
  },
  "Service has been modified. Refresh and try again.": {
    en: "Service has been modified. Refresh and try again.",
    fr: "Le service a été modifié. Actualisez puis réessayez.",
    "zh-CN": "服务已被修改，请刷新后重试。",
  },
  "Service image has already been used.": {
    en: "Service image has already been used.",
    fr: "Cette image de service a déjà été utilisée.",
    "zh-CN": "该服务图片已被使用。",
  },
  "Service image is not accessible.": {
    en: "Service image is not accessible.",
    fr: "Cette image de service est inaccessible.",
    "zh-CN": "无权访问该服务图片。",
  },
  "Service image storage is unavailable.": {
    en: "Service image storage is unavailable.",
    fr: "Le stockage des images de service est indisponible.",
    "zh-CN": "服务图片存储暂不可用。",
  },
  "Service name already exists in this tenant.": {
    en: "Service name already exists in this tenant.",
    fr: "Ce nom de service existe déjà pour ce locataire.",
    "zh-CN": "此服务名称在该租户中已存在。",
  },
  "Service was not found.": {
    en: "Service was not found.",
    fr: "Service introuvable.",
    "zh-CN": "未找到服务。",
  },
  "Set a password when promoting an employee to manager.": {
    en: "Set a password when promoting an employee to manager.",
    fr: "Définissez un mot de passe lors de la promotion d’un employé au rôle de responsable.",
    "zh-CN": "将员工提升为经理时，请设置密码。",
  },
  "Stock changed after this product was loaded. Refresh and try again.": {
    en: "Stock changed after this product was loaded. Refresh and try again.",
    fr: "Le stock a changé depuis le chargement du produit. Actualisez puis réessayez.",
    "zh-CN": "加载商品后库存已变化，请刷新后重试。",
  },
  "Stock on hand cannot be lower than the reserved quantity.": {
    en: "Stock on hand cannot be lower than the reserved quantity.",
    fr: "Le stock disponible ne peut pas être inférieur à la quantité réservée.",
    "zh-CN": "现有库存不能少于预留数量。",
  },
  "Stored payment credentials could not be decrypted. Save and verify the credentials again.":
    {
      en: "Stored payment credentials could not be decrypted. Save and verify the credentials again.",
      fr: "Impossible de déchiffrer les identifiants de paiement. Enregistrez-les et vérifiez-les à nouveau.",
      "zh-CN": "无法解密已保存的支付凭证，请重新保存并验证。",
    },
  "Tax rate was modified by another request. Refresh and try again.": {
    en: "Tax rate was modified by another request. Refresh and try again.",
    fr: "Le taux de taxe a été modifié. Actualisez puis réessayez.",
    "zh-CN": "税率已被其他请求修改，请刷新后重试。",
  },
  "Tax rate was not found.": {
    en: "Tax rate was not found.",
    fr: "Taux de taxe introuvable.",
    "zh-CN": "未找到税率。",
  },
  "Tax rate, tax status and inclusive pricing are managed by the country template. Change the SaaS template instead.":
    {
      en: "Tax rate, tax status and inclusive pricing are managed by the country template. Change the SaaS template instead.",
      fr: "Le modèle du pays gère le taux, l’activation de la taxe et les prix TTC. Modifiez le modèle SaaS.",
      "zh-CN": "税率、税务开关及含税方式由国家模板管理，请修改 SaaS 模板。",
    },
  "Tenant context is required for backup APIs.": {
    en: "Tenant context is required for backup APIs.",
    fr: "Une session locataire est obligatoire pour les sauvegardes.",
    "zh-CN": "访问备份接口需要租户会话。",
  },
  "Tenant details changed in another session. Reload and try again.": {
    en: "Tenant details changed in another session. Reload and try again.",
    fr: "La fiche du locataire a été modifiée dans une autre session. Actualisez puis réessayez.",
    "zh-CN": "租户资料已在其他会话修改，请刷新后重试。",
  },
  "Tenant feature flags are not configured.": {
    en: "Tenant feature flags are not configured.",
    fr: "Les fonctionnalités du locataire ne sont pas configurées.",
    "zh-CN": "租户功能尚未配置。",
  },
  "Tenant overview is not available for the current tenant.": {
    en: "Tenant overview is not available for the current tenant.",
    fr: "La vue d’ensemble est indisponible pour ce locataire.",
    "zh-CN": "当前租户概览暂不可用。",
  },
  "Tenant settings or feature flags were not found.": {
    en: "Tenant settings or feature flags were not found.",
    fr: "Les paramètres ou fonctionnalités du locataire sont introuvables.",
    "zh-CN": "未找到租户设置或功能配置。",
  },
  "Tenant tax settings changed. Refresh and retry.": {
    en: "Tenant tax settings changed. Refresh and retry.",
    fr: "Les paramètres fiscaux du locataire ont changé. Actualisez puis réessayez.",
    "zh-CN": "租户税务设置已更改，请刷新后重试。",
  },
  "Tenant user was not found.": {
    en: "Tenant user was not found.",
    fr: "Utilisateur du locataire introuvable.",
    "zh-CN": "未找到租户用户。",
  },
  "The POS terminal changed during this request. Refresh and try again.": {
    en: "The POS terminal changed during this request. Refresh and try again.",
    fr: "Le terminal POS a été modifié pendant cette requête. Actualisez puis réessayez.",
    "zh-CN": "POS 终端在本次请求期间已被修改，请刷新后重试。",
  },
  "The POS terminal was not found.": {
    en: "The POS terminal was not found.",
    fr: "Terminal POS introuvable.",
    "zh-CN": "未找到 POS 终端。",
  },
  "The account changed while the PIN was being updated. Try again.": {
    en: "The account changed while the PIN was being updated. Try again.",
    fr: "Le compte a changé pendant la modification du PIN. Réessayez.",
    "zh-CN": "更新 PIN 时账号已发生变化，请重试。",
  },
  "The account changed while the password was being updated. Try again.": {
    en: "The account changed while the password was being updated. Try again.",
    fr: "Le compte a changé pendant la modification du mot de passe. Réessayez.",
    "zh-CN": "更新密码时账号已发生变化，请重试。",
  },
  "The comment could not be replayed safely.": {
    en: "The comment could not be replayed safely.",
    fr: "Impossible de renvoyer ce commentaire sans risque de doublon. Actualisez avant de réessayer.",
    "zh-CN": "无法安全重放此评论，请刷新后重试。",
  },
  "The comment has changed. Refresh and try again.": {
    en: "The comment has changed. Refresh and try again.",
    fr: "Le commentaire a été modifié. Actualisez puis réessayez.",
    "zh-CN": "评论已被修改，请刷新后重试。",
  },
  "The current login session cannot be revoked from this screen.": {
    en: "The current login session cannot be revoked from this screen.",
    fr: "La session actuelle ne peut pas être révoquée depuis cet écran.",
    "zh-CN": "不能在此页面撤销当前登录会话。",
  },
  "The current tenant user profile was not found.": {
    en: "The current tenant user profile was not found.",
    fr: "Profil de l’utilisateur actuel introuvable.",
    "zh-CN": "未找到当前租户用户的个人资料。",
  },
  "The employee does not have a branch assignment.": {
    en: "The employee does not have a branch assignment.",
    fr: "Cet employé n’est affecté à aucune succursale.",
    "zh-CN": "该员工尚未分配门店。",
  },
  "The idempotency key has already been used for another comment.": {
    en: "The idempotency key has already been used for another comment.",
    fr: "Cet identifiant de requête a déjà servi à un autre commentaire.",
    "zh-CN": "此幂等标识已用于其他评论。",
  },
  "The idempotency key has already been used with different attachments.": {
    en: "The idempotency key has already been used with different attachments.",
    fr: "Cet identifiant de requête a déjà servi avec d’autres pièces jointes.",
    "zh-CN": "此幂等标识已用于其他附件。",
  },
  "The idempotency key has already been used with different mentions.": {
    en: "The idempotency key has already been used with different mentions.",
    fr: "Cet identifiant de requête a déjà servi avec d’autres mentions.",
    "zh-CN": "此幂等标识已用于其他提及成员。",
  },
  "The login session was not found or is no longer active.": {
    en: "The login session was not found or is no longer active.",
    fr: "La session de connexion est introuvable ou n’est plus active.",
    "zh-CN": "登录会话不存在或已失效。",
  },
  "The payment provider does not match the request path.": {
    en: "The payment provider does not match the request path.",
    fr: "Le fournisseur de paiement ne correspond pas au chemin de la requête.",
    "zh-CN": "支付服务商与请求路径不匹配。",
  },
  "The same attachment cannot be added more than once.": {
    en: "The same attachment cannot be added more than once.",
    fr: "Une même pièce jointe ne peut pas être ajoutée plusieurs fois.",
    "zh-CN": "不能重复添加同一附件。",
  },
  "The selected branch is outside the manager's scope.": {
    en: "The selected branch is outside the manager's scope.",
    fr: "La succursale sélectionnée dépasse les accès du responsable.",
    "zh-CN": "所选门店超出了经理的访问范围。",
  },
  "The selected branch is unavailable in this tenant.": {
    en: "The selected branch is unavailable in this tenant.",
    fr: "La succursale sélectionnée est indisponible pour ce locataire.",
    "zh-CN": "所选门店在该租户中不可用。",
  },
  "The selected template does not match the tenant's country. Ask a SaaS administrator to change the country first.":
    {
      en: "The selected template does not match the tenant's country. Ask a SaaS administrator to change the country first.",
      fr: "Le modèle sélectionné ne correspond pas au pays du locataire. Demandez d’abord à un administrateur SaaS de changer le pays.",
      "zh-CN": "所选模板与租户国家不一致，请先由 SaaS 管理员更改国家。",
    },
  "The service price was not found.": {
    en: "The service price was not found.",
    fr: "Tarif du service introuvable.",
    "zh-CN": "未找到服务价格。",
  },
  "The target branch does not exist or is inactive.": {
    en: "The target branch does not exist or is inactive.",
    fr: "La succursale cible n’existe pas ou est inactive.",
    "zh-CN": "目标门店不存在或已停用。",
  },
  "The target branch does not exist, is inactive, or is outside your access scope.":
    {
      en: "The target branch does not exist, is inactive, or is outside your access scope.",
      fr: "La succursale cible n’existe pas, est inactive ou dépasse vos accès.",
      "zh-CN": "目标门店不存在、已停用或超出您的访问范围。",
    },
  "The tenant currency must match the country tax template before applying it.":
    {
      en: "The tenant currency must match the country tax template before applying it.",
      fr: "La devise du locataire doit correspondre au modèle fiscal du pays avant son application.",
      "zh-CN": "应用模板前，租户币种必须与国家税务模板一致。",
    },
  "This PIN is already used by another employee in the branch.": {
    en: "This PIN is already used by another employee in the branch.",
    fr: "Un autre employé de cette succursale utilise déjà ce PIN.",
    "zh-CN": "该门店其他员工已使用此 PIN。",
  },
  "This PIN is already used by another tenant user.": {
    en: "This PIN is already used by another tenant user.",
    fr: "Un autre utilisateur de ce locataire utilise déjà ce PIN.",
    "zh-CN": "该租户其他用户已使用此 PIN。",
  },
  "This discount cannot be managed with the current branch scope.": {
    en: "This discount cannot be managed with the current branch scope.",
    fr: "Cette remise dépasse les succursales auxquelles vous avez accès.",
    "zh-CN": "此折扣超出当前可管理的门店范围。",
  },
  "This import ID was already used for a different file. Start a new import.": {
    en: "This import ID was already used for a different file. Start a new import.",
    fr: "Cet identifiant d’import a déjà servi à un autre fichier. Lancez un nouvel import.",
    "zh-CN": "此导入标识已用于其他文件，请重新发起导入。",
  },
  "This tax class is managed by the country template. Ask a SaaS administrator to change the template.":
    {
      en: "This tax class is managed by the country template. Ask a SaaS administrator to change the template.",
      fr: "Cette catégorie fiscale est gérée par le modèle du pays. Demandez à un administrateur SaaS de modifier le modèle.",
      "zh-CN": "此税类由国家模板管理，请联系 SaaS 管理员修改模板。",
    },
  "This tax rate is still assigned to services or products. Reassign them or archive the rate instead.":
    {
      en: "This tax rate is still assigned to services or products. Reassign them or archive the rate instead.",
      fr: "Ce taux de taxe est encore attribué à des services ou produits. Réattribuez-les ou archivez le taux.",
      "zh-CN": "此税率仍被服务或商品使用，请先重新分配或归档该税率。",
    },
  "This terminal was securely removed and must be enrolled again before it can be enabled.":
    {
      en: "This terminal was securely removed and must be enrolled again before it can be enabled.",
      fr: "Ce terminal a été supprimé de façon sécurisée. Enregistrez-le à nouveau avant de l’activer.",
      "zh-CN": "此终端已安全移除，重新启用前需要再次绑定。",
    },
  "Timeline cursor is invalid.": {
    en: "Timeline cursor is invalid.",
    fr: "Le curseur de l’historique est invalide.",
    "zh-CN": "时间线分页标识无效。",
  },
  "Use personal account settings to change your own account.": {
    en: "Use personal account settings to change your own account.",
    fr: "Modifiez votre propre compte dans les paramètres de votre profil.",
    "zh-CN": "请在个人账户设置中修改自己的账号。",
  },
  "User cannot access the requested branch.": {
    en: "User cannot access the requested branch.",
    fr: "Vous n’avez pas accès à la succursale demandée.",
    "zh-CN": "无权访问请求的门店。",
  },
  "Verify the payment integration before enabling it on POS terminals.": {
    en: "Verify the payment integration before enabling it on POS terminals.",
    fr: "Vérifiez l’intégration de paiement avant de l’activer sur les terminaux POS.",
    "zh-CN": "在 POS 终端启用前，请先验证支付接入。",
  },
  "deviceOfflineAfterSeconds must be at least twice syncIntervalSeconds.": {
    en: "deviceOfflineAfterSeconds must be at least twice syncIntervalSeconds.",
    fr: "Le délai de détection hors ligne doit être au moins égal au double de l’intervalle de synchronisation.",
    "zh-CN": "离线判定时长必须至少为同步间隔的两倍。",
  },
};

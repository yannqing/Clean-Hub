/** Country readiness guidance shared by tenant creation and editing. */

export const countrySetupEn = {
  required: "Country is required to determine checkout tax and currency.",
  pending:
    "After creation, enter the tax number, create a branch and catalogue, and enroll a terminal before checkout.",
  selected: "Tax template applied automatically",
  unavailable: "Could not load country tax templates. Try again later.",
  empty:
    "No country tax templates are ready. Configure one in platform settings first.",
  missing:
    "This country has no usable tax template. Tenant creation and checkout are unavailable until one is configured.",
  configure: "Configure tax template",
  currency:
    "Currency is set automatically by the selected country's tax template.",
  change:
    "Changing country synchronizes tax and currency and clears the old tax number. Existing sales, carts, prices, or enrolled terminals require a dedicated migration before a currency change.",
};

export const countrySetupFr = {
  required:
    "Le pays est obligatoire pour déterminer la fiscalité et la devise.",
  pending:
    "Après la création, renseignez le numéro fiscal, créez un magasin et un catalogue, puis inscrivez un terminal avant l’encaissement.",
  selected: "Modèle fiscal appliqué automatiquement",
  unavailable:
    "Impossible de charger les modèles fiscaux. Réessayez plus tard.",
  empty:
    "Aucun modèle fiscal disponible. Configurez-en un dans les paramètres de la plateforme.",
  missing:
    "Ce pays n'a pas de modèle fiscal utilisable. La création du locataire et l'encaissement sont indisponibles.",
  configure: "Configurer le modèle fiscal",
  currency:
    "La devise est définie automatiquement par le modèle fiscal du pays.",
  change:
    "Changer de pays synchronise le modèle fiscal et la devise, puis efface l'ancien numéro fiscal. Si des ventes, paniers, prix ou terminaux inscrits existent, le changement de devise exige une migration dédiée.",
};

export const countrySetupZhCN = {
  required: "国家为必填项，用于确定收银税务和币种。",
  pending:
    "创建后仍需填写税务登记号、建立门店和目录、绑定终端，完成前不可收银。",
  selected: "将自动应用税务模板",
  unavailable: "无法加载国家税务模板，请稍后重试。",
  empty: "尚无可用的国家税务模板，请先在平台设置中配置。",
  missing: "该国家尚未配置可用的税务模板，暂时无法创建租户或结款。",
  configure: "前往配置税务模板",
  currency: "货币由所选国家的税务模板自动确定。",
  change:
    "更换国家将同步税务模板及币种，并清除原税号；若已有交易、购物车、价格或绑定终端，跨币种更换需先完成专门迁移。",
};

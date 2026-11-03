import { isApiHttpError } from "@cleanhub/api-client";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";
import { posMessage } from "@/lib/pos-message";

type PosErrorLocale = "zh-CN" | "en" | "fr";

const POS_API_ERROR_MESSAGES: Record<string, Record<PosErrorLocale, string>> = {
  POS_TAX_STATUS_UNAVAILABLE: {
    "zh-CN": "暂时无法验证税务设置，收银结款已暂停。请连接网络并同步终端；如仍无法使用，请联系店主或店长。",
    en: "Tax settings cannot be verified, so checkout is paused. Connect and sync the terminal; contact the owner or manager if this continues.",
    fr: "Les paramètres fiscaux ne peuvent pas être vérifiés ; l'encaissement est suspendu. Connectez et synchronisez le terminal, puis contactez le responsable si nécessaire.",
  },
  POS_TAX_COUNTRY_REQUIRED: {
    "zh-CN": "尚未设置租户国家，暂不能收银。请联系 SaaS 管理员填写国家。",
    en: "The tenant country is missing. Ask a SaaS administrator to set it before checkout.",
    fr: "Le pays du locataire manque. Demandez à l'administrateur SaaS de le renseigner avant l'encaissement.",
  },
  POS_TAX_TEMPLATE_REQUIRED: {
    "zh-CN": "国家税务模板尚未配置，暂不能收银。请 SaaS 管理员在平台设置中填写或上传模板，再由店主应用。",
    en: "The country tax template is missing. Ask a SaaS administrator to complete or import it, then ask the owner to apply it.",
    fr: "Le modèle fiscal du pays manque. Demandez à l'administrateur SaaS de le saisir ou l'importer, puis au propriétaire de l'appliquer.",
  },
  POS_TAX_TEMPLATE_NOT_APPLIED: {
    "zh-CN": "当前国家税务模板尚未应用或已更新，暂不能收银。请店主在租户设置中应用模板并同步终端。",
    en: "The current tax template is not applied. Ask the owner to apply it in tenant settings and sync the terminal.",
    fr: "Le modèle fiscal actuel n'est pas appliqué. Demandez au propriétaire de l'appliquer dans les paramètres et de synchroniser le terminal.",
  },
  POS_TAX_CONFIGURATION_INCOMPLETE: {
    "zh-CN": "税务设置不完整，暂不能收银。请店主在 POS 设置中启用税务并填写税务登记号。",
    en: "Tax settings are incomplete. Ask the owner to enable tax and enter the tax registration number in POS settings.",
    fr: "Les paramètres fiscaux sont incomplets. Demandez au propriétaire d'activer la taxe et de saisir le numéro fiscal dans les paramètres POS.",
  },
  POS_TAX_CURRENCY_MISMATCH: {
    "zh-CN": "租户或门店币种与国家税务模板不一致，暂不能收银。请管理员核对币种。",
    en: "The tenant or store currency differs from the tax template. Ask an administrator to correct it.",
    fr: "La devise du locataire ou du magasin diffère du modèle fiscal. Demandez à l'administrateur de la corriger.",
  },
  INVALID_CREDENTIALS: {
    "zh-CN": "PIN 码不正确，请重新输入。",
    en: "The PIN is incorrect. Try again.",
    fr: "Le code PIN est incorrect. Réessayez.",
  },
  ACCOUNT_LOCKED: {
    "zh-CN": "登录失败次数过多，请稍后再试。",
    en: "Too many failed sign-in attempts. Try again later.",
    fr: "Trop de tentatives de connexion ont échoué. Réessayez plus tard.",
  },
  POS_TERMINAL_ENROLLMENT_REQUIRED: {
    "zh-CN": "此终端尚未登记，请联系店主或店长完成终端登记。",
    en: "This terminal is not enrolled. Ask an owner or manager to enroll it.",
    fr: "Ce terminal n'est pas enregistré. Demandez à un propriétaire ou à un responsable de l'enregistrer.",
  },
  POS_TERMINAL_DISABLED: {
    "zh-CN": "此终端已停用，请联系店主或店长。",
    en: "This terminal is disabled. Contact an owner or manager.",
    fr: "Ce terminal est désactivé. Contactez un propriétaire ou un responsable.",
  },
  POS_TERMINAL_CREDENTIAL_INVALID: {
    "zh-CN": "终端凭据已失效，请重新登记此终端。",
    en: "The terminal credential has expired. Enroll this terminal again.",
    fr: "L'identifiant du terminal a expiré. Enregistrez à nouveau ce terminal.",
  },
  FORBIDDEN: {
    "zh-CN": "当前账号没有执行此操作的权限。",
    en: "Your account does not have permission for this action.",
    fr: "Votre compte n'est pas autorisé à effectuer cette action.",
  },
  POS_PHONE_CONFLICT: {
    "zh-CN": "该手机号已存在客户账户。",
    en: "A customer account with this phone already exists.",
    fr: "Un compte client avec ce numéro de téléphone existe déjà.",
  },
  POS_EMAIL_CONFLICT: {
    "zh-CN": "该邮箱已存在客户账户。",
    en: "A customer account with this email already exists.",
    fr: "Un compte client avec cette adresse e-mail existe déjà.",
  },
  POS_PHONE_OR_EMAIL_REQUIRED: {
    "zh-CN": "请至少填写手机号或邮箱。",
    en: "Enter at least a phone number or an email address.",
    fr: "Saisissez au moins un numéro de téléphone ou une adresse e-mail.",
  },
  POS_ACCOUNT_NOT_FOUND: {
    "zh-CN": "客户账户不存在或已被删除。",
    en: "The customer account does not exist or has been deleted.",
    fr: "Le compte client n'existe pas ou a été supprimé.",
  },
  POS_CUSTOMER_NOT_FOUND: {
    "zh-CN": "客户档案不存在或已被删除。",
    en: "The customer profile does not exist or has been deleted.",
    fr: "Le profil client n'existe pas ou a été supprimé.",
  },
  POS_ACCOUNT_DISABLED: {
    "zh-CN": "客户账户已停用，无法新增档案。",
    en: "The customer account is disabled, so a new profile cannot be added.",
    fr: "Le compte client est désactivé, il est impossible d'ajouter un profil.",
  },
  POS_CUSTOMER_ALREADY_DISABLED: {
    "zh-CN": "客户档案已停用。",
    en: "The customer profile is already disabled.",
    fr: "Le profil client est déjà désactivé.",
  },
  POS_CUSTOMER_NOT_DISABLED: {
    "zh-CN": "客户档案未停用。",
    en: "The customer profile is not disabled.",
    fr: "Le profil client n'est pas désactivé.",
  },
  VALIDATION_ERROR: {
    "zh-CN": "提交内容校验未通过，请检查表单。",
    en: "Validation failed. Check the form and try again.",
    fr: "La validation a échoué. Vérifiez le formulaire puis réessayez.",
  },
  TICKET_ITEM_ALREADY_ORDERED: {
    "zh-CN": "一个或多个工单项目已经生成过订单，请刷新工单后重试。",
    en: "One or more ticket items are already linked to an order. Refresh the ticket and try again.",
    fr: "Un ou plusieurs articles du ticket sont déjà liés à une commande. Actualisez le ticket puis réessayez.",
  },
  SERVICE_TICKET_NOT_FOUND: {
    "zh-CN": "工单不存在、已删除或不属于当前租户。",
    en: "The ticket was not found, was deleted, or belongs to another tenant.",
    fr: "Le ticket est introuvable, a été supprimé ou appartient à un autre tenant.",
  },
  CUSTOMER_REQUIRED: {
    "zh-CN": "服务项目必须关联客户档案。",
    en: "Service items must be linked to a customer profile.",
    fr: "Les services doivent être liés à un profil client.",
  },
  INSUFFICIENT_STOCK: {
    "zh-CN": "商品库存不足，请调整购物车数量。",
    en: "There is not enough stock. Adjust the cart quantity.",
    fr: "Le stock est insuffisant. Modifiez la quantité dans le panier.",
  },
  PRICE_CHANGED: {
    "zh-CN": "商品价格或折扣已变化，系统已刷新金额，请重新确认收款。",
    en: "A price or discount changed. Review the refreshed total and confirm again.",
    fr: "Un prix ou une réduction a changé. Vérifiez le nouveau total et confirmez à nouveau.",
  },
  SHIFT_REQUIRED: {
    "zh-CN": "现金收款必须关联当前员工的有效班次。",
    en: "A cash payment must belong to the current employee's valid shift.",
    fr: "Le paiement en espèces doit appartenir au service valide de l’employé actuel.",
  },
  CASH_TENDER_INSUFFICIENT: {
    "zh-CN": "实收现金不能少于应付金额。",
    en: "Cash tendered must cover the amount due.",
    fr: "Les espèces reçues doivent couvrir le montant à payer.",
  },
  PAYMENT_AMOUNT_NOT_PAYABLE: {
    "zh-CN": "现金金额必须是该币种可实际支付的面额，请调整后重试。",
    en: "The cash amount must be payable in this currency. Adjust it and try again.",
    fr: "Le montant en espèces doit être payable dans cette devise. Corrigez-le et réessayez.",
  },
  CASH_AMOUNT_NOT_PAYABLE: {
    "zh-CN": "现金进出金额必须是该币种可实际支付的面额，请调整后重试。",
    en: "The cash movement must be payable in this currency. Adjust it and try again.",
    fr: "Le mouvement d'espèces doit être payable dans cette devise. Corrigez-le et réessayez.",
  },
  CASH_SESSION_REQUIRED: {
    "zh-CN": "请先开启可跟踪的钱箱会话，再登记现金进出。",
    en: "Open a tracked cash session before recording cash movements.",
    fr: "Ouvrez une session d'espèces suivie avant d'enregistrer des mouvements.",
  },
};

export function getPosTaxReadinessMessage(code: string | null | undefined): string {
  const locale = getPosRuntimeLocale();
  return (code && POS_API_ERROR_MESSAGES[code]?.[locale]) ?? POS_API_ERROR_MESSAGES.POS_TAX_STATUS_UNAVAILABLE[locale];
}

const POS_ACCOUNT_LOCKED_UNTIL_MESSAGES: Record<
  PosErrorLocale,
  (lockedUntil: string) => string
> = {
  "zh-CN": (lockedUntil) =>
    posMessage("pos.inline.loginLockedUntil", { time: lockedUntil }),
  en: (lockedUntil) =>
    `Too many failed sign-in attempts. Sign-in is locked until ${lockedUntil}.`,
  fr: (lockedUntil) =>
    `Trop de tentatives de connexion ont échoué. La connexion est verrouillée jusqu’au ${lockedUntil}.`,
};

function formatLockedUntil(
  value: string | undefined,
  locale: PosErrorLocale,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function getPosApiErrorMessage(
  error: unknown,
  fallback = "操作失败，请重试。",
): string {
  if (isApiHttpError(error)) {
    const locale = getPosRuntimeLocale();
    const lockedUntil =
      error.code === "ACCOUNT_LOCKED"
        ? formatLockedUntil(error.lockedUntil, locale)
        : undefined;

    if (lockedUntil) {
      return POS_ACCOUNT_LOCKED_UNTIL_MESSAGES[locale](lockedUntil);
    }

    const messages = error.code
      ? POS_API_ERROR_MESSAGES[error.code]
      : undefined;
    return messages?.[locale] ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

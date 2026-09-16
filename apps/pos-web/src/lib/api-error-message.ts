import { isApiHttpError } from "@cleanhub/api-client";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

type PosErrorLocale = "zh-CN" | "en" | "fr";

const POS_API_ERROR_MESSAGES: Record<string, Record<PosErrorLocale, string>> = {
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

const POS_ACCOUNT_LOCKED_UNTIL_MESSAGES: Record<
  PosErrorLocale,
  (lockedUntil: string) => string
> = {
  "zh-CN": (lockedUntil) =>
    `登录失败次数过多，已锁定至 ${lockedUntil}，请在此时间后重试。`,
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

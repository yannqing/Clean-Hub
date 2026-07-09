import { isApiHttpError } from "@cleanhub/api-client";

import { getPosRuntimeLocale } from "@/components/i18n/pos-runtime-text";

type PosErrorLocale = "zh-CN" | "en" | "fr";

const POS_API_ERROR_MESSAGES: Record<
  string,
  Record<PosErrorLocale, string>
> = {
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
};

export function getPosApiErrorMessage(
  error: unknown,
  fallback = "操作失败，请重试。",
): string {
  if (isApiHttpError(error)) {
    const messages = error.code ? POS_API_ERROR_MESSAGES[error.code] : undefined;
    return messages?.[getPosRuntimeLocale()] ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

import { toast } from "@cleanhub/ui";

import {
  getPosRuntimeLocale,
  translatePosText,
} from "@/components/i18n/pos-runtime-text";

type ToastMethod = typeof toast.success;
type ToastArgs = Parameters<ToastMethod>;
type ToastRestArgs = ToastArgs extends [unknown, ...infer Rest] ? Rest : never;

function localizeMessage(message: Parameters<ToastMethod>[0]) {
  if (typeof message !== "string") {
    return message;
  }

  const locale = getPosRuntimeLocale();
  if (locale === "zh-CN") {
    return message;
  }

  const orderStatusMatch = message.match(/^订单状态已更新为「(.+)」。$/);
  if (orderStatusMatch) {
    const status = translatePosText(orderStatusMatch[1] ?? "", locale);
    return locale === "fr"
      ? `Statut de la commande mis à jour : « ${status} ».`
      : `Order status updated to "${status}".`;
  }

  const ticketStatusMatch = message.match(/^工单状态已更新为「(.+)」$/);
  if (ticketStatusMatch) {
    const status = translatePosText(ticketStatusMatch[1] ?? "", locale);
    return locale === "fr"
      ? `Statut du ticket mis à jour : « ${status} ».`
      : `Ticket status updated to "${status}".`;
  }

  const itemStatusMatch = message.match(/^项目状态已更新为「(.+)」$/);
  if (itemStatusMatch) {
    const status = translatePosText(itemStatusMatch[1] ?? "", locale);
    return locale === "fr"
      ? `Statut de l'article mis à jour : « ${status} ».`
      : `Item status updated to "${status}".`;
  }

  const ticketDeletedMatch = message.match(/^工单\s*(.*?)\s*已删除$/);
  if (ticketDeletedMatch) {
    const ticketNo = ticketDeletedMatch[1]?.trim();
    return locale === "fr"
      ? `Ticket${ticketNo ? ` ${ticketNo}` : ""} supprimé.`
      : `Ticket${ticketNo ? ` ${ticketNo}` : ""} deleted.`;
  }

  return translatePosText(message, locale);
}

export const posToast = {
  ...toast,
  success(message: ToastArgs[0], ...args: ToastRestArgs) {
    return toast.success(localizeMessage(message), ...args);
  },
  error(message: ToastArgs[0], ...args: ToastRestArgs) {
    return toast.error(localizeMessage(message), ...args);
  },
  info(message: ToastArgs[0], ...args: ToastRestArgs) {
    return toast.info(localizeMessage(message), ...args);
  },
  warning(message: ToastArgs[0], ...args: ToastRestArgs) {
    return toast.warning(localizeMessage(message), ...args);
  },
};

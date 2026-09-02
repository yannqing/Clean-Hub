export type SystemNotificationLocale = "en" | "fr" | "zh-CN";

export type SystemNotificationCopy = {
  locale: SystemNotificationLocale;
  title: string;
  content: string;
};

const POS_SYNC_ERROR_TITLES = new Set([
  "POS synchronization error",
  "Erreur de synchronisation POS",
  "POS 同步错误",
]);

function normalizeLocale(locale: string): SystemNotificationLocale {
  if (locale.toLowerCase().startsWith("fr")) {
    return "fr";
  }

  if (locale.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  return "en";
}

export function getPosSyncErrorNotificationCopy(
  locale: string,
  terminalId: string,
): SystemNotificationCopy {
  const normalizedLocale = normalizeLocale(locale);

  if (normalizedLocale === "fr") {
    return {
      locale: normalizedLocale,
      title: "Erreur de synchronisation POS",
      content: `Le terminal ${terminalId} ne peut pas synchroniser ses ventes. Veuillez contacter l’assistance.`,
    };
  }

  if (normalizedLocale === "zh-CN") {
    return {
      locale: normalizedLocale,
      title: "POS 同步错误",
      content: `终端 ${terminalId} 无法同步销售数据，请联系支持人员。`,
    };
  }

  return {
    locale: normalizedLocale,
    title: "POS synchronization error",
    content: `Terminal ${terminalId} cannot synchronize its sales. Please contact support.`,
  };
}

export function isPosSyncErrorNotification(input: {
  noticeType: string;
  relatedType: string | null;
  title: string;
}): boolean {
  return (
    input.noticeType === "system" &&
    input.relatedType === "pos_terminal" &&
    POS_SYNC_ERROR_TITLES.has(input.title)
  );
}

"use client";

import { Toaster } from "@cleanhub/ui";
import { useWebAdminLocale } from "@/i18n";

export function LocalizedToaster() {
  const { messages } = useWebAdminLocale();
  return (
    <Toaster
      containerAriaLabel={messages.tenant.notificationCenter.title}
      toastOptions={{
        closeButtonAriaLabel: messages.common.close,
        classNames: {
          toast: "border-border bg-background text-foreground",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

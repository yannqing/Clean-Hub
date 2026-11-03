"use client";

import { DialogClose, DialogContent, Icon } from "@cleanhub/ui";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { useSaasI18n } from "@/i18n";

/** Localize the generated primitive’s default close control at the app layer. */
export function SaasDialogContent({
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const { m } = useSaasI18n();
  return (
    <DialogContent {...props} showCloseButton={false}>
      {children}
      {showCloseButton ? (
        <DialogClose
          aria-label={m.common.close}
          className="absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <Icon aria-hidden icon={X} size={16} />
        </DialogClose>
      ) : null}
    </DialogContent>
  );
}

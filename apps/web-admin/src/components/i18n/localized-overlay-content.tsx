"use client";

import {
  DialogClose,
  DialogContent,
  SheetClose,
  SheetContent,
  Icon,
} from "@cleanhub/ui";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { useWebAdminLocale } from "@/i18n";

const closeClassName =
  "absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none";

export function LocalizedDialogContent({
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const { messages } = useWebAdminLocale();
  return (
    <DialogContent {...props} showCloseButton={false}>
      {children}
      {showCloseButton ? (
        <DialogClose
          aria-label={messages.common.close}
          className={closeClassName}
        >
          <Icon aria-hidden icon={X} size={16} />
        </DialogClose>
      ) : null}
    </DialogContent>
  );
}

export function LocalizedSheetContent({
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof SheetContent>) {
  const { messages } = useWebAdminLocale();
  return (
    <SheetContent {...props} showCloseButton={false}>
      {children}
      {showCloseButton ? (
        <SheetClose
          aria-label={messages.common.close}
          className={closeClassName}
        >
          <Icon aria-hidden icon={X} size={16} />
        </SheetClose>
      ) : null}
    </SheetContent>
  );
}

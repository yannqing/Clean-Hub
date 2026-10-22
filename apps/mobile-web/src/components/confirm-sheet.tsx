"use client";

import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@cleanhub/ui";
import { AlertCircle, Loader2 } from "lucide-react";

type ConfirmSheetProps = {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  isSubmitting?: boolean;
  open: boolean;
  title: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmSheet({
  cancelLabel,
  confirmLabel,
  description,
  isSubmitting = false,
  open,
  title,
  onConfirm,
  onOpenChange,
}: ConfirmSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <SheetFooter className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <SheetClose asChild>
            <Button className="h-11" disabled={isSubmitting} type="button" variant="outline">
              {cancelLabel}
            </Button>
          </SheetClose>
          <Button
            className="h-11"
            disabled={isSubmitting}
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <AlertCircle className="size-4" aria-hidden="true" />
            )}
            {confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

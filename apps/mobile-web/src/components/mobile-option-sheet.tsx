"use client";

import { type ReactNode, useId, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from "@cleanhub/ui";
import { Check, ChevronDown } from "lucide-react";

export type MobileOption = {
  value: string;
  label: ReactNode;
  selectedLabel?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

type MobileOptionSheetProps = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  options: MobileOption[];
  placeholder: ReactNode;
  title: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
};

export function MobileOptionSheet({
  ariaLabel,
  className,
  disabled = false,
  id,
  options,
  placeholder,
  title,
  value,
  onValueChange,
}: MobileOptionSheetProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={cn(
          "flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-left text-base shadow-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
        disabled={disabled}
        id={id}
        type="button"
        onClick={() => setOpen(true)}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !selectedOption && "text-muted-foreground",
          )}
        >
          {selectedOption?.selectedLabel ?? selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
      </button>

      <SheetContent className="max-h-[78dvh] overflow-hidden p-0">
        <div className="flex max-h-[78dvh] min-h-0 flex-col">
          <SheetHeader className="shrink-0 border-b border-slate-200 px-5 pb-4 pt-1 text-left">
            <SheetTitle id={titleId}>{title}</SheetTitle>
            <SheetDescription className="sr-only">{placeholder}</SheetDescription>
          </SheetHeader>

          <div
            aria-labelledby={titleId}
            className="min-h-0 overflow-y-auto overscroll-contain px-3 py-2 pb-[max(12px,env(safe-area-inset-bottom))]"
            role="radiogroup"
          >
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  aria-checked={selected}
                  className={cn(
                    "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-md px-3 py-3 text-left transition disabled:opacity-40",
                    selected ? "bg-blue-50 text-blue-900" : "text-slate-800 active:bg-slate-100",
                  )}
                  disabled={option.disabled}
                  key={option.value}
                  role="radio"
                  type="button"
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium leading-5">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block break-words text-xs leading-5 text-slate-500">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  <Check
                    className={cn(
                      "size-5 shrink-0 text-blue-600",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

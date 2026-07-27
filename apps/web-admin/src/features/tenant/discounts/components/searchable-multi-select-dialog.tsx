"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
} from "@cleanhub/ui";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { interpolate, useTenantI18n } from "@/i18n";

export type MultiSelectDialogItem = {
  value: string;
  label: string;
  detail?: string;
  group?: string;
};

type SearchableMultiSelectDialogProps = {
  description: string;
  items: MultiSelectDialogItem[];
  onConfirm: (values: string[]) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedValues: string[];
  title: string;
};

export function SearchableMultiSelectDialog({
  description,
  items,
  onConfirm,
  onOpenChange,
  open,
  selectedValues,
  title,
}: SearchableMultiSelectDialogProps) {
  const { m } = useTenantI18n();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Set<string>>(
    () => new Set(selectedValues),
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? items.filter((item) =>
            [item.label, item.detail, item.group].some((value) =>
              value?.toLocaleLowerCase().includes(normalizedQuery),
            ),
          )
        : items,
    [items, normalizedQuery],
  );

  function toggle(value: string, checked: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="grid h-[min(650px,calc(100vh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="relative mb-4">
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={15}
            />
            <Input
              aria-label={m.discounts.form.picker.search}
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={m.discounts.form.picker.search}
              value={query}
            />
          </div>

          <div className="overflow-hidden rounded-lg border">
            {filtered.length > 0 ? (
              filtered.map((item) => {
                const id = `discount-picker-${item.value.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
                return (
                  <label
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/40"
                    htmlFor={id}
                    key={item.value}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {item.label}
                        </span>
                        {item.group ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.group}
                          </span>
                        ) : null}
                      </span>
                      {item.detail ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      ) : null}
                    </span>
                    <Checkbox
                      checked={draft.has(item.value)}
                      id={id}
                      onCheckedChange={(checked) =>
                        toggle(item.value, checked === true)
                      }
                    />
                  </label>
                );
              })
            ) : (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                {m.discounts.form.picker.noMatches}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {interpolate(m.discounts.form.picker.selectedCount, {
              count: String(draft.size),
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              onClick={() => {
                onConfirm([...draft]);
                onOpenChange(false);
              }}
              type="button"
            >
              {m.discounts.form.picker.confirm}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

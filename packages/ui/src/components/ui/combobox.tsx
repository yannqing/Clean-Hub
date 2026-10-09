"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Command } from "cmdk";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

// --- Popover primitives (local to combobox) ---------------------------------

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-(--radix-popover-trigger-width) origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// --- Command primitives (cmdk) ----------------------------------------------

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof Command.List>) {
  return (
    <Command.List
      data-slot="command-list"
      className={cn("max-h-[300px] overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof Command.Input>) {
  return (
    <Command.Input
      data-slot="command-input"
      className={cn(
        "flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof Command.Empty>) {
  return (
    <Command.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof Command.Group>) {
  return (
    <Command.Group
      data-slot="command-group"
      className={cn(
        "p-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-semibold",
        className
      )}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof Command.Item>) {
  return (
    <Command.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Command.Separator>) {
  return (
    <Command.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

// --- Combobox (high-level) ---------------------------------------------------

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  /** Available options to pick from. */
  options: ReadonlyArray<ComboboxOption>;
  /** Current selected value (empty string = unselected). */
  value: string;
  /** Called when the user selects an option or confirms a custom value. */
  onValueChange: (value: string) => void;
  /** Placeholder shown on the trigger when no value is selected. */
  placeholder?: string;
  /** Placeholder shown inside the search input. */
  searchPlaceholder?: string;
  /** Text shown when no options match the search query. */
  emptyText?: string;
  /** Disable the entire control. */
  disabled?: boolean;
  /** Extra class names on the trigger button. */
  className?: string;
};

/**
 * A searchable select that also allows the user to type a custom value.
 *
 * Built on `cmdk` (Command) + `@radix-ui/react-popover`.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "选择…",
  searchPlaceholder = "搜索…",
  emptyText = "无匹配项",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedLabel = options.find((o) => o.value === value)?.label;

  // Filter options: match label or value (case-insensitive).
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(normalizedSearch) ||
          o.value.toLowerCase().includes(normalizedSearch),
      )
    : options;

  // Whether the current search text is an exact match for any option.
  const hasExactMatch = options.some(
    (o) => o.label.toLowerCase() === normalizedSearch || o.value.toLowerCase() === normalizedSearch,
  );

  function handleSelect(optionValue: string) {
    onValueChange(optionValue);
    setSearch("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // When the user presses Enter and the search doesn't match any option,
    // treat it as a custom value submission.
    if (event.key === "Enter" && normalizedSearch && !hasExactMatch) {
      event.preventDefault();
      onValueChange(search.trim());
      setSearch("");
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70",
            className,
          )}
        >
          <span className={cn("truncate", !selectedLabel && !value && "text-slate-400")}>
            {selectedLabel || value || placeholder}
          </span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false} onKeyDown={handleKeyDown}>
          <div className="flex items-center border-b px-3">
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              className="flex-1"
            />
          </div>
          <CommandList>
            {filtered.length > 0 ? (
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {/* Show "use custom" hint when search doesn't match any option */}
            {normalizedSearch && !hasExactMatch ? (
              <CommandEmpty>
                <span className="text-slate-500">
                  {emptyText}「{search}」，按 <kbd className="rounded border px-1 text-xs">Enter</kbd> 确认
                </span>
              </CommandEmpty>
            ) : !normalizedSearch && filtered.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export {
  Command,
  CommandInput as ComboboxInput,
  CommandList as ComboboxList,
  CommandEmpty as ComboboxEmpty,
  CommandGroup as ComboboxGroup,
  CommandItem as ComboboxItem,
  CommandSeparator as ComboboxSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
};

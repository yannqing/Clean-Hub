"use client";

import type { PosCatalogService } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Command,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

import { formatTicketMoney } from "../constants";

type PickerOption = {
  value: string;
  label: string;
  swatch?: string;
};

const servicePickerCopy = {
  en: {
    placeholder: "Select a service",
    search: "Search by service name or category…",
    empty: "No matching services",
    noImage: "No cover",
    perItem: "Per item",
    perKg: "Per kg",
  },
  fr: {
    placeholder: "Sélectionner un service",
    search: "Rechercher par service ou catégorie…",
    empty: "Aucun service correspondant",
    noImage: "Sans image",
    perItem: "Par article",
    perKg: "Par kg",
  },
  "zh-CN": {
    placeholder: "选择服务项目",
    search: "搜索服务名称或分类…",
    empty: "没有匹配的服务项目",
    noImage: "暂无封面",
    perItem: "按件",
    perKg: "按公斤",
  },
} as const;

export function TicketServicePicker({
  disabled,
  onValueChange,
  services,
  value,
}: {
  disabled?: boolean;
  onValueChange: (service: PosCatalogService) => void;
  services: PosCatalogService[];
  value: string;
}) {
  const { locale } = useTranslation();
  const copy = servicePickerCopy[locale];
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = services.find((service) => service.id === value) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filteredServices = useMemo(() => {
    if (!normalizedQuery) return services;

    return services.filter((service) =>
      [
        service.name,
        service.shortName,
        service.categoryName,
        service.description,
      ].some((candidate) =>
        candidate?.toLocaleLowerCase(locale).includes(normalizedQuery),
      ),
    );
  }, [locale, normalizedQuery, services]);

  function select(service: PosCatalogService) {
    onValueChange(service);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover
      modal
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-controls={listId}
          aria-label={copy.placeholder}
          className="flex min-h-16 w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left shadow-xs outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          role="combobox"
          type="button"
        >
          {selected ? (
            <>
              <ServiceThumbnail service={selected} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {selected.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {selected.categoryName} ·{" "}
                  {selected.pricingUnit === "per_kg"
                    ? copy.perKg
                    : copy.perItem}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-foreground">
                  {formatTicketMoney(selected.amount, selected.currency)}
                </span>
                <Icon
                  className="ml-auto mt-1 size-3.5 text-muted-foreground"
                  name="chevron-down"
                />
              </span>
            </>
          ) : (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                <Icon className="size-5" name="package-check" />
              </span>
              <span className="flex-1 text-sm text-muted-foreground">
                {copy.placeholder}
              </span>
              <Icon
                className="size-4 shrink-0 text-muted-foreground"
                name="chevron-down"
              />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="z-[80] w-(--radix-popover-trigger-width) overflow-hidden p-0"
        sideOffset={6}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <Icon className="size-4 text-muted-foreground" name="search" />
            <ComboboxInput
              aria-label={copy.search}
              className="h-11 flex-1 px-0"
              onValueChange={setQuery}
              placeholder={copy.search}
              value={query}
            />
          </div>
          <ComboboxList
            className="max-h-[min(22rem,48dvh)] touch-pan-y overscroll-contain p-1"
            id={listId}
          >
            {filteredServices.length > 0 ? (
              <ComboboxGroup className="p-0">
                {filteredServices.map((service) => (
                  <ComboboxItem
                    className="min-h-[68px] cursor-pointer gap-3 px-2.5 py-2"
                    key={service.id}
                    onSelect={() => select(service)}
                    value={service.id}
                  >
                    <ServiceThumbnail service={service} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {service.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {service.categoryName} ·{" "}
                        {service.pricingUnit === "per_kg"
                          ? copy.perKg
                          : copy.perItem}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold text-foreground">
                      {formatTicketMoney(service.amount, service.currency)}
                    </span>
                    {service.id === value ? (
                      <Icon className="size-4 shrink-0" name="check" />
                    ) : null}
                  </ComboboxItem>
                ))}
              </ComboboxGroup>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {copy.empty}
              </div>
            )}
          </ComboboxList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TicketAttributePicker({
  disabled,
  emptyText,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}: {
  disabled?: boolean;
  emptyText: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<PickerOption>;
  placeholder: string;
  searchPlaceholder: string;
  value: string;
}) {
  const { locale } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const localizedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        localizedLabel: translatePosText(option.label, locale),
      })),
    [locale, options],
  );
  const selected = localizedOptions.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filteredOptions = normalizedQuery
    ? localizedOptions.filter(
        (option) =>
          option.localizedLabel
            .toLocaleLowerCase(locale)
            .includes(normalizedQuery) ||
          option.value.toLocaleLowerCase(locale).includes(normalizedQuery),
      )
    : localizedOptions;
  const exactMatch = localizedOptions.some(
    (option) =>
      option.localizedLabel.toLocaleLowerCase(locale) === normalizedQuery ||
      option.value.toLocaleLowerCase(locale) === normalizedQuery,
  );
  const customValue = query.trim();

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener(
        "pointerdown",
        closeOnOutsidePointer,
        true,
      );
    };
  }, [open]);

  function select(nextValue: string) {
    onValueChange(nextValue);
    setQuery("");
    setOpen(false);
  }

  function closeAndRestoreFocus() {
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="relative" data-ticket-attribute-picker ref={rootRef}>
      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={placeholder}
        className="flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
          if (open) setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.swatch ? <ColorSwatch swatch={selected.swatch} /> : null}
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selected?.localizedLabel || value || placeholder}
          </span>
        </span>
        <Icon
          className="ml-2 size-4 shrink-0 text-muted-foreground"
          name="chevron-down"
        />
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-[80] mt-1 w-full min-w-56 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <Command
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeAndRestoreFocus();
                return;
              }
              if (event.key === "Enter" && customValue && !exactMatch) {
                event.preventDefault();
                select(customValue);
              }
            }}
            shouldFilter={false}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Icon className="size-4 text-muted-foreground" name="search" />
              <ComboboxInput
                aria-label={searchPlaceholder}
                className="h-11 flex-1 px-0"
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                ref={inputRef}
                value={query}
              />
            </div>
            <ComboboxList
              className="max-h-[min(18rem,42dvh)] touch-pan-y overscroll-contain p-1"
              id={listId}
            >
              {filteredOptions.length > 0 ? (
                <ComboboxGroup className="p-0">
                  {filteredOptions.map((option) => (
                    <ComboboxItem
                      className="min-h-10 cursor-pointer"
                      key={option.value}
                      onSelect={() => select(option.value)}
                      value={option.value}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          option.value === value ? "opacity-100" : "opacity-0",
                        )}
                        name="check"
                      />
                      {option.swatch ? (
                        <ColorSwatch swatch={option.swatch} />
                      ) : null}
                      <span className="truncate">{option.localizedLabel}</span>
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              ) : null}
              {customValue && !exactMatch ? (
                <ComboboxItem
                  className="min-h-11 cursor-pointer"
                  onSelect={() => select(customValue)}
                  value={`custom:${customValue}`}
                >
                  <Icon className="size-4 shrink-0" name="plus" />
                  <span className="truncate">
                    {emptyText}「{customValue}」
                  </span>
                </ComboboxItem>
              ) : !customValue && filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              ) : null}
            </ComboboxList>
          </Command>
        </div>
      ) : null}
    </div>
  );
}

function ColorSwatch({ swatch }: { swatch: string }) {
  return (
    <span
      aria-hidden
      className="size-5 shrink-0 rounded-full border border-black/15 shadow-sm"
      style={{ background: swatch }}
    />
  );
}

function ServiceThumbnail({ service }: { service: PosCatalogService }) {
  const { locale } = useTranslation();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const cover =
    service.media.find((media) => media.isPrimary) ?? service.media[0] ?? null;
  const imageUrl = cover?.downloadUrl ?? null;

  return (
    <span
      className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground"
      title={imageUrl ? undefined : servicePickerCopy[locale].noImage}
    >
      <Icon className="size-5" name="package-check" />
      {imageUrl && failedUrl !== imageUrl ? (
        <Image
          alt={service.name}
          className="absolute inset-0 size-full object-cover"
          height={44}
          onError={() => setFailedUrl(imageUrl)}
          sizes="44px"
          src={imageUrl}
          unoptimized
          width={44}
        />
      ) : null}
    </span>
  );
}

"use client";

import type {
  PosCatalogProduct,
  PosCatalogService,
} from "@cleanhub/api-client";
import { businessLineLabels, type SupportedLocale } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  Icon,
  PosEmptyState,
  PosMetricStrip,
  PosPageHeader,
  PosTableSurface,
} from "@/components/app-shell";
import { posRoutes } from "@/config";

type CatalogViewFilter = "all" | "products" | "services";

type CatalogViewProps = {
  branchName: string;
  products: PosCatalogProduct[];
  query: string;
  services: PosCatalogService[];
};

type CatalogListItem =
  | { kind: "product"; item: PosCatalogProduct }
  | { kind: "service"; item: PosCatalogService };

const FILTERS: readonly CatalogViewFilter[] = ["all", "products", "services"];

export function CatalogView({
  branchName,
  products,
  query,
  services,
}: CatalogViewProps) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<CatalogViewFilter>("all");
  const [draft, setDraft] = useState(query);
  const [isPending, startTransition] = useTransition();
  const total = products.length + services.length;
  const availableProductCount = products.filter(isProductAvailable).length;
  const rows: CatalogListItem[] = [
    ...(filter === "services"
      ? []
      : products.map((item) => ({ kind: "product" as const, item }))),
    ...(filter === "products"
      ? []
      : services.map((item) => ({ kind: "service" as const, item }))),
  ];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = draft.trim();
    startTransition(() => {
      router.replace(
        normalized
          ? `${posRoutes.catalog}?q=${encodeURIComponent(normalized)}`
          : posRoutes.catalog,
        { scroll: false },
      );
    });
  }

  function clearSearch() {
    setDraft("");
    startTransition(() => {
      router.replace(posRoutes.catalog, { scroll: false });
    });
  }

  return (
    <section className="space-y-7 pb-8">
      <PosPageHeader
        actions={
          <>
            <Badge variant="secondary">{t("pos.catalog.readOnlyBadge")}</Badge>
            <span className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" name="store" />
              {t("pos.catalog.branchScope", { branch: branchName })}
            </span>
          </>
        }
        description={t("pos.catalog.readOnlyHint")}
        icon="package-check"
        title={t("pos.catalog.title")}
      />

      <PosMetricStrip
        ariaLabel={t("pos.catalog.title")}
        className="grid-cols-2"
        metrics={[
          {
            icon: "package-check",
            label: t("pos.catalog.totalCount"),
            value: total,
          },
          {
            icon: "package-check",
            label: t("pos.catalog.productCount"),
            value: products.length,
          },
          {
            icon: "clipboard-list",
            label: t("pos.catalog.serviceCount"),
            value: services.length,
          },
          {
            icon: "check",
            label: t("pos.catalog.availableProductCount"),
            value: availableProductCount,
          },
        ]}
      />

      <PosTableSurface className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-fit rounded-md bg-muted p-1">
            {FILTERS.map((value) => (
              <button
                aria-pressed={filter === value}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                  filter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {value === "all"
                  ? t("pos.catalog.all")
                  : value === "products"
                    ? t("pos.catalog.products")
                    : t("pos.catalog.services")}
              </button>
            ))}
          </div>

          <form
            className="flex min-w-0 gap-2 sm:w-[420px]"
            onSubmit={submitSearch}
          >
            <div className="relative min-w-0 flex-1">
              <Icon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                name="search"
              />
              <Input
                aria-label={t("pos.catalog.searchPlaceholder")}
                className="pl-9 pr-9"
                disabled={isPending}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("pos.catalog.searchPlaceholder")}
                value={draft}
              />
              {draft ? (
                <button
                  aria-label={t("pos.catalog.clearSearch")}
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={clearSearch}
                  type="button"
                >
                  <Icon className="size-3.5" name="x" />
                </button>
              ) : null}
            </div>
            <Button className="shrink-0" disabled={isPending} type="submit">
              {t("pos.catalog.search")}
            </Button>
          </form>
        </div>

        {rows.length > 0 ? (
          <CatalogTable locale={locale} rows={rows} />
        ) : (
          <CatalogEmptyState filter={filter} hasQuery={Boolean(query)} />
        )}
      </PosTableSurface>
    </section>
  );
}

function CatalogTable({
  locale,
  rows,
}: {
  locale: SupportedLocale;
  rows: CatalogListItem[];
}) {
  const { t } = useTranslation();
  const router = useRouter();

  function openItem(row: CatalogListItem) {
    router.push(getCatalogItemHref(row));
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    row: CatalogListItem,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openItem(row);
  }

  return (
    <>
      <div className="divide-y min-[900px]:hidden">
        {rows.map((row) => (
          <CatalogMobileCard
            key={getCatalogItemKey(row)}
            locale={locale}
            row={row}
          />
        ))}
      </div>

      <div className="hidden min-[900px]:block">
        <Table className="text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead>{t("pos.catalog.item")}</TableHead>
              <TableHead>{t("pos.catalog.itemType")}</TableHead>
              <TableHead>{t("pos.catalog.category")}</TableHead>
              <TableHead>{t("pos.catalog.identifier")}</TableHead>
              <TableHead>{t("pos.catalog.price")}</TableHead>
              <TableHead>{t("pos.catalog.inventory")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = getCatalogItemHref(row);
              const product = row.kind === "product" ? row.item : null;
              const service = row.kind === "service" ? row.item : null;

              return (
                <TableRow
                  className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                  key={getCatalogItemKey(row)}
                  onClick={() => openItem(row)}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  onMouseEnter={() => router.prefetch(href)}
                  tabIndex={0}
                >
                  <TableCell className="max-w-64">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CatalogThumbnail
                        className="size-10"
                        item={row.item}
                        name={product ? product.name : service!.name}
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {product ? product.name : service?.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {product
                            ? (product.variantName ?? product.unitOfMeasure)
                            : businessLineLabels[locale][service!.businessLine]}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CatalogTypeBadge kind={row.kind} />
                  </TableCell>
                  <TableCell className="max-w-44 truncate">
                    {product
                      ? (product.categoryName ?? t("common.unavailable"))
                      : service?.categoryName}
                  </TableCell>
                  <TableCell className="max-w-56">
                    {product ? (
                      <>
                        <span className="block truncate font-mono text-[11px]">
                          {product.sku}
                        </span>
                        {product.barcode ? (
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                            {product.barcode}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      formatPricingUnit(service!.pricingUnit, t)
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCatalogMoney(
                      row.item.amount,
                      row.item.currency,
                      locale,
                    )}
                  </TableCell>
                  <TableCell>
                    {product
                      ? formatProductInventory(product, locale, t)
                      : formatTurnaround(service!.turnaroundMinutes, t)}
                  </TableCell>
                  <TableCell>
                    <Icon
                      className="size-3.5 text-muted-foreground"
                      name="chevron-right"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function CatalogMobileCard({
  locale,
  row,
}: {
  locale: SupportedLocale;
  row: CatalogListItem;
}) {
  const { t } = useTranslation();
  const product = row.kind === "product" ? row.item : null;
  const service = row.kind === "service" ? row.item : null;

  return (
    <Link
      className="block min-h-28 px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      href={getCatalogItemHref(row)}
    >
      <div className="flex items-start gap-3">
        <CatalogThumbnail
          className="size-16 sm:size-18"
          item={row.item}
          name={product ? product.name : service!.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CatalogTypeBadge kind={row.kind} />
                <span className="truncate text-sm font-medium text-foreground">
                  {product ? formatProductName(product) : service?.name}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-foreground">
                {product
                  ? (product.categoryName ?? t("common.unavailable"))
                  : service?.categoryName}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {product
                  ? product.sku
                  : `${businessLineLabels[locale][service!.businessLine]} · ${formatPricingUnit(service!.pricingUnit, t)}`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold">
              {formatCatalogMoney(row.item.amount, row.item.currency, locale)}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span>
              {product
                ? formatProductInventory(product, locale, t)
                : formatTurnaround(service!.turnaroundMinutes, t)}
            </span>
            <span className="flex items-center gap-1">
              {t("pos.catalog.view")}
              <Icon className="size-3.5" name="chevron-right" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CatalogThumbnail({
  className,
  item,
  name,
}: {
  className?: string;
  item: PosCatalogProduct | PosCatalogService;
  name: string;
}) {
  const cover = item.media.find((media) => media.isPrimary) ?? item.media[0];

  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-md border bg-muted text-muted-foreground",
        className,
      )}
    >
      {cover ? (
        <Image
          alt={name}
          className="object-cover"
          fill
          sizes="72px"
          src={cover.downloadUrl}
          unoptimized
        />
      ) : (
        <Icon className="m-auto size-5" name="package-check" />
      )}
    </span>
  );
}

function CatalogTypeBadge({ kind }: { kind: CatalogListItem["kind"] }) {
  const { t } = useTranslation();

  return (
    <Badge variant={kind === "product" ? "secondary" : "outline"}>
      {kind === "product"
        ? t("pos.catalog.products")
        : t("pos.catalog.services")}
    </Badge>
  );
}

function CatalogEmptyState({
  filter,
  hasQuery,
}: {
  filter: CatalogViewFilter;
  hasQuery: boolean;
}) {
  const { t } = useTranslation();
  const description = hasQuery
    ? t("pos.catalog.noResultsHint")
    : filter === "products"
      ? t("pos.catalog.noProducts")
      : filter === "services"
        ? t("pos.catalog.noServices")
        : t("pos.catalog.readOnlyHint");

  return (
    <PosEmptyState
      description={description}
      icon={hasQuery ? "search-x" : "package-check"}
      title={t("pos.catalog.noResultsTitle")}
    />
  );
}

function getCatalogItemKey(row: CatalogListItem): string {
  return row.kind === "product"
    ? `product-${row.item.productSkuId}`
    : `service-${row.item.id}`;
}

function getCatalogItemHref(row: CatalogListItem): string {
  return row.kind === "product"
    ? posRoutes.catalogProductDetail(row.item.productSkuId)
    : posRoutes.catalogServiceDetail(row.item.id);
}

export function formatProductName(product: PosCatalogProduct): string {
  return product.variantName
    ? `${product.name} · ${product.variantName}`
    : product.name;
}

export function formatCatalogMoney(
  amount: string,
  currency: string,
  locale: SupportedLocale,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      currency,
      style: "currency",
    }).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function formatProductInventory(
  product: PosCatalogProduct,
  locale: SupportedLocale,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!product.trackInventory || product.availableQuantity === null) {
    return t("pos.catalog.values.notTracked");
  }

  const quantity = Number(product.availableQuantity);
  const formatted = Number.isFinite(quantity)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
        quantity,
      )
    : product.availableQuantity;
  return `${formatted} ${product.unitOfMeasure}`;
}

export function formatPricingUnit(
  pricingUnit: PosCatalogService["pricingUnit"],
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return pricingUnit === "per_kg"
    ? t("pos.catalog.values.perKg")
    : t("pos.catalog.values.perItem");
}

export function formatTurnaround(
  minutes: number | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return minutes === null
    ? t("common.unavailable")
    : t("pos.catalog.values.minutes", { count: minutes });
}

function isProductAvailable(product: PosCatalogProduct): boolean {
  if (!product.trackInventory || product.allowNegativeStock) {
    return true;
  }
  return Number(product.availableQuantity ?? 0) > 0;
}

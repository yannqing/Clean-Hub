"use client";

import type {
  PosCatalogLabelRule,
  PosCatalogProduct,
  PosCatalogService,
} from "@cleanhub/api-client";
import {
  businessLineLabels,
  type SupportedLocale,
  type TranslationKey,
} from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Badge, cn } from "@cleanhub/ui";
import type { ReactNode } from "react";

import {
  Icon,
  PosBreadcrumb,
} from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  formatCatalogMoney,
  formatPricingUnit,
  formatProductInventory,
  formatProductName,
  formatTurnaround,
} from "./catalog-view";

type CatalogDetailViewProps =
  | {
      branchName: string;
      kind: "product";
      item: PosCatalogProduct;
    }
  | {
      branchName: string;
      kind: "service";
      item: PosCatalogService;
    };

const LABEL_RULE_KEYS: Record<PosCatalogLabelRule, TranslationKey> = {
  none: "pos.catalog.values.labelNone",
  per_item: "pos.catalog.values.labelPerItem",
  per_order_item: "pos.catalog.values.labelPerOrderItem",
  per_bag: "pos.catalog.values.labelPerBag",
};

export function CatalogDetailView(props: CatalogDetailViewProps) {
  const { locale, t } = useTranslation();
  const displayName =
    props.kind === "product" ? formatProductName(props.item) : props.item.name;
  const identifier =
    props.kind === "product" ? props.item.productSkuId : props.item.id;

  return (
    <section className="mx-auto w-full max-w-[1080px] space-y-4 pb-12">
      <PosBreadcrumb
        items={[
          { href: posRoutes.catalog, label: t("pos.catalog.title") },
          { label: displayName },
        ]}
      />

      <section className="overflow-hidden border-y bg-background">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-5" name="package-check" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-foreground">
                {displayName}
              </h1>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {identifier}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t("pos.catalog.readOnly")}</Badge>
            <Badge variant="outline">
              {props.kind === "product"
                ? t("pos.catalog.products")
                : t("pos.catalog.services")}
            </Badge>
            <span className="flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] text-muted-foreground">
              <Icon className="size-3" name="store" />
              {props.branchName}
            </span>
          </div>
        </div>

        {props.kind === "product" ? (
          <ProductMetricStrip item={props.item} locale={locale} />
        ) : (
          <ServiceMetricStrip item={props.item} locale={locale} />
        )}
      </section>

      {props.kind === "product" ? (
        <ProductDetail item={props.item} locale={locale} />
      ) : (
        <ServiceDetail item={props.item} locale={locale} />
      )}
    </section>
  );
}

function ProductMetricStrip({
  item,
  locale,
}: {
  item: PosCatalogProduct;
  locale: SupportedLocale;
}) {
  const { t } = useTranslation();

  return (
    <HeaderMetricStrip
      metrics={[
        {
          label: t("pos.catalog.fields.price"),
          value: formatCatalogMoney(item.amount, item.currency, locale),
        },
        {
          label: t("pos.catalog.fields.inventory"),
          value: formatProductInventory(item, locale, t),
        },
        {
          label: t("pos.catalog.fields.inventoryPolicy"),
          value: formatInventoryPolicy(item, t),
        },
        {
          label: t("pos.catalog.fields.offlineSale"),
          value: item.allowOfflineSale
            ? t("pos.catalog.values.allowed")
            : t("pos.catalog.values.blocked"),
        },
      ]}
    />
  );
}

function ServiceMetricStrip({
  item,
  locale,
}: {
  item: PosCatalogService;
  locale: SupportedLocale;
}) {
  const { t } = useTranslation();

  return (
    <HeaderMetricStrip
      metrics={[
        {
          label: t("pos.catalog.fields.price"),
          value: formatCatalogMoney(item.amount, item.currency, locale),
        },
        {
          label: t("pos.catalog.fields.pricingUnit"),
          value: formatPricingUnit(item.pricingUnit, t),
        },
        {
          label: t("pos.catalog.fields.turnaround"),
          value: formatTurnaround(item.turnaroundMinutes, t),
        },
        {
          label: t("pos.catalog.fields.labelRule"),
          value: t(LABEL_RULE_KEYS[item.labelRule]),
        },
      ]}
    />
  );
}

function HeaderMetricStrip({
  metrics,
}: {
  metrics: readonly { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          className="min-w-0 border-r px-4 py-3 last:border-r-0"
          key={metric.label}
        >
          <div className="text-xs text-muted-foreground">{metric.label}</div>
          <div className="mt-1 break-words text-sm font-semibold text-foreground sm:text-base">
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductDetail({
  item,
  locale,
}: {
  item: PosCatalogProduct;
  locale: SupportedLocale;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <DetailSection title={t("pos.catalog.productDetails")}>
          <DetailField label={t("pos.catalog.fields.name")} value={item.name} />
          <DetailField
            label={t("pos.catalog.fields.variant")}
            value={item.variantName ?? t("pos.catalog.values.none")}
          />
          <DetailField
            label={t("pos.catalog.fields.category")}
            value={item.categoryName ?? t("common.unavailable")}
          />
          <DetailField label={t("pos.catalog.fields.unit")} value={item.unitOfMeasure} />
        </DetailSection>

        <DetailSection title={t("pos.catalog.identifiers")}>
          <DetailField label={t("pos.catalog.fields.sku")} mono value={item.sku} />
          <DetailField
            label={t("pos.catalog.fields.barcode")}
            mono={Boolean(item.barcode)}
            value={item.barcode ?? t("pos.catalog.values.none")}
          />
        </DetailSection>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <DetailSection singleColumn title={t("pos.catalog.salesInventory")}>
          <DetailField
            label={t("pos.catalog.fields.price")}
            value={formatCatalogMoney(item.amount, item.currency, locale)}
          />
          <DetailField
            label={t("pos.catalog.fields.inventory")}
            value={formatProductInventory(item, locale, t)}
          />
          <DetailField
            label={t("pos.catalog.fields.inventoryPolicy")}
            value={formatInventoryPolicy(item, t)}
          />
          <DetailField
            label={t("pos.catalog.fields.offlineSale")}
            value={
              item.allowOfflineSale
                ? t("pos.catalog.values.allowed")
                : t("pos.catalog.values.blocked")
            }
          />
        </DetailSection>
      </aside>
    </div>
  );
}

function ServiceDetail({
  item,
  locale,
}: {
  item: PosCatalogService;
  locale: SupportedLocale;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <DetailSection title={t("pos.catalog.serviceDetails")}>
        <DetailField label={t("pos.catalog.fields.name")} value={item.name} />
        <DetailField label={t("pos.catalog.fields.category")} value={item.categoryName} />
        <DetailField
          label={t("pos.catalog.fields.businessLine")}
          value={businessLineLabels[locale][item.businessLine]}
        />
        <DetailField
          label={t("pos.catalog.fields.labelRule")}
          value={t(LABEL_RULE_KEYS[item.labelRule])}
        />
      </DetailSection>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <DetailSection singleColumn title={t("pos.catalog.pricingDelivery")}>
          <DetailField
            label={t("pos.catalog.fields.price")}
            value={formatCatalogMoney(item.amount, item.currency, locale)}
          />
          <DetailField
            label={t("pos.catalog.fields.pricingUnit")}
            value={formatPricingUnit(item.pricingUnit, t)}
          />
          <DetailField
            label={t("pos.catalog.fields.turnaround")}
            value={formatTurnaround(item.turnaroundMinutes, t)}
          />
        </DetailSection>
      </aside>
    </div>
  );
}

function DetailSection({
  children,
  singleColumn = false,
  title,
}: {
  children: ReactNode;
  singleColumn?: boolean;
  title: string;
}) {
  return (
    <section className="border-y bg-background p-5">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <dl className={cn("mt-4 grid gap-x-8 gap-y-4", !singleColumn && "sm:grid-cols-2")}>
        {children}
      </dl>
    </section>
  );
}

function DetailField({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 break-words text-sm font-medium text-foreground",
          mono && "break-all font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatInventoryPolicy(
  item: PosCatalogProduct,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!item.trackInventory) {
    return t("pos.catalog.values.notTracked");
  }
  return item.allowNegativeStock
    ? t("pos.catalog.values.negativeAllowed")
    : t("pos.catalog.values.negativeBlocked");
}

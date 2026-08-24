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
import { Badge, Button, cn } from "@cleanhub/ui";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, PosBreadcrumb } from "@/components/app-shell";
import { posRoutes } from "@/config";
import { usePosCart } from "@/features/cart/lib";
import { posToast as toast } from "@/lib/pos-toast";

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
  const cover =
    props.item.media.find((media) => media.isPrimary) ?? props.item.media[0];

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
            <span className="relative flex size-12 shrink-0 overflow-hidden rounded-md border bg-muted text-muted-foreground">
              {cover ? (
                <Image
                  alt={displayName}
                  className="object-cover"
                  fill
                  sizes="48px"
                  src={cover.downloadUrl}
                  unoptimized
                />
              ) : (
                <Icon className="m-auto size-5" name="package-check" />
              )}
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
            {props.kind === "product" ? (
              <ProductCartButton product={props.item} />
            ) : (
              <Button asChild className="h-8 gap-1.5 px-3 text-xs">
                <Link href={posRoutes.newIntake}>
                  <Icon className="size-3.5" name="user-plus" />
                  {t("pos.cart.intakeService")}
                </Link>
              </Button>
            )}
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

      {props.item.media.length > 0 ? (
        <CatalogMediaGallery media={props.item.media} name={displayName} />
      ) : null}

      {props.kind === "product" ? (
        <ProductDetail item={props.item} locale={locale} />
      ) : (
        <ServiceDetail item={props.item} locale={locale} />
      )}
    </section>
  );
}

function ProductCartButton({ product }: { product: PosCatalogProduct }) {
  const { t } = useTranslation();
  const { addProduct, loaded } = usePosCart();

  return (
    <Button
      className="h-8 gap-1.5 px-3 text-xs"
      disabled={!loaded}
      onClick={() => {
        const result = addProduct(product);
        if (result.changed) {
          toast.success(t("pos.cart.added"));
        } else {
          toast.error(result.message ?? t("pos.cart.unavailable"));
        }
      }}
    >
      <Icon className="size-3.5" name="shopping-cart" />
      {t("pos.cart.addProduct")}
    </Button>
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
          <DetailField
            label={t("pos.catalog.fields.brand")}
            value={item.brand ?? t("pos.catalog.values.none")}
          />
          <DetailField
            label={t("pos.catalog.fields.unit")}
            value={item.unitOfMeasure}
          />
        </DetailSection>

        <DescriptionSection description={item.description} />

        <DetailSection title={t("pos.catalog.identifiers")}>
          <DetailField
            label={t("pos.catalog.fields.sku")}
            mono
            value={item.sku}
          />
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
      <div className="min-w-0 space-y-4">
        <DetailSection title={t("pos.catalog.serviceDetails")}>
          <DetailField label={t("pos.catalog.fields.name")} value={item.name} />
          <DetailField
            label={t("pos.catalog.fields.shortName")}
            value={item.shortName ?? t("pos.catalog.values.none")}
          />
          <DetailField
            label={t("pos.catalog.fields.category")}
            value={item.categoryName}
          />
          <DetailField
            label={t("pos.catalog.fields.businessLine")}
            value={businessLineLabels[locale][item.businessLine]}
          />
          <DetailField
            label={t("pos.catalog.fields.labelRule")}
            value={t(LABEL_RULE_KEYS[item.labelRule])}
          />
        </DetailSection>

        <DescriptionSection description={item.description} />
      </div>

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

function CatalogMediaGallery({
  media,
  name,
}: {
  media: PosCatalogProduct["media"] | PosCatalogService["media"];
  name: string;
}) {
  const { t } = useTranslation();
  const orderedMedia = [...media].sort(
    (left, right) =>
      Number(right.isPrimary) - Number(left.isPrimary) ||
      left.sortOrder - right.sortOrder,
  );
  const [cover, ...details] = orderedMedia;

  if (!cover) {
    return null;
  }

  return (
    <section className="border-y bg-background p-4 sm:p-5">
      <h2 className="font-semibold text-foreground">
        {t("pos.catalog.images")}
      </h2>
      <div
        className={cn(
          "mt-4 grid gap-3",
          details.length > 0 &&
            "md:grid-cols-[minmax(0,1.4fr)_minmax(240px,1fr)]",
        )}
      >
        <figure className="min-w-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted sm:aspect-[16/9]">
            <Image
              alt={`${name} · ${t("pos.catalog.coverImage")}`}
              className="object-cover"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 62vw"
              src={cover.downloadUrl}
              unoptimized
            />
          </div>
          <figcaption className="mt-1.5 text-xs text-muted-foreground">
            {t("pos.catalog.coverImage")}
          </figcaption>
        </figure>

        {details.length > 0 ? (
          <div className="grid grid-cols-2 content-start gap-3">
            {details.map((image, index) => (
              <figure className="min-w-0" key={image.id}>
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  <Image
                    alt={`${name} · ${t("pos.catalog.detailImage")} ${index + 1}`}
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 50vw, 220px"
                    src={image.downloadUrl}
                    unoptimized
                  />
                </div>
                <figcaption className="mt-1.5 text-xs text-muted-foreground">
                  {t("pos.catalog.detailImage")} {index + 1}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DescriptionSection({ description }: { description: string | null }) {
  const { t } = useTranslation();

  return (
    <section className="border-y bg-background p-5">
      <h2 className="font-semibold text-foreground">
        {t("pos.catalog.descriptionTitle")}
      </h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {description
          ? stripDescriptionMarkup(description)
          : t("pos.catalog.noDescription")}
      </p>
    </section>
  );
}

function stripDescriptionMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
      <dl
        className={cn(
          "mt-4 grid gap-x-8 gap-y-4",
          !singleColumn && "sm:grid-cols-2",
        )}
      >
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

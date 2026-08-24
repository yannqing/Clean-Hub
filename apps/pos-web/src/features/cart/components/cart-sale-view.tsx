"use client";

import type {
  CreateManualOrderRequest,
  CreatePosCheckoutPaymentRequest,
  PosBranchSummary,
  PosCatalogProduct,
  PosCatalogService,
  PosCartPricePreview,
  PosCustomerProfileWithAccount,
  PosMobileMoneyProvider,
  PosPaymentTransaction,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@cleanhub/ui";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { Icon, PosPageHeader } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";
import { openCashDrawerForPaymentOnce } from "@/features/hardware/lib/cash-drawer";
import { getDesktopBridge } from "@/features/hardware/lib/desktop-bridge";
import { loadPosHardwareDevices } from "@/features/hardware/lib/hardware-device-cache";
import {
  queuePosOfflineCartReceipt,
  queuePosOrderReceipt,
} from "@/features/hardware/lib/order-receipt-print";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { MOBILE_MONEY_PROVIDER_LABELS } from "@/features/orders/constants";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { formatPosMoney } from "@/lib/money";
import { posToast as toast } from "@/lib/pos-toast";

import type {
  PosCartCloudSyncState,
  PosCartLine,
  PosCartSnapshot,
} from "../cart.types";
import { calculatePosCartTotal, usePosCart } from "../lib";

type CatalogFilter = "all" | "products" | "services";

type CartSaleViewProps = {
  branch: PosBranchSummary | null;
  canManageSensitiveOperations: boolean;
  products: PosCatalogProduct[];
  services: PosCatalogService[];
};

export function CartSaleView({
  branch,
  canManageSensitiveOperations,
  products,
  services,
}: CartSaleViewProps) {
  const { locale, t } = useTranslation();
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const {
    addProduct,
    cart,
    clear,
    cloudSyncState,
    loaded,
    removeLine,
    scope,
    setCustomer,
    setDiscount,
    setNotes,
    setProductQuantity,
  } = usePosCart();

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = useMemo(
    () =>
      filter === "services"
        ? []
        : products.filter((product) =>
            [
              product.name,
              product.variantName,
              product.brand,
              product.categoryName,
              product.sku,
              product.barcode,
            ].some((value) =>
              value?.toLowerCase().includes(normalizedQuery),
            ),
          ),
    [filter, normalizedQuery, products],
  );
  const visibleServices = useMemo(
    () =>
      filter === "products"
        ? []
        : services.filter((service) =>
            [service.name, service.shortName, service.categoryName].some(
              (value) => value?.toLowerCase().includes(normalizedQuery),
            ),
          ),
    [filter, normalizedQuery, services],
  );

  const handleAddProduct = useCallback(
    (product: PosCatalogProduct, scanned = false) => {
      const result = addProduct(product);
      if (!result.changed) {
        toast.error(result.message ?? t("pos.cart.unavailable"));
        return;
      }
      if (scanned) {
        toast.success(t("pos.cart.scanAdded", { name: product.name }));
      }
    },
    [addProduct, t],
  );

  useEffect(() => {
    if (!loaded) return;
    const bridge = getDesktopBridge();
    return bridge?.hardware.onScan((event) => {
      const code = event.value.trim().toLowerCase();
      const product = products.find(
        (entry) =>
          entry.barcode?.trim().toLowerCase() === code ||
          entry.sku.trim().toLowerCase() === code,
      );
      if (product) {
        handleAddProduct(product, true);
      } else {
        toast.error(t("pos.cart.scanNotFound", { code: event.value }));
      }
    });
  }, [handleAddProduct, loaded, products, t]);

  const cartPanel = (
    <CartPanel
      branch={branch}
      cart={cart}
      branchId={scope?.branchId ?? null}
      loaded={loaded}
      canManageSensitiveOperations={canManageSensitiveOperations}
      cloudSyncState={cloudSyncState}
      onCheckoutComplete={() => setCartOpen(false)}
      onClear={clear}
      onRemoveLine={removeLine}
      onSelectCustomer={setCustomer}
      onSetDiscount={setDiscount}
      onSetNotes={setNotes}
      onSetProductQuantity={setProductQuantity}
      scopeReady={Boolean(scope)}
    />
  );

  return (
    <section className="space-y-5 pb-28 lg:pb-8">
      <PosPageHeader
        actions={
          <Badge className="gap-1.5" variant="outline">
            <Icon className="size-3.5" name="store" />
            {t("pos.cart.branchScope", { branch: branch?.name ?? "—" })}
          </Badge>
        }
        description={t("pos.cart.description")}
        icon="shopping-cart"
        title={t("pos.cart.title")}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 border-y bg-background px-3 py-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 rounded-md bg-muted p-1">
              {(["all", "products", "services"] as const).map((value) => (
                <button
                  className={cn(
                    "h-9 rounded-md px-3 text-sm font-medium",
                    filter === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {t(`pos.cart.${value}`)}
                </button>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <Icon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                name="search"
              />
              <Input
                className="h-11 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("pos.cart.searchPlaceholder")}
                value={query}
              />
            </div>
          </div>

          {visibleProducts.length > 0 ? (
            <CatalogSection title={t("pos.cart.products")}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.productSkuId}
                    locale={locale}
                    onAdd={() => handleAddProduct(product)}
                    product={product}
                  />
                ))}
              </div>
            </CatalogSection>
          ) : null}

          {visibleServices.length > 0 ? (
            <CatalogSection
              description={t("pos.cart.serviceHint")}
              title={t("pos.cart.services")}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    locale={locale}
                    service={service}
                  />
                ))}
              </div>
            </CatalogSection>
          ) : null}

          {visibleProducts.length === 0 && visibleServices.length === 0 ? (
            <div className="border-y bg-background px-5 py-16 text-center text-sm text-muted-foreground">
              {t("pos.cart.noResults")}
            </div>
          ) : null}
        </div>

        <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] overflow-hidden border bg-background lg:block">
          {cartPanel}
        </aside>
      </div>

      <Sheet onOpenChange={setCartOpen} open={cartOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center justify-between rounded-xl bg-foreground px-4 text-background shadow-xl lg:hidden"
            type="button"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon className="size-5" name="shopping-cart" />
              {t("pos.cart.cart")}
              <span className="rounded-full bg-background/15 px-2 py-0.5 text-xs">
                {cart.lines.length}
              </span>
            </span>
            <span className="font-semibold">
              {formatPosMoney(
                calculatePosCartTotal(cart),
                cart.currency,
                locale,
              )}
            </span>
          </button>
        </SheetTrigger>
        <SheetContent className="h-[88dvh] p-0" side="bottom">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("pos.cart.cart")}</SheetTitle>
            <SheetDescription>{t("pos.cart.description")}</SheetDescription>
          </SheetHeader>
          {cartPanel}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CatalogSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ProductCard({
  locale,
  onAdd,
  product,
}: {
  locale: string;
  onAdd: () => void;
  product: PosCatalogProduct;
}) {
  const { t } = useTranslation();
  const cover = product.media.find((media) => media.isPrimary) ??
    product.media[0];
  const unavailable =
    product.trackInventory &&
    !product.allowNegativeStock &&
    Number(product.availableQuantity ?? 0) < 1;
  const name = product.variantName
    ? `${product.name} · ${product.variantName}`
    : product.name;

  return (
    <button
      className="group overflow-hidden rounded-lg border bg-background text-left transition hover:border-foreground/25 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-55"
      disabled={unavailable}
      onClick={onAdd}
      type="button"
    >
      <span className="relative block aspect-square overflow-hidden bg-muted">
        {cover ? (
          <Image
            alt={name}
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
            fill
            sizes="(max-width: 640px) 50vw, 220px"
            src={cover.downloadUrl}
            unoptimized
          />
        ) : (
          <Icon
            className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
            name="package-check"
          />
        )}
      </span>
      <span className="block space-y-1.5 p-3">
        <span className="line-clamp-2 block min-h-10 text-sm font-semibold text-foreground">
          {name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.sku}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground">
            {formatPosMoney(product.amount, product.currency, locale)}
          </span>
          <span className="rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold text-background">
            {t("pos.cart.add")}
          </span>
        </span>
      </span>
    </button>
  );
}

function ServiceCard({
  locale,
  service,
}: {
  locale: string;
  service: PosCatalogService;
}) {
  const { t } = useTranslation();
  const cover = service.media.find((media) => media.isPrimary) ??
    service.media[0];

  return (
    <div className="flex min-w-0 gap-3 rounded-lg border bg-background p-3">
      <Link
        className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted"
        href={posRoutes.catalogServiceDetail(service.id)}
      >
        {cover ? (
          <Image
            alt={service.name}
            className="object-cover"
            fill
            sizes="80px"
            src={cover.downloadUrl}
            unoptimized
          />
        ) : (
          <Icon
            className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
            name="clipboard-list"
          />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
          href={posRoutes.catalogServiceDetail(service.id)}
        >
          {service.name}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatPosMoney(service.amount, service.currency, locale)}
          {service.pricingUnit === "per_kg" ? " / kg" : ""}
        </p>
        <Button asChild className="mt-2 h-8 px-2.5 text-xs" variant="outline">
          <Link href={posRoutes.newIntake}>{t("pos.cart.intakeService")}</Link>
        </Button>
      </div>
    </div>
  );
}

type CheckoutPaymentOption = "later" | "cash" | PosMobileMoneyProvider;

function CartPanel({
  branch,
  branchId,
  canManageSensitiveOperations,
  cart,
  cloudSyncState,
  loaded,
  onCheckoutComplete,
  onClear,
  onRemoveLine,
  onSelectCustomer,
  onSetDiscount,
  onSetNotes,
  onSetProductQuantity,
  scopeReady,
}: {
  branch: PosBranchSummary | null;
  branchId: string | null;
  canManageSensitiveOperations: boolean;
  cart: PosCartSnapshot;
  cloudSyncState: PosCartCloudSyncState;
  loaded: boolean;
  onCheckoutComplete: () => void;
  onClear: () => Promise<void>;
  onRemoveLine: (lineId: string) => { changed: boolean; message?: string };
  onSelectCustomer: (
    customer: PosCustomerProfileWithAccount | null,
  ) => { changed: boolean; message?: string };
  onSetDiscount: (code: string, reason: string) => void;
  onSetNotes: (notes: string) => void;
  onSetProductQuantity: (
    lineId: string,
    quantity: number,
  ) => { changed: boolean; message?: string };
  scopeReady: boolean;
}) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const runtime = usePosRuntimeConfig();
  const { checkoutOrder } = usePosOfflineWrites();
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [preview, setPreview] = useState<PosCartPricePreview | null>(null);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentOption, setPaymentOption] =
    useState<CheckoutPaymentOption>("cash");
  const [externalReference, setExternalReference] = useState("");
  const hasTicketLines = cart.lines.some((line) => line.kind === "ticket_item");
  const productLines = cart.lines.filter((line) => line.kind === "product");
  const localTotal = calculatePosCartTotal(cart);
  const effectivePreview =
    previewUpdatedAt === cart.updatedAt ? preview : null;
  const total = effectivePreview?.totalAmount ?? localTotal;
  const offlineProductEligible = productLines.every(
    (line) =>
      line.allowOfflineSale &&
      (!line.trackInventory ||
        line.allowNegativeStock ||
        Number(line.availableQuantity ?? 0) -
          Number(line.offlineStockBuffer) >=
          line.quantity),
  );
  const offlineCheckoutBlocked =
    !isOnline &&
    (hasTicketLines || Boolean(cart.discountCode) || !offlineProductEligible);
  const productAmount = cart.lines.reduce(
    (sum, line) =>
      line.kind === "product"
        ? sum + Number(line.unitAmount) * line.quantity
        : sum,
    0,
  );
  const serviceAmount = cart.lines.reduce(
    (sum, line) =>
      line.kind === "ticket_item" ? sum + Number(line.lineAmount) : sum,
    0,
  );

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!branchId || cart.lines.length === 0 || !isOnline) {
      const resetTimer = window.setTimeout(() => {
        setPreview(null);
        setPreviewUpdatedAt(null);
        setPreviewError(null);
        setPreviewLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      void posApi.pos.carts
        .preview(
          {
            branchId,
            customerId: cart.customer?.id,
            items: toOrderItems(cart),
            discountCode: cart.discountCode.trim() || undefined,
          },
          { signal: controller.signal },
        )
        .then((result) => {
          if (active) {
            setPreview(result);
            setPreviewUpdatedAt(cart.updatedAt);
          }
        })
        .catch((error) => {
          if (!active) return;
          setPreview(null);
          setPreviewUpdatedAt(null);
          setPreviewError(getPosApiErrorMessage(error));
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, 320);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [branchId, cart, isOnline]);

  function openCheckout() {
    if (!scopeReady || cart.lines.length === 0) return;
    if (offlineCheckoutBlocked) {
      toast.error(t("pos.cart.offlineCheckoutBlocked"));
      return;
    }
    setPaymentOption(isOnline ? "cash" : "later");
    setExternalReference("");
    setCheckoutOpen(true);
  }

  function submitCheckout() {
    const tenantId = runtime.tenantId;
    const terminalId = runtime.terminalId;
    if (!branchId || !tenantId || !terminalId) return;
    if (
      cart.discountCode &&
      (!canManageSensitiveOperations || !cart.discountReason.trim())
    ) {
      toast.error(t("pos.cart.discountReasonRequired"));
      return;
    }
    if (
      paymentOption !== "later" &&
      paymentOption !== "cash" &&
      externalReference.trim().length < 3
    ) {
      toast.error(t("pos.cart.paymentReferenceRequired"));
      return;
    }

    startTransition(async () => {
      try {
        const orderId = cart.checkoutId;
        const payment: CreatePosCheckoutPaymentRequest | undefined =
          paymentOption === "later"
              ? undefined
              : paymentOption === "cash"
              ? {
                  paymentMethod: "cash",
                  idempotencyKey: cart.checkoutId,
                }
              : {
                  paymentMethod: "app",
                  provider: paymentOption,
                  externalReference: externalReference.trim(),
                  idempotencyKey: cart.checkoutId,
                };
        const checkoutResult = await checkoutOrder(
          {
            order: {
              id: orderId,
              orderType: "manual",
              branchId,
              customerId: cart.customer?.id,
              notes: cart.notes.trim() || null,
              items: toOrderItems(cart),
              ...(cart.discountCode.trim()
                ? {
                    discountCode: cart.discountCode.trim(),
                    discountReason: cart.discountReason.trim(),
                    discountIdempotencyKey: createId(),
                  }
                : {}),
            },
            ...(payment ? { payment } : {}),
          },
          {
            allowOffline:
              !hasTicketLines &&
              !cart.discountCode &&
              offlineProductEligible &&
              (paymentOption === "later" || paymentOption === "cash"),
          },
        );
        if (checkoutResult.queued) {
          if (paymentOption === "cash") {
            const drawer = await openCashDrawerForPaymentOnce({
              paymentId: cart.checkoutId,
              scope: { tenantId, branchId, terminalId },
              loadDevices: () =>
                loadPosHardwareDevices({ tenantId, branchId, terminalId }),
              hardware: getDesktopBridge()?.hardware ?? null,
              reportResult: (result) =>
                posApi.pos.hardware.recordCashPaymentDrawerResult(result),
            });
            if (!drawer.opened) toast.warning(drawer.message);
          }
          const offlinePrintStatus = await queuePosOfflineCartReceipt({
            autoPrint: runtime.autoPrintReceipt,
            branch,
            cart,
            copies: runtime.printCopies,
            locale,
            paymentMethod: paymentOption === "cash" ? "cash" : "later",
            scope: { tenantId, branchId, terminalId },
          });
          if (offlinePrintStatus === "failed") {
            toast.warning(t("pos.cart.receiptQueued"));
          }
          await onClear();
          setCheckoutOpen(false);
          onCheckoutComplete();
          toast.success(t("pos.cart.queued"));
          router.push(posRoutes.orders);
          return;
        }

        const finalOrder = checkoutResult.data.order;
        const payments: PosPaymentTransaction[] = checkoutResult.data.payment
          ? [checkoutResult.data.payment]
          : [];
        if (
          paymentOption === "cash" &&
          checkoutResult.data.payment?.paymentStatus === "paid" &&
          !checkoutResult.data.idempotent
        ) {
          const drawer = await openCashDrawerForPaymentOnce({
            paymentId: checkoutResult.data.payment.id,
            scope: { tenantId, branchId, terminalId },
            loadDevices: () =>
              loadPosHardwareDevices({ tenantId, branchId, terminalId }),
            hardware: getDesktopBridge()?.hardware ?? null,
            reportResult: (result) =>
              posApi.pos.hardware.recordCashPaymentDrawerResult(result),
          });
          if (!drawer.opened) toast.warning(drawer.message);
        }

        const printStatus = await queuePosOrderReceipt({
          autoPrint: runtime.autoPrintReceipt,
          branch,
          copies: runtime.printCopies,
          locale,
          order: finalOrder,
          payments,
          scope: {
            tenantId,
            branchId,
            terminalId,
          },
        });
        if (printStatus === "failed") {
          toast.warning(t("pos.cart.receiptQueued"));
        }
        await onClear();
        setCheckoutOpen(false);
        onCheckoutComplete();
        toast.success(t("pos.cart.checkoutComplete"));
        router.push(posRoutes.orderDetail(finalOrder.id));
        router.refresh();
      } catch (error) {
        toast.error(getPosApiErrorMessage(error));
      }
    });
  }

  if (!loaded) {
    return (
      <div className="flex min-h-72 items-center justify-center p-6 text-sm text-muted-foreground">
        {t("pos.cart.loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-foreground">{t("pos.cart.cart")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("pos.cart.itemCount", { count: cart.lines.length })} · {t(`pos.cart.cloud.${cloudSyncState}`)}
          </p>
        </div>
        {cart.lines.length > 0 ? (
          <button
            className="text-xs font-semibold text-destructive"
            onClick={() => {
              if (window.confirm(`${t("pos.cart.clear")}?`)) void onClear();
            }}
            type="button"
          >
            {t("pos.cart.clear")}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CustomerSelector
          locked={hasTicketLines}
          onSelect={(customer) => {
            const result = onSelectCustomer(customer);
            if (!result.changed && result.message) toast.error(result.message);
          }}
          selected={cart.customer}
        />

        {cart.lines.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Icon className="mx-auto size-9 text-muted-foreground" name="shopping-cart" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {t("pos.cart.empty")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("pos.cart.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="divide-y border-y">
            {cart.lines.map((line) => (
              <CartLine
                key={line.id}
                line={line}
                locale={locale}
                onQuantityChange={(quantity) => {
                  const result = onSetProductQuantity(line.id, quantity);
                  if (!result.changed && result.message) toast.error(result.message);
                }}
                onRemove={() => onRemoveLine(line.id)}
              />
            ))}
          </div>
        )}

        {cart.lines.length > 0 ? (
          <>
            {hasTicketLines ? (
              <div className="mx-4 mt-4 flex gap-2 rounded-md bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
                <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
                {t("pos.cart.onlineTicketNotice")}
              </div>
            ) : null}
            {canManageSensitiveOperations ? (
              <div className="border-b px-4 py-4">
                <label className="block text-xs font-semibold text-muted-foreground">
                  {t("pos.cart.discountCode")}
                  <Input
                    className="mt-2 h-10"
                    maxLength={120}
                    onChange={(event) =>
                      onSetDiscount(event.target.value, cart.discountReason)
                    }
                    placeholder={t("pos.cart.discountCodePlaceholder")}
                    value={cart.discountCode}
                  />
                </label>
                {cart.discountCode ? (
                  <label className="mt-3 block text-xs font-semibold text-muted-foreground">
                    {t("pos.cart.discountReason")}
                    <Input
                      className="mt-2 h-10"
                      maxLength={500}
                      onChange={(event) =>
                        onSetDiscount(cart.discountCode, event.target.value)
                      }
                      placeholder={t("pos.cart.discountReasonPlaceholder")}
                      value={cart.discountReason}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            <label className="block px-4 py-4">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("pos.cart.notes")}
              </span>
              <textarea
                className="mt-2 min-h-20 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                maxLength={2000}
                onChange={(event) => onSetNotes(event.target.value)}
                placeholder={t("pos.cart.notesPlaceholder")}
                value={cart.notes}
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="shrink-0 border-t bg-background p-4">
        {cart.lines.length > 0 ? (
          <div className="mb-3 space-y-1.5 text-xs">
            {productAmount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("pos.cart.productAmount")}</span>
                <span>{formatPosMoney(productAmount, cart.currency, locale)}</span>
              </div>
            ) : null}
            {serviceAmount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("pos.cart.serviceAmount")}</span>
                <span>{formatPosMoney(serviceAmount, cart.currency, locale)}</span>
              </div>
            ) : null}
            {effectivePreview?.discounts.map((discount) => (
              <div className="flex justify-between text-emerald-700" key={discount.discountId}>
                <span>{discount.title}</span>
                <span>−{formatPosMoney(discount.amount, cart.currency, locale)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {effectivePreview?.discounts.length ? t("pos.cart.total") : t("pos.cart.subtotal")}
          </span>
          <span className="text-xl font-bold text-foreground">
            {formatPosMoney(total, cart.currency, locale)}
          </span>
        </div>
        {previewLoading ? (
          <p className="mb-3 text-[11px] text-muted-foreground">{t("pos.cart.pricing")}</p>
        ) : previewError ? (
          <p className="mb-3 text-[11px] leading-4 text-destructive">{previewError}</p>
        ) : cart.lines.length > 0 ? (
          <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
            {effectivePreview ? t("pos.cart.priceConfirmed") : t("pos.cart.discountHint")}
          </p>
        ) : null}
        <Button
          className="h-12 w-full text-sm font-semibold"
          disabled={isPending || !scopeReady || cart.lines.length === 0 || offlineCheckoutBlocked}
          onClick={openCheckout}
        >
          {isPending ? t("pos.cart.loading") : t("pos.cart.checkout")}
        </Button>
      </div>

      <Dialog onOpenChange={setCheckoutOpen} open={checkoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pos.cart.confirmCheckout")}</DialogTitle>
            <DialogDescription>{t("pos.cart.confirmCheckoutDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-y py-3">
              <span className="text-sm text-muted-foreground">{t("pos.cart.amountDue")}</span>
              <span className="text-2xl font-bold">{formatPosMoney(total, cart.currency, locale)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["cash", "wave", "orange_money", "later"] as const).map((option) => (
                <button
                  className={cn(
                    "h-11 rounded-md border px-3 text-sm font-semibold",
                    paymentOption === option ? "border-foreground bg-foreground text-background" : "bg-background",
                  )}
                  disabled={
                    !isOnline && option !== "later" && option !== "cash"
                  }
                  key={option}
                  onClick={() => {
                    setPaymentOption(option);
                    setExternalReference("");
                  }}
                  type="button"
                >
                  {option === "cash"
                    ? t("pos.cart.cash")
                    : option === "later"
                      ? t("pos.cart.payLater")
                      : MOBILE_MONEY_PROVIDER_LABELS[option]}
                </button>
              ))}
            </div>
            {paymentOption !== "cash" && paymentOption !== "later" ? (
              <Input
                className="h-11"
                maxLength={120}
                onChange={(event) => setExternalReference(event.target.value)}
                placeholder={t("pos.cart.paymentReference")}
                value={externalReference}
              />
            ) : null}
            {!isOnline ? (
              <p className="text-xs leading-5 text-amber-700">{t("pos.cart.offlinePayLater")}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button disabled={isPending} onClick={() => setCheckoutOpen(false)} variant="outline">
              {t("common.cancel")}
            </Button>
            <Button disabled={isPending} onClick={submitCheckout}>
              {isPending ? t("pos.cart.loading") : t("pos.cart.placeOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toOrderItems(
  cart: PosCartSnapshot,
): CreateManualOrderRequest["items"] {
  return cart.lines.map((line) =>
    line.kind === "product"
      ? { productSkuId: line.productSkuId, quantity: String(line.quantity) }
      : { ticketId: line.ticketId, ticketItemId: line.ticketItemId },
  );
}

function CartLine({
  line,
  locale,
  onQuantityChange,
  onRemove,
}: {
  line: PosCartLine;
  locale: string;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const amount =
    line.kind === "product"
      ? Number(line.unitAmount) * line.quantity
      : Number(line.lineAmount);

  return (
    <div className="flex gap-3 px-4 py-3">
      {line.kind === "product" && line.coverUrl ? (
        <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
          <Image
            alt={line.name}
            className="object-cover"
            fill
            sizes="48px"
            src={line.coverUrl}
            unoptimized
          />
        </span>
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon
            className="size-5 text-muted-foreground"
            name={line.kind === "product" ? "package-check" : "clipboard-list"}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {line.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {line.kind === "product"
                ? line.sku
                : t("pos.cart.ticket", { code: line.ticketCode })}
            </p>
          </div>
          <button
            aria-label={t("pos.cart.remove")}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            type="button"
          >
            <Icon className="size-4" name="x" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {line.kind === "product" ? (
            <div className="flex h-8 items-center rounded-md border">
              <button
                aria-label="Decrease quantity"
                className="size-8 text-sm"
                onClick={() => onQuantityChange(line.quantity - 1)}
                type="button"
              >
                −
              </button>
              <span className="min-w-8 text-center text-xs font-semibold">
                {line.quantity}
              </span>
              <button
                aria-label="Increase quantity"
                className="size-8 text-sm"
                onClick={() => onQuantityChange(line.quantity + 1)}
                type="button"
              >
                +
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {line.pricingUnit === "per_kg"
                ? `${line.weight ?? "0"} kg`
                : `${t("pos.cart.quantity")} ${line.quantity}`}
            </span>
          )}
          <span className="text-sm font-semibold text-foreground">
            {formatPosMoney(amount, line.currency, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CustomerSelector({
  locked,
  onSelect,
  selected,
}: {
  locked: boolean;
  onSelect: (customer: PosCustomerProfileWithAccount | null) => void;
  selected: PosCartSnapshot["customer"];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PosCustomerProfileWithAccount[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void posApi.pos.customers
        .list(
          {
            q: query.trim() || undefined,
            resultType: "profile",
            status: "active",
            limit: 8,
            offset: 0,
          },
          { signal: controller.signal },
        )
        .then((result) => {
          if (!active) return;
          setOptions(
            result.data.flatMap((entry) =>
              entry.kind === "profile" ? [entry.profile] : [],
            ),
          );
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("pos.cart.customer")}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {selected?.name ?? t("pos.cart.walkIn")}
          </p>
        </div>
        <button
          className="shrink-0 text-xs font-semibold text-foreground disabled:text-muted-foreground"
          disabled={locked}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {t("pos.cart.selectCustomer")}
        </button>
      </div>
      {open && !locked ? (
        <div className="mt-3 space-y-2">
          <Input
            className="h-10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("pos.cart.customerSearch")}
            value={query}
          />
          <button
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            type="button"
          >
            {t("pos.cart.walkIn")}
            {!selected ? <Icon className="size-4" name="check" /> : null}
          </button>
          <div className="max-h-48 overflow-y-auto">
            {options.map((customer) => (
              <button
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                key={customer.id}
                onClick={() => {
                  onSelect(customer);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {customer.fullName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[customer.accountName, customer.phone, customer.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {selected?.id === customer.id ? (
                  <Icon className="size-4 shrink-0" name="check" />
                ) : null}
              </button>
            ))}
            {!loading && options.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t("pos.cart.noCustomers")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

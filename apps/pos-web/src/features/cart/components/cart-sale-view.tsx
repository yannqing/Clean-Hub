"use client";

import type {
  CreateManualOrderRequest,
  CreatePosCheckoutPaymentRequest,
  PosBranchSummary,
  PosCatalogProduct,
  PosCatalogService,
  PosCartPricePreview,
  PosCustomerProfileWithAccount,
  PosHardwareDeviceSummary,
  PosMobileMoneyProvider,
  PosPaymentMethod,
  PosRegisterState,
  ShiftRecord,
} from "@cleanhub/api-client";
import type {
  PosHardwareCapabilities,
  PosPrinterDevice,
} from "@cleanhub/hardware";
import { isApiHttpError } from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Textarea,
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
import { getPosHardwareBridge } from "@/features/hardware/lib/desktop-bridge";
import { loadPosHardwareDevices } from "@/features/hardware/lib/hardware-device-cache";
import { resolvePosPrinterBinding } from "@/features/hardware/lib/printer-binding";
import {
  queuePosOfflineCartReceipt,
  queuePosOrderReceipt,
} from "@/features/hardware/lib/order-receipt-print";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { OfflineCashExceptionPanel } from "@/features/offline/components";
import { MOBILE_MONEY_PROVIDER_LABELS } from "@/features/orders/constants";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { formatPosMoney } from "@/lib/money";
import { isLockedPosPaymentMethod } from "@cleanhub/domain/payment-methods";
import {
  CASH_ROUNDING_STEPS,
  cashRoundingStepToMinor,
  roundCashDown,
} from "@cleanhub/domain/currency";

import { posToast as toast } from "@/lib/pos-toast";

import type {
  PosCartCloudSyncState,
  PosCartLine,
  PosCartSnapshot,
} from "../cart.types";
import {
  calculatePosCartTotal,
  splitMixedPaymentTotal,
  usePosCart,
} from "../lib";

type CatalogFilter = "all" | "products" | "services";

type CartSaleViewProps = {
  branch: PosBranchSummary | null;
  canManageSensitiveOperations: boolean;
  currentShift: ShiftRecord | null;
  register: PosRegisterState;
  products: PosCatalogProduct[];
  services: PosCatalogService[];
};

export function CartSaleView({
  branch,
  canManageSensitiveOperations,
  currentShift,
  register,
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
    claimParked,
    listParked,
    loaded,
    park,
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
            ].some((value) => value?.toLowerCase().includes(normalizedQuery)),
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
    async (product: PosCatalogProduct, scanned = false) => {
      const result = await addProduct(product);
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
    const hardware = getPosHardwareBridge();
    return hardware?.onScan((event) => {
      const code = event.value.trim().toLowerCase();
      const product = products.find(
        (entry) =>
          entry.barcode?.trim().toLowerCase() === code ||
          entry.sku.trim().toLowerCase() === code,
      );
      if (product) {
        void handleAddProduct(product, true);
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
      currentShift={currentShift}
      register={register}
      onCheckoutComplete={() => setCartOpen(false)}
      onClaimParked={claimParked}
      onClear={clear}
      onListParked={listParked}
      onPark={park}
      onRemoveLine={removeLine}
      onSelectCustomer={setCustomer}
      onSetDiscount={setDiscount}
      onSetNotes={setNotes}
      onSetProductQuantity={setProductQuantity}
      scopeReady={Boolean(scope)}
    />
  );

  return (
    <section className="space-y-4 pb-28 sm:space-y-5 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:pb-0">
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

      {canManageSensitiveOperations ? <OfflineCashExceptionPanel /> : null}

      <div className="grid items-start gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="pos-scrollbar min-w-0 space-y-4 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-2">
          <div className="sticky top-0 z-20 -mx-2 flex flex-col gap-2 border-y bg-background/95 px-2 py-2.5 backdrop-blur sm:static sm:mx-0 sm:gap-3 sm:px-3 sm:py-3 md:flex-row md:items-center">
            <div className="grid w-full shrink-0 grid-cols-3 rounded-lg bg-muted p-1 md:flex md:w-auto">
              {(["all", "products", "services"] as const).map((value) => (
                <button
                  aria-pressed={filter === value}
                  className={cn(
                    "h-9 min-w-0 rounded-md px-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
                    filter === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 2xl:grid-cols-4">
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
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 2xl:grid-cols-3">
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
            <Card className="border-dashed shadow-none">
              <CardContent className="px-5 py-16 text-center text-sm text-muted-foreground">
                {t("pos.cart.noResults")}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="hidden h-full min-h-0 gap-0 overflow-hidden py-0 xl:block">
          {cartPanel}
        </Card>
      </div>

      <Sheet onOpenChange={setCartOpen} open={cartOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center justify-between rounded-xl bg-foreground px-4 text-background shadow-xl sm:left-1/2 sm:right-auto sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 lg:bottom-4 xl:hidden"
            size="lg"
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
          </Button>
        </SheetTrigger>
        <SheetContent
          className="h-[calc(100dvh-env(safe-area-inset-top))] max-h-dvh gap-0 rounded-none p-0 sm:left-1/2 sm:h-[88dvh] sm:max-h-[760px] sm:w-[min(44rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-t-2xl"
          showHandle={false}
          side="bottom"
        >
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
  const cover =
    product.media.find((media) => media.isPrimary) ?? product.media[0];
  const unavailable =
    product.trackInventory &&
    !product.allowNegativeStock &&
    Number(product.availableQuantity ?? 0) < 1;
  const name = product.variantName
    ? `${product.name} · ${product.variantName}`
    : product.name;

  return (
    <Button
      className="group h-auto min-w-0 flex-col items-stretch overflow-hidden whitespace-normal rounded-lg p-0 text-left hover:border-foreground/25 hover:shadow-sm"
      disabled={unavailable}
      onClick={onAdd}
      type="button"
      variant="outline"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-muted sm:aspect-square">
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
      <span className="block space-y-1.5 p-2.5 sm:p-3">
        <span className="line-clamp-2 block min-h-9 text-[13px] font-semibold leading-[18px] text-foreground sm:min-h-10 sm:text-sm sm:leading-5">
          {name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.sku}
        </span>
        <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
          <span className="truncate text-[13px] font-bold text-foreground sm:text-sm">
            {formatPosMoney(product.amount, product.currency, locale)}
          </span>
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background sm:h-auto sm:w-auto sm:gap-1 sm:px-2 sm:py-1">
            <Icon className="size-3.5" name="plus" />
            <span className="sr-only sm:not-sr-only sm:text-[11px] sm:font-semibold">
              {t("pos.cart.add")}
            </span>
          </span>
        </span>
      </span>
    </Button>
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
  const cover =
    service.media.find((media) => media.isPrimary) ?? service.media[0];

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="flex gap-3 p-3">
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
            <Link href={posRoutes.newIntakeForService(service.id)}>
              {t("pos.cart.intakeService")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type CheckoutTender = {
  id: string;
  paymentMethod: PosPaymentMethod;
  amount: string;
  tenderedAmount: string;
  provider: PosMobileMoneyProvider;
  externalReference: string;
};

type CheckoutPaymentMode = PosPaymentMethod | "mixed" | "pay_later";

type ReceiptDeliveryChoice = "print" | "email" | "sms" | "none";

const NO_HARDWARE_CAPABILITIES: PosHardwareCapabilities = {
  scanner: false,
  printer: false,
  cashDrawer: false,
  cardTerminal: false,
  secureTerminalCredential: false,
};

function CartPanel({
  branch,
  branchId,
  canManageSensitiveOperations,
  cart,
  cloudSyncState,
  currentShift,
  register,
  loaded,
  onCheckoutComplete,
  onClaimParked,
  onClear,
  onListParked,
  onPark,
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
  currentShift: ShiftRecord | null;
  register: PosRegisterState;
  loaded: boolean;
  onCheckoutComplete: () => void;
  onClaimParked: (
    cartId: string,
    handoffNote?: string,
  ) => Promise<import("@cleanhub/api-client").PosSavedCart>;
  onClear: () => Promise<void>;
  onListParked: () => Promise<import("@cleanhub/api-client").PosSavedCart[]>;
  onPark: (
    name: string,
    handoffNote?: string,
  ) => Promise<import("@cleanhub/api-client").PosSavedCart>;
  onRemoveLine: (
    lineId: string,
  ) => Promise<{ changed: boolean; message?: string }>;
  onSelectCustomer: (customer: PosCustomerProfileWithAccount | null) => Promise<{
    changed: boolean;
    message?: string;
  }>;
  onSetDiscount: (code: string, reason: string) => void;
  onSetNotes: (notes: string) => void;
  onSetProductQuantity: (
    lineId: string,
    quantity: number,
  ) => Promise<{ changed: boolean; message?: string }>;
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
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<CheckoutPaymentMode>("cash");
  const [tenders, setTenders] = useState<CheckoutTender[]>([]);
  const [payLater, setPayLater] = useState(false);
  // The cashier picks the denomination per sale rather than only toggling the
  // branch default, because which notes the drawer can break varies through
  // the day. A step of 1 means no rounding. The branch setting is the opening
  // suggestion; where it is 1 the till still offers the smallest real note, so
  // the choice is available without an admin first configuring one.
  // The branch setting is the opening suggestion. Where it is 1 the till still
  // offers the smallest real note, so the cashier has the choice without an
  // admin configuring one first. Taken from the shared list rather than a
  // currency-specific constant, so this stays correct outside XOF.
  const defaultCashRoundingStep =
    runtime.cashRoundingStep > 1
      ? runtime.cashRoundingStep
      : (CASH_ROUNDING_STEPS.find((step) => step > 1) ?? 1);
  const [cashRoundingStep, setCashRoundingStep] = useState<number>(
    defaultCashRoundingStep,
  );
  const [unpaidReason, setUnpaidReason] = useState("");
  const [balanceDueAt, setBalanceDueAt] = useState("");
  const [receiptDelivery, setReceiptDelivery] =
    useState<ReceiptDeliveryChoice>("print");
  const [receiptDestination, setReceiptDestination] = useState("");
  const [taxExemptionReason, setTaxExemptionReason] = useState("");
  const [hardwareCapabilities, setHardwareCapabilities] =
    useState<PosHardwareCapabilities>(NO_HARDWARE_CAPABILITIES);
  const [hardwareDevices, setHardwareDevices] = useState<
    PosHardwareDeviceSummary[]
  >([]);
  const [localPrinters, setLocalPrinters] = useState<PosPrinterDevice[]>([]);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [parkName, setParkName] = useState("");
  const [parkNote, setParkNote] = useState("");
  const [parkedCarts, setParkedCarts] = useState<
    import("@cleanhub/api-client").PosSavedCart[]
  >([]);
  const [parkedLoading, setParkedLoading] = useState(false);
  const hasTicketLines = cart.lines.some((line) => line.kind === "ticket_item");
  const productLines = cart.lines.filter((line) => line.kind === "product");
  const localTotal = calculateLocalFinancialTotal(
    calculatePosCartTotal(cart),
    runtime,
  );
  const effectivePreview = previewUpdatedAt === cart.updatedAt ? preview : null;
  const pricedTotal = effectivePreview?.totalAmount ?? localTotal;
  const offlineProductEligible = productLines.every(
    (line) =>
      line.allowOfflineSale &&
      (!line.trackInventory ||
        line.allowNegativeStock ||
        Number(line.availableQuantity ?? 0) - Number(line.offlineStockBuffer) >=
          line.quantity),
  );
  const offlineCheckoutBlocked =
    !isOnline &&
    (hasTicketLines || Boolean(cart.discountCode) || !offlineProductEligible);
  const onlinePriceUnconfirmed =
    isOnline && cart.lines.length > 0 && effectivePreview === null;
  const trackedCashMode = ["shared_drawer", "cash_in_hand"].includes(
    register.cashHandlingMode,
  );
  const cashRegisterAvailable =
    register.cashHandlingMode !== "none" &&
    (isOnline
      ? register.cashHandlingMode === "untracked" ||
        Boolean(register.cashSession) ||
        (trackedCashMode && !register.requireOpeningFloat)
      : Boolean(register.registerSession) &&
        (register.cashHandlingMode === "untracked" ||
          Boolean(register.cashSession)));
  // Cash rounding is only meaningful when the whole tender is cash and the
  // till is actually open: an electronic payment has no change to make, so
  // there is nothing to concede.
  const cashOnlyTender =
    paymentMode === "cash" ||
    (tenders.length > 0 &&
      tenders.every((tender) => tender.paymentMethod === "cash"));
  const cashRoundingStepMinor = cashRoundingStepToMinor(cashRoundingStep);
  // Offered whenever cash is being taken: the cashier decides the step here,
  // so there is no longer a branch setting to gate the control behind.
  const cashRoundingOffered =
    cashOnlyTender && cashRegisterAvailable && Number(pricedTotal) > 0;
  const roundedCashTotal = cashRoundingOffered
    ? toMoney(
        Number(
          roundCashDown(
            BigInt(Math.round(Number(pricedTotal) * 100)),
            cashRoundingStepMinor,
          ),
        ) / 100,
      )
    : pricedTotal;
  const cashRoundingActive =
    cashRoundingOffered && cashRoundingStepMinor > BigInt(1);
  // The server recomputes this the same way, so the displayed total is also
  // what `expectedTotalAmount` must carry or checkout fails as PRICE_CHANGED.
  const total = cashRoundingActive ? roundedCashTotal : pricedTotal;
  const cashRoundingDiscount = Number(pricedTotal) - Number(roundedCashTotal);
  const paidNowAmount = tenders.reduce(
    (sum, tender) => sum + Math.max(0, Number(tender.amount) || 0),
    0,
  );
  const outstandingAmount = Math.max(0, Number(total) - paidNowAmount);
  const externalTenderExists = tenders.some(
    (tender) => tender.paymentMethod !== "cash",
  );
  const mixedExternalMethods = runtime.paymentMethodsEnabled.filter(
    (method) =>
      method !== "cash" && isOnline && !isLockedPosPaymentMethod(method),
  );
  const mixedPaymentAvailable =
    runtime.paymentMethodsEnabled.includes("app") &&
    runtime.mobileMoneyProvidersEnabled.length > 0 &&
    cashRegisterAvailable &&
    runtime.paymentMethodsEnabled.includes("cash") &&
    mixedExternalMethods.length > 0 &&
    Number(total) >= 0.02;
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
  const printerBinding = useMemo(
    () => resolvePosPrinterBinding({ devices: hardwareDevices, localPrinters }),
    [hardwareDevices, localPrinters],
  );
  const configuredPrinter = printerBinding.configured;

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
    let active = true;
    const hardware = getPosHardwareBridge();
    if (hardware) {
      void hardware
        .getCapabilities()
        .then(async (capabilities) => {
          if (!active) return;
          setHardwareCapabilities(capabilities);
          if (capabilities.printer) {
            const printers = await hardware.listPrinters();
            if (active) setLocalPrinters(printers);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const tenantId = runtime.tenantId;
    const terminalId = runtime.terminalId;
    if (!tenantId || !terminalId || !branchId) return;
    let active = true;
    void loadPosHardwareDevices({ tenantId, branchId, terminalId }).then(
      (devices) => {
        if (active) setHardwareDevices(devices);
      },
    );
    return () => {
      active = false;
    };
  }, [branchId, runtime.tenantId, runtime.terminalId]);

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
            taxExemptionReason: taxExemptionReason.trim() || undefined,
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
  }, [branchId, cart, isOnline, previewRefreshKey, taxExemptionReason]);

  function openCheckout() {
    if (!scopeReady || cart.lines.length === 0) return;
    // Each sale decides for itself; a previous customer's concession must not
    // carry over silently into the next one.
    setCashRoundingStep(defaultCashRoundingStep);
    if (offlineCheckoutBlocked) {
      toast.error(t("pos.cart.offlineCheckoutBlocked"));
      return;
    }
    if (onlinePriceUnconfirmed) {
      toast.error(t("pos.cart.priceConfirmationRequired"));
      return;
    }
    const configuredDefault = runtime.paymentMethodsEnabled.includes(
      runtime.defaultPaymentMethod,
    )
      ? runtime.defaultPaymentMethod
      : runtime.paymentMethodsEnabled[0];
    const availableDefault =
      configuredDefault === "cash" && !cashRegisterAvailable
        ? runtime.paymentMethodsEnabled.find(
            (method) => method !== "cash" && !isLockedPosPaymentMethod(method),
          )
        : configuredDefault === "card" && !hardwareCapabilities.cardTerminal
          ? runtime.paymentMethodsEnabled.find(
              (method) =>
                method !== "card" &&
                (method !== "cash" || cashRegisterAvailable),
            )
          : configuredDefault;
    setTenders(
      availableDefault
        ? [
            createCheckoutTender(
              availableDefault,
              total,
              runtime.mobileMoneyProvidersEnabled[0],
            ),
          ]
        : [],
    );
    setPaymentMode(availableDefault ?? "pay_later");
    setPayLater(!availableDefault);
    setUnpaidReason("");
    setBalanceDueAt(defaultBalanceDueDate());
    setReceiptDelivery(
      runtime.autoPrintReceipt && configuredPrinter ? "print" : "none",
    );
    setReceiptDestination("");
    setCheckoutOpen(true);
  }

  function addTender(paymentMethod: PosPaymentMethod) {
    if (paymentMethod !== "cash" && externalTenderExists) return;
    if (tenders.some((tender) => tender.paymentMethod === paymentMethod))
      return;
    setTenders((current) => [
      ...current,
      createCheckoutTender(
        paymentMethod,
        toMoney(outstandingAmount),
        runtime.mobileMoneyProvidersEnabled[0],
      ),
    ]);
  }

  function selectPaymentMode(mode: CheckoutPaymentMode) {
    if (mode === "pay_later") {
      if (!cart.customer || !canManageSensitiveOperations) return;
      setTenders([]);
      setPaymentMode(mode);
      setPayLater(true);
      return;
    }

    if (mode === "mixed") {
      const externalMethod = mixedExternalMethods[0];
      if (!mixedPaymentAvailable || !externalMethod) return;

      const { cashAmount, externalAmount } = splitMixedPaymentTotal(total);
      setTenders([
        createCheckoutTender("cash", cashAmount),
        createCheckoutTender(
          externalMethod,
          externalAmount,
          runtime.mobileMoneyProvidersEnabled[0],
        ),
      ]);
      setPaymentMode(mode);
      setPayLater(false);
      return;
    }

    const disabled =
      !runtime.paymentMethodsEnabled.includes(mode) ||
      (!isOnline && mode !== "cash") ||
      (mode === "cash" && !cashRegisterAvailable) ||
      (mode === "card" && !hardwareCapabilities.cardTerminal);
    if (disabled) return;

    setTenders([
      createCheckoutTender(mode, total, runtime.mobileMoneyProvidersEnabled[0]),
    ]);
    setPaymentMode(mode);
    setPayLater(false);
  }

  function updateTender(id: string, patch: Partial<CheckoutTender>) {
    setTenders((current) =>
      current.map((tender) =>
        tender.id === id ? { ...tender, ...patch } : tender,
      ),
    );
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
    const activeTenders = tenders.filter((tender) => Number(tender.amount) > 0);
    if (paidNowAmount > Number(total) + 0.0001) {
      toast.error("支付金额合计不能超过订单应收金额。");
      return;
    }
    for (const tender of activeTenders) {
      if (tender.paymentMethod === "cash") {
        if (!cashRegisterAvailable) {
          toast.error(t("pos.cart.cashShiftRequired"));
          return;
        }
        if (Number(tender.tenderedAmount) < Number(tender.amount)) {
          toast.error(t("pos.cart.cashTenderInsufficient"));
          return;
        }
      }
      if (
        tender.paymentMethod === "app" &&
        tender.externalReference.trim().length < 3
      ) {
        toast.error(t("pos.cart.paymentReferenceRequired"));
        return;
      }
      if (
        tender.paymentMethod === "card" &&
        !hardwareCapabilities.cardTerminal
      ) {
        toast.error("当前终端未连接可用的 TPE 刷卡设备。");
        return;
      }
    }
    if (
      taxExemptionReason.trim() &&
      (!canManageSensitiveOperations || taxExemptionReason.trim().length < 3)
    ) {
      toast.error("税务豁免必须由经理填写至少 3 个字符的原因。");
      return;
    }
    if (
      (receiptDelivery === "email" || receiptDelivery === "sms") &&
      receiptDestination.trim().length < 3
    ) {
      toast.error("请填写有效的小票接收地址或手机号。");
      return;
    }
    if (receiptDelivery === "print" && !configuredPrinter) {
      toast.error("当前终端尚未连接打印机，请先在设置的硬件设备中完成连接。");
      return;
    }
    const hasOutstandingBalance = outstandingAmount > 0.0001;
    if (hasOutstandingBalance) {
      if (!payLater) {
        toast.error("仍有未收余额，请明确选择保留欠款后再完成订单。");
        return;
      }
      if (!cart.customer) {
        toast.error("部分付款或稍后付款必须绑定客户。");
        return;
      }
      if (
        unpaidReason.trim().length < 3 ||
        !balanceDueAt ||
        Date.parse(balanceDueAt) <= Date.now()
      ) {
        toast.error("请填写欠款原因和未来的最晚付款时间。");
        return;
      }
    }

    const offlineTenderEligible =
      activeTenders.length === 0 ||
      (activeTenders.length === 1 &&
        activeTenders[0]?.paymentMethod === "cash" &&
        Math.abs(Number(activeTenders[0].amount) - Number(total)) < 0.0001);
    if (!isOnline && !offlineTenderEligible) {
      toast.error("离线状态仅支持全额现金或记账；混合与部分支付需要联网。");
      return;
    }

    startTransition(async () => {
      try {
        const orderId = cart.checkoutId;
        const occurredAt = new Date().toISOString();
        const payments: CreatePosCheckoutPaymentRequest[] = activeTenders.map(
          (tender) => {
            const common = {
              amount: toMoney(tender.amount),
              idempotencyKey: `${cart.checkoutId}:${tender.id}`,
            };
            if (tender.paymentMethod === "cash") {
              return {
                ...common,
                paymentMethod: "cash" as const,
                tenderedAmount: toMoney(tender.tenderedAmount),
                shiftId: currentShift?.id,
                registerSessionId: register.registerSession?.id,
                cashDrawerSessionId: register.cashSession?.id,
                occurredAt,
              };
            }
            if (tender.paymentMethod === "card") {
              return { ...common, paymentMethod: "card" as const };
            }
            return {
              ...common,
              paymentMethod: "app" as const,
              provider: tender.provider,
              externalReference: tender.externalReference.trim(),
            };
          },
        );
        const settlementIntent =
          paidNowAmount <= 0.0001
            ? "pay_later"
            : outstandingAmount > 0.0001
              ? "partial"
              : "pay_now";
        const checkoutResult = await checkoutOrder(
          {
            expectedTotalAmount: toMoney(total),
            settlementIntent,
            ...(cashRoundingActive
              ? {
                  cashRoundingApplied: true,
                  cashRoundingStep,
                }
              : {}),
            ...(settlementIntent !== "pay_now"
              ? {
                  balanceDueAt: new Date(balanceDueAt).toISOString(),
                  unpaidReason: unpaidReason.trim(),
                }
              : {}),
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
            ...(payments.length > 0 ? { payments } : {}),
            ...(taxExemptionReason.trim()
              ? { taxExemptionReason: taxExemptionReason.trim() }
              : {}),
          },
          {
            allowOffline:
              !hasTicketLines &&
              !cart.discountCode &&
              !taxExemptionReason.trim() &&
              settlementIntent === "pay_now" &&
              offlineProductEligible &&
              offlineTenderEligible,
          },
        );
        if (checkoutResult.queued) {
          const cashTender = activeTenders.find(
            (tender) => tender.paymentMethod === "cash",
          );
          if (cashTender) {
            const drawer = await openCashDrawerForPaymentOnce({
              paymentId: cart.checkoutId,
              scope: { tenantId, branchId, terminalId },
              loadDevices: () =>
                loadPosHardwareDevices({ tenantId, branchId, terminalId }),
              hardware: getPosHardwareBridge(),
              reportResult: (result) =>
                posApi.pos.hardware.recordCashPaymentDrawerResult(result),
            });
            if (!drawer.opened) toast.warning(drawer.message);
          }
          if (receiptDelivery === "print") {
            const offlinePrintStatus = await queuePosOfflineCartReceipt({
              autoPrint: true,
              branch,
              cart,
              copies: runtime.printCopies,
              locale,
              paymentMethod: cashTender ? "cash" : "later",
              cashTendered: cashTender
                ? toMoney(cashTender.tenderedAmount)
                : undefined,
              changeAmount: cashTender
                ? toMoney(
                    Math.max(
                      0,
                      Number(cashTender.tenderedAmount) -
                        Number(cashTender.amount),
                    ),
                  )
                : undefined,
              printerId: configuredPrinter!.printerId,
              operatorName: runtime.operatorName,
              terminalName: runtime.terminalName,
              scope: { tenantId, branchId, terminalId },
            });
            if (offlinePrintStatus === "failed") {
              toast.warning(t("pos.cart.receiptQueued"));
            }
          } else if (receiptDelivery !== "none") {
            toast.warning("离线订单将在同步后才能发送电子小票。");
          }
          await onClear();
          setCheckoutOpen(false);
          onCheckoutComplete();
          toast.success(t("pos.cart.queued"));
          router.push(posRoutes.orders);
          return;
        }

        let finalOrder = checkoutResult.data.order;
        let finalPayments = checkoutResult.data.payments;
        for (const payment of finalPayments.filter(
          (candidate) =>
            candidate.paymentMethod === "cash" &&
            candidate.paymentStatus === "paid",
        )) {
          if (checkoutResult.data.idempotent) break;
          const drawer = await openCashDrawerForPaymentOnce({
            paymentId: payment.id,
            scope: { tenantId, branchId, terminalId },
            loadDevices: () =>
              loadPosHardwareDevices({ tenantId, branchId, terminalId }),
            hardware: getPosHardwareBridge(),
            reportResult: (result) =>
              posApi.pos.hardware.recordCashPaymentDrawerResult(result),
          });
          if (!drawer.opened) toast.warning(drawer.message);
        }

        const cardPayment = finalPayments.find(
          (payment) =>
            payment.paymentMethod === "card" &&
            (payment.providerStatus === "initiated" ||
              payment.providerStatus === "pending"),
        );
        if (cardPayment) {
          const hardware = getPosHardwareBridge();
          try {
            if (!hardware) throw new Error("银行卡支付终端桥接不可用。");
            const result = await hardware.processCardPayment({
              paymentId: cardPayment.id,
              orderId: finalOrder.id,
              amount: cardPayment.amount,
              currency: cardPayment.currency,
              timeoutMs: 90_000,
            });
            finalOrder = await posApi.pos.orders.recordCardOutcome(
              finalOrder.id,
              cardPayment.id,
              {
                outcome: result.status,
                externalReference: result.externalReference,
                authorizationCode: result.authorizationCode,
                failureCode: result.failureCode,
                failureReason: result.message,
                providerPayload: result.providerPayload,
              },
            );
            if (result.status !== "succeeded") {
              toast.warning(
                result.message ??
                  `刷卡结果：${cardOutcomeLabel(result.status)}`,
              );
              if (result.status === "timed_out") {
                await onClear();
                setCheckoutOpen(false);
                router.push(posRoutes.orderDetail(finalOrder.id));
                router.refresh();
                return;
              }
              setTenders((current) =>
                current.filter((tender) => tender.paymentMethod !== "card"),
              );
              return;
            }
          } catch (error) {
            finalOrder = await posApi.pos.orders.recordCardOutcome(
              finalOrder.id,
              cardPayment.id,
              {
                outcome: "timed_out",
                failureCode: "TPE_BRIDGE_ERROR",
                failureReason:
                  error instanceof Error ? error.message : "TPE 刷卡失败。",
              },
            );
            toast.warning(
              `${error instanceof Error ? error.message : "TPE 状态未知。"} 请先核对终端交易记录，勿重复收款。`,
            );
            await onClear();
            setCheckoutOpen(false);
            router.push(posRoutes.orderDetail(finalOrder.id));
            router.refresh();
            return;
          }
          finalPayments = (await posApi.pos.orders.listPayments(finalOrder.id))
            .data;
        }

        const pendingExternalPayment = finalPayments.find(
          (payment) =>
            payment.paymentStatus === "pending" &&
            payment.paymentMethod !== "cash",
        );
        if (pendingExternalPayment) {
          await onClear();
          setCheckoutOpen(false);
          toast.warning(
            "订单已保存，但外部支付仍待确认。确认到账前不要交付商品，也不会生成正式已付款小票。",
          );
          router.push(posRoutes.orderDetail(finalOrder.id));
          router.refresh();
          return;
        }
        if (
          settlementIntent === "pay_now" &&
          finalOrder.paymentStatus !== "paid"
        ) {
          toast.error("支付尚未完成，请重试或更换支付方式。");
          return;
        }

        let printStatus: "queued" | "printed" | "failed" | null = null;
        if (receiptDelivery === "print") {
          printStatus = await queuePosOrderReceipt({
            autoPrint: true,
            branch,
            copies: runtime.printCopies,
            locale,
            order: finalOrder,
            payments: finalPayments,
            printerId: configuredPrinter!.printerId,
            operatorName: runtime.operatorName,
            terminalName: runtime.terminalName,
            scope: { tenantId, branchId, terminalId },
          });
          if (printStatus === "failed") {
            toast.warning(t("pos.cart.receiptQueued"));
          }
        }
        try {
          const delivery = await posApi.pos.orders.deliverReceipt(
            finalOrder.id,
            {
              channel: receiptDelivery,
              destination:
                receiptDelivery === "email" || receiptDelivery === "sms"
                  ? receiptDestination.trim()
                  : undefined,
              idempotencyKey: `receipt:${finalOrder.id}:${receiptDelivery}:initial`,
              printStatus:
                receiptDelivery === "print"
                  ? printStatus === "printed"
                    ? "sent"
                    : "failed"
                  : undefined,
              failureReason:
                receiptDelivery === "print" && printStatus !== "printed"
                  ? "The local print job was queued or failed."
                  : undefined,
            },
          );
          if (delivery.status === "failed") {
            toast.warning(
              delivery.failureReason ?? "电子小票发送失败，可在订单页重试。",
            );
          }
        } catch (error) {
          toast.warning(`小票交付记录失败：${getPosApiErrorMessage(error)}`);
        }
        await onClear();
        setCheckoutOpen(false);
        onCheckoutComplete();
        toast.success(t("pos.cart.checkoutComplete"));
        router.push(posRoutes.orderDetail(finalOrder.id));
        router.refresh();
      } catch (error) {
        if (isApiHttpError(error) && error.code === "PRICE_CHANGED") {
          setPreview(null);
          setPreviewUpdatedAt(null);
          setPreviewRefreshKey((value) => value + 1);
          setTenders([]);
        }
        toast.error(getPosApiErrorMessage(error));
      }
    });
  }

  function openParkedCarts() {
    setParkedOpen(true);
    setParkedLoading(true);
    void onListParked()
      .then(setParkedCarts)
      .catch((error) => toast.error(getPosApiErrorMessage(error)))
      .finally(() => setParkedLoading(false));
  }

  function submitParkCart() {
    if (!parkName.trim()) {
      toast.error("请为挂单填写名称，方便其他员工识别。");
      return;
    }
    startTransition(async () => {
      try {
        await onPark(parkName, parkNote);
        setParkName("");
        setParkNote("");
        toast.success("购物车已挂起，可由本门店其他员工认领。");
      } catch (error) {
        toast.error(getPosApiErrorMessage(error));
      }
    });
  }

  function claimCart(cartId: string) {
    startTransition(async () => {
      try {
        await onClaimParked(cartId, "POS 端认领");
        setParkedOpen(false);
        toast.success("挂单已认领到当前购物车。");
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex flex-col gap-2 border-b px-4 py-3 pr-12 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            {t("pos.cart.cart")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("pos.cart.itemCount", { count: cart.lines.length })} ·{" "}
            {t(`pos.cart.cloud.${cloudSyncState}`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            onClick={openParkedCarts}
            size="sm"
            type="button"
            variant="ghost"
          >
            挂单列表
          </Button>
          {cart.lines.length > 0 ? (
            <>
              <Button
                onClick={() => {
                  setParkName(
                    cart.customer?.name ??
                      `挂单 ${new Date().toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`,
                  );
                  setParkedOpen(true);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                挂起
              </Button>
              <Button
                onClick={() => setClearOpen(true)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("pos.cart.clear")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <CustomerSelector
          locked={hasTicketLines}
          onSelect={async (customer) => {
            const result = await onSelectCustomer(customer);
            if (!result.changed && result.message) toast.error(result.message);
          }}
          selected={cart.customer}
        />

        {cart.lines.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Icon
              className="mx-auto size-9 text-muted-foreground"
              name="shopping-cart"
            />
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
                onQuantityChange={async (quantity) => {
                  const result = await onSetProductQuantity(line.id, quantity);
                  if (!result.changed && result.message)
                    toast.error(result.message);
                }}
                onRemove={() => void onRemoveLine(line.id)}
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
              <Textarea
                className="mt-2 min-h-20 resize-none"
                maxLength={2000}
                onChange={(event) => onSetNotes(event.target.value)}
                placeholder={t("pos.cart.notesPlaceholder")}
                value={cart.notes}
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="shrink-0 border-t bg-background p-3 sm:p-4">
        {cart.lines.length > 0 ? (
          <div className="mb-3 space-y-1.5 text-xs">
            {productAmount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("pos.cart.productAmount")}</span>
                <span>
                  {formatPosMoney(productAmount, cart.currency, locale)}
                </span>
              </div>
            ) : null}
            {serviceAmount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("pos.cart.serviceAmount")}</span>
                <span>
                  {formatPosMoney(serviceAmount, cart.currency, locale)}
                </span>
              </div>
            ) : null}
            {effectivePreview?.discounts.map((discount) => (
              <div
                className="flex justify-between text-emerald-700"
                key={discount.discountId}
              >
                <span>{discount.title}</span>
                <span>
                  −{formatPosMoney(discount.amount, cart.currency, locale)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {effectivePreview?.discounts.length
              ? t("pos.cart.total")
              : t("pos.cart.subtotal")}
          </span>
          <span className="text-xl font-bold text-foreground">
            {formatPosMoney(total, cart.currency, locale)}
          </span>
        </div>
        {previewLoading ? (
          <p className="mb-3 text-[11px] text-muted-foreground">
            {t("pos.cart.pricing")}
          </p>
        ) : previewError ? (
          <p className="mb-3 text-[11px] leading-4 text-destructive">
            {previewError}
          </p>
        ) : cart.lines.length > 0 ? (
          <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
            {effectivePreview
              ? t("pos.cart.priceConfirmed")
              : t("pos.cart.discountHint")}
          </p>
        ) : null}
        <Button
          className="h-12 w-full text-sm font-semibold"
          disabled={
            isPending ||
            !scopeReady ||
            cart.lines.length === 0 ||
            offlineCheckoutBlocked ||
            onlinePriceUnconfirmed
          }
          onClick={openCheckout}
        >
          {isPending ? t("pos.cart.loading") : t("pos.cart.checkout")}
        </Button>
      </div>

      <Dialog onOpenChange={setClearOpen} open={clearOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pos.cart.clear")}</DialogTitle>
            <DialogDescription>
              确认清空当前购物车吗？商品、客户、折扣和备注都会被移除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setClearOpen(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                void onClear().then(() => setClearOpen(false));
              }}
              type="button"
              variant="destructive"
            >
              {t("pos.cart.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setParkedOpen(open);
          if (!open) {
            setParkName("");
            setParkNote("");
          }
        }}
        open={parkedOpen}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-4 sm:max-w-lg sm:p-6">
          <DialogHeader className="pr-7 text-left">
            <DialogTitle>
              {parkName ? "挂起当前购物车" : "门店挂单"}
            </DialogTitle>
            <DialogDescription>
              挂单会保留名称、原员工和过期时间；同门店员工可认领，但同一挂单只能成功认领一次。
            </DialogDescription>
          </DialogHeader>
          {parkName ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-muted-foreground">
                挂单名称
                <Input
                  className="mt-1.5 h-10"
                  maxLength={120}
                  onChange={(event) => setParkName(event.target.value)}
                  value={parkName}
                />
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                交接备注（可选）
                <Input
                  className="mt-1.5 h-10"
                  maxLength={500}
                  onChange={(event) => setParkNote(event.target.value)}
                  value={parkNote}
                />
              </label>
              <DialogFooter className="gap-2 [&>button]:w-full sm:[&>button]:w-auto">
                <Button
                  onClick={() => {
                    setParkName("");
                    openParkedCarts();
                  }}
                  type="button"
                  variant="outline"
                >
                  查看列表
                </Button>
                <Button
                  disabled={isPending}
                  onClick={submitParkCart}
                  type="button"
                >
                  确认挂单
                </Button>
              </DialogFooter>
            </div>
          ) : parkedLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              正在读取挂单…
            </p>
          ) : parkedCarts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              当前门店没有未过期的挂单。
            </p>
          ) : (
            <div className="space-y-2">
              {parkedCarts.map((saved) => (
                <div className="rounded-md border p-3" key={saved.id}>
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {saved.name ?? "未命名挂单"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {saved.ownerName ?? "未知员工"} ·{" "}
                        {saved.cart.lines.length} 项 · 过期{" "}
                        {new Date(saved.expiresAt).toLocaleString(locale)}
                      </p>
                      {saved.handoffNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {saved.handoffNote}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      className="w-full sm:w-auto"
                      disabled={isPending || cart.lines.length > 0}
                      onClick={() => claimCart(saved.id)}
                      type="button"
                    >
                      认领
                    </Button>
                  </div>
                </div>
              ))}
              {cart.lines.length > 0 ? (
                <p className="text-xs text-amber-700">
                  当前购物车非空，请先挂起或清空后再认领。
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setCheckoutOpen} open={checkoutOpen}>
        <DialogContent className="left-0 top-0 h-dvh max-h-dvh max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto overscroll-contain rounded-none border-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:p-6">
          <DialogHeader className="pr-7 text-left">
            <DialogTitle>{t("pos.cart.confirmCheckout")}</DialogTitle>
            <DialogDescription>
              {t("pos.cart.confirmCheckoutDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2 border-y py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("pos.cart.amountDue")}
                </span>
                <span className="text-2xl font-bold">
                  {formatPosMoney(total, cart.currency, locale)}
                </span>
              </div>
              {cashRoundingOffered ? (
                <div className="grid gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {t("pos.cart.cashRounding")}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t("pos.cart.cashRoundingHint")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {cashRoundingActive
                        ? `−${formatPosMoney(cashRoundingDiscount, cart.currency, locale)}`
                        : formatPosMoney(0, cart.currency, locale)}
                    </span>
                  </div>
                  <div
                    aria-label={t("pos.cart.cashRounding")}
                    className="flex flex-wrap gap-1.5"
                    role="group"
                  >
                    {CASH_ROUNDING_STEPS.map((step) => (
                      <Button
                        aria-pressed={cashRoundingStep === step}
                        className="min-h-9 flex-1 px-2 text-xs sm:min-w-14 sm:flex-none"
                        key={step}
                        onClick={() => setCashRoundingStep(step)}
                        size="sm"
                        type="button"
                        variant={
                          cashRoundingStep === step ? "secondary" : "ghost"
                        }
                      >
                        {step === 1 ? t("pos.cart.cashRoundingOff") : step}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {effectivePreview && Number(effectivePreview.taxAmount) !== 0 ? (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    VAT {Number(effectivePreview.taxRate) * 100}%
                    {effectivePreview.pricesIncludeTax ? "（含税）" : ""}
                  </span>
                  <span>
                    {formatPosMoney(
                      effectivePreview.taxAmount,
                      cart.currency,
                      locale,
                    )}
                  </span>
                </div>
              ) : null}
              {effectivePreview &&
              Number(effectivePreview.roundingAdjustmentAmount) !== 0 ? (
                <div className="flex justify-between text-xs text-muted-foreground">
                  {/* The configured rule is internal setup, not something the
                      cashier acts on -- and printing the raw enum showed them
                      "（none）" while an amount was in fact being rounded, since
                      a zero-decimal currency rounds regardless of the rule. */}
                  <span>{t("pos.cart.roundingAdjustment")}</span>
                  <span>
                    {formatPosMoney(
                      effectivePreview.roundingAdjustmentAmount,
                      cart.currency,
                      locale,
                    )}
                  </span>
                </div>
              ) : null}
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">本次收款</h3>
                <span className="text-xs text-muted-foreground">
                  未收{" "}
                  {formatPosMoney(outstandingAmount, cart.currency, locale)}
                </span>
              </div>
              <div
                aria-label="选择支付方式"
                className="grid grid-cols-2 gap-2 rounded-xl bg-muted/55 p-1.5 sm:flex sm:flex-wrap"
                role="tablist"
              >
                {runtime.paymentMethodsEnabled.map((method) => {
                  const disabled =
                    (!isOnline && method !== "cash") ||
                    (method === "cash" && !cashRegisterAvailable) ||
                    (method === "card" && !hardwareCapabilities.cardTerminal);
                  return (
                    <Button
                      aria-controls="checkout-payment-panel"
                      aria-selected={paymentMode === method}
                      className={cn("min-h-11 min-w-0 sm:min-w-28 sm:flex-1")}
                      disabled={disabled}
                      key={method}
                      onClick={() => selectPaymentMode(method)}
                      role="tab"
                      type="button"
                      variant={paymentMode === method ? "secondary" : "ghost"}
                    >
                      {paymentMethodLabel(method)}
                    </Button>
                  );
                })}
                <Button
                  aria-controls="checkout-payment-panel"
                  aria-selected={paymentMode === "mixed"}
                  className={cn("min-h-11 min-w-0 sm:min-w-28 sm:flex-1")}
                  disabled={!mixedPaymentAvailable}
                  onClick={() => selectPaymentMode("mixed")}
                  role="tab"
                  type="button"
                  variant={paymentMode === "mixed" ? "secondary" : "ghost"}
                >
                  混合支付
                </Button>
                <Button
                  aria-controls="checkout-payment-panel"
                  aria-selected={paymentMode === "pay_later"}
                  className={cn("min-h-11 min-w-0 sm:min-w-28 sm:flex-1")}
                  disabled={!cart.customer || !canManageSensitiveOperations}
                  onClick={() => selectPaymentMode("pay_later")}
                  role="tab"
                  type="button"
                  variant={paymentMode === "pay_later" ? "secondary" : "ghost"}
                >
                  {t("pos.cart.payLater")}
                </Button>
              </div>
              {/* Sits directly under the tabs: the cash tab is disabled until a
                  drawer session is open, so the reason belongs where the
                  cashier is looking, not further down the dialog. */}
              {!cashRegisterAvailable &&
              runtime.paymentMethodsEnabled.includes("cash") ? (
                <p className="text-xs leading-5 text-amber-700">
                  {t("pos.cart.cashShiftRequired")}
                </p>
              ) : null}

              <div
                aria-label={`${paymentModeLabel(paymentMode)}支付信息`}
                className="space-y-3"
                id="checkout-payment-panel"
                role="tabpanel"
              >
                {paymentMode === "mixed" ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5">
                    <p className="text-xs leading-5 text-muted-foreground">
                      可组合现金与一种电子支付；请分别调整每笔支付金额。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {runtime.paymentMethodsEnabled.map((method) => {
                        const disabled =
                          (!isOnline && method !== "cash") ||
                          (method === "cash" && !cashRegisterAvailable) ||
                          (method === "card" &&
                            !hardwareCapabilities.cardTerminal) ||
                          tenders.some(
                            (tender) => tender.paymentMethod === method,
                          ) ||
                          (method !== "cash" && externalTenderExists) ||
                          outstandingAmount <= 0;
                        return (
                          <Button
                            className="h-8 px-2.5 text-xs"
                            disabled={disabled}
                            key={method}
                            onClick={() => addTender(method)}
                            type="button"
                            variant="outline"
                          >
                            + {paymentMethodLabel(method)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {tenders.map((tender) => {
                  const change =
                    tender.paymentMethod === "cash"
                      ? Math.max(
                          0,
                          Number(tender.tenderedAmount) - Number(tender.amount),
                        )
                      : 0;
                  return (
                    <div
                      className="space-y-3 rounded-md border p-3"
                      key={tender.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">
                          {paymentMethodLabel(tender.paymentMethod)}
                        </strong>
                        {paymentMode === "mixed" ? (
                          <Button
                            onClick={() =>
                              setTenders((current) =>
                                current.filter(
                                  (entry) => entry.id !== tender.id,
                                ),
                              )
                            }
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            移除
                          </Button>
                        ) : null}
                      </div>
                      <label className="block text-xs font-semibold text-muted-foreground">
                        支付金额
                        <span className="relative mt-1.5 block">
                          <Input
                            className="h-10 pr-16"
                            inputMode="decimal"
                            min={0.01}
                            onChange={(event) =>
                              updateTender(tender.id, {
                                amount: event.target.value,
                              })
                            }
                            step="0.01"
                            type="number"
                            value={tender.amount}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs font-semibold text-foreground">
                            {cart.currency}
                          </span>
                        </span>
                      </label>
                      {tender.paymentMethod === "cash" ? (
                        <>
                          <label className="block text-xs font-semibold text-muted-foreground">
                            {t("pos.cart.cashTendered")}
                            <span className="relative mt-1.5 block">
                              <Input
                                className="h-10 pr-16"
                                inputMode="decimal"
                                min={0}
                                onChange={(event) =>
                                  updateTender(tender.id, {
                                    tenderedAmount: event.target.value,
                                  })
                                }
                                step="0.01"
                                type="number"
                                value={tender.tenderedAmount}
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs font-semibold text-foreground">
                                {cart.currency}
                              </span>
                            </span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {buildCashTenderPresets(
                              tender.amount,
                              cart.currency,
                            ).map((amount) => (
                              <Button
                                className="h-8 px-2.5 text-xs"
                                key={amount}
                                onClick={() =>
                                  updateTender(tender.id, {
                                    tenderedAmount: toMoney(amount),
                                  })
                                }
                                type="button"
                                variant="outline"
                              >
                                {formatPosMoney(amount, cart.currency, locale)}
                              </Button>
                            ))}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {t("pos.cart.cashChange")}
                            </span>
                            <strong>
                              {formatPosMoney(change, cart.currency, locale)}
                            </strong>
                          </div>
                        </>
                      ) : null}
                      {tender.paymentMethod === "app" ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {runtime.mobileMoneyProvidersEnabled.map(
                              (provider) => (
                                <Button
                                  key={provider}
                                  onClick={() =>
                                    updateTender(tender.id, { provider })
                                  }
                                  type="button"
                                  variant={
                                    tender.provider === provider
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {MOBILE_MONEY_PROVIDER_LABELS[provider]}
                                </Button>
                              ),
                            )}
                          </div>
                          <Input
                            className="h-10"
                            maxLength={120}
                            onChange={(event) =>
                              updateTender(tender.id, {
                                externalReference: event.target.value,
                              })
                            }
                            placeholder={t("pos.cart.paymentReference")}
                            value={tender.externalReference}
                          />
                        </>
                      ) : null}
                      {tender.paymentMethod === "card" ? (
                        <p className="text-xs leading-5 text-muted-foreground">
                          下单后 POS 会向 TPE
                          发起交易，并等待成功、失败、取消或超时结果。
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {outstandingAmount > 0.0001 && paymentMode !== "pay_later" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/25">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        仍有未收余额{" "}
                        {formatPosMoney(
                          outstandingAmount,
                          cart.currency,
                          locale,
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        保留欠款需要先关联客户，并由店长或管理员确认。
                      </p>
                    </div>
                    <Button
                      disabled={!cart.customer || !canManageSensitiveOperations}
                      onClick={() => setPayLater((current) => !current)}
                      type="button"
                      variant={payLater ? "default" : "outline"}
                    >
                      {payLater ? "取消保留欠款" : "保留未收余额"}
                    </Button>
                  </div>
                ) : null}

                {outstandingAmount > 0 && payLater ? (
                  <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                    <Input
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(event) => setBalanceDueAt(event.target.value)}
                      type="datetime-local"
                      value={balanceDueAt}
                    />
                    <Input
                      onChange={(event) => setUnpaidReason(event.target.value)}
                      placeholder="欠款原因，例如：客户取件时支付"
                      value={unpaidReason}
                    />
                  </div>
                ) : null}
              </div>
            </section>

            {canManageSensitiveOperations &&
            effectivePreview?.taxRate !== "0.000000" ? (
              <label className="block text-xs font-semibold text-muted-foreground">
                税务豁免原因（留空则正常计税）
                <Input
                  className="mt-1.5 h-10"
                  maxLength={500}
                  onChange={(event) =>
                    setTaxExemptionReason(event.target.value)
                  }
                  value={taxExemptionReason}
                />
              </label>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">小票交付</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["print", "email", "sms", "none"] as const).map((choice) => (
                  <Button
                    disabled={choice === "print" && !configuredPrinter}
                    key={choice}
                    onClick={() => setReceiptDelivery(choice)}
                    type="button"
                    variant={receiptDelivery === choice ? "default" : "outline"}
                  >
                    {receiptDeliveryLabel(choice)}
                  </Button>
                ))}
              </div>
              {printerBinding.state === "not_configured" ? (
                <p className="text-xs leading-5 text-amber-700">
                  管理员尚未给当前终端配置打印机，因此不能选择打印。
                </p>
              ) : printerBinding.state === "not_bound" ? (
                <p className="text-xs leading-5 text-amber-700">
                  打印机尚未连接本机，请由 Owner 或 Manager 在“设置 →
                  硬件设备”中完成测试和连接。
                </p>
              ) : printerBinding.state === "not_detected" ? (
                <p className="text-xs leading-5 text-amber-700">
                  已绑定的打印机当前未检测到；仍可结账，打印任务会保留并等待重试。
                </p>
              ) : printerBinding.localPrinter ? (
                <p className="text-xs leading-5 text-emerald-700">
                  将使用：{printerBinding.localPrinter.name}
                </p>
              ) : null}
              {receiptDelivery === "email" || receiptDelivery === "sms" ? (
                <Input
                  className="h-10"
                  inputMode={receiptDelivery === "email" ? "email" : "tel"}
                  onChange={(event) =>
                    setReceiptDestination(event.target.value)
                  }
                  placeholder={
                    receiptDelivery === "email" ? "客户邮箱" : "客户手机号"
                  }
                  value={receiptDestination}
                />
              ) : null}
            </section>

            {!isOnline ? (
              <p className="text-xs leading-5 text-amber-700">
                {t("pos.cart.offlinePayLater")}
              </p>
            ) : null}
          </div>
          <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t bg-background/95 px-4 py-3 backdrop-blur [&>button]:w-full sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0 sm:[&>button]:w-auto">
            <Button
              disabled={isPending}
              onClick={() => setCheckoutOpen(false)}
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={isPending || paidNowAmount > Number(total) + 0.0001}
              onClick={submitCheckout}
            >
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

function toMoney(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function defaultBalanceDueDate(): string {
  const due = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  const local = new Date(due.getTime() - due.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function createCheckoutTender(
  paymentMethod: PosPaymentMethod,
  amount: string,
  provider: PosMobileMoneyProvider = "wave",
): CheckoutTender {
  return {
    id: createId(),
    paymentMethod,
    amount: toMoney(amount),
    tenderedAmount: toMoney(amount),
    provider,
    externalReference: "",
  };
}

function paymentMethodLabel(method: PosPaymentMethod): string {
  return method === "cash"
    ? "现金"
    : method === "card"
      ? "TPE 刷卡"
      : "移动支付";
}

function paymentModeLabel(mode: CheckoutPaymentMode): string {
  return mode === "mixed"
    ? "混合"
    : mode === "pay_later"
      ? "稍后付款"
      : paymentMethodLabel(mode);
}

function receiptDeliveryLabel(choice: ReceiptDeliveryChoice): string {
  return {
    print: "打印",
    email: "邮件",
    sms: "短信",
    none: "不出小票",
  }[choice];
}

function cardOutcomeLabel(
  outcome: "succeeded" | "failed" | "cancelled" | "timed_out",
): string {
  return {
    succeeded: "成功",
    failed: "失败",
    cancelled: "已取消",
    timed_out: "已超时",
  }[outcome];
}

function calculateLocalFinancialTotal(
  subtotal: string,
  rules: Pick<
    ReturnType<typeof usePosRuntimeConfig>,
    "taxEnabled" | "defaultTaxRate" | "pricesIncludeTax" | "roundingRule"
  >,
): string {
  const subtotalMinor = Math.round(Number(subtotal) * 100);
  const rate = rules.taxEnabled ? Math.max(0, Number(rules.defaultTaxRate)) : 0;
  const taxMinor =
    rate === 0
      ? 0
      : rules.pricesIncludeTax
        ? Math.round((subtotalMinor * rate) / (1 + rate))
        : Math.round(subtotalMinor * rate);
  const beforeRounding = rules.pricesIncludeTax
    ? subtotalMinor
    : subtotalMinor + taxMinor;
  const increment =
    rules.roundingRule === "round_yuan"
      ? 100
      : rules.roundingRule === "round_jiao"
        ? 10
        : 1;
  return toMoney((Math.round(beforeRounding / increment) * increment) / 100);
}

function buildCashTenderPresets(total: string, currency: string): number[] {
  const amount = Math.max(0, Number(total));
  const fractionDigits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  const steps = fractionDigits === 0 ? [500, 1000, 5000] : [1, 5, 10, 20, 50];
  const candidates = [
    amount,
    ...steps.map((step) => Math.ceil(amount / step) * step),
  ];
  return [...new Set(candidates.filter((value) => value >= amount))].slice(
    0,
    4,
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
    <div className="flex gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
      {line.kind === "product" && line.coverUrl ? (
        <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted sm:size-12">
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
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted sm:size-12">
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
          <Button
            aria-label={t("pos.cart.remove")}
            onClick={onRemove}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Icon className="size-4" name="x" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {line.kind === "product" ? (
            <div className="flex h-9 items-center rounded-md border">
              <Button
                aria-label="Decrease quantity"
                onClick={() => onQuantityChange(line.quantity - 1)}
                size="icon"
                type="button"
                variant="ghost"
              >
                −
              </Button>
              <span className="min-w-7 text-center text-xs font-semibold">
                {line.quantity}
              </span>
              <Button
                aria-label="Increase quantity"
                onClick={() => onQuantityChange(line.quantity + 1)}
                size="icon"
                type="button"
                variant="ghost"
              >
                +
              </Button>
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
      <Button
        aria-controls="cart-customer-selector-panel"
        aria-expanded={open && !locked}
        className={cn(
          "group h-auto w-full cursor-pointer justify-start gap-3 whitespace-normal rounded-xl px-3 py-3 text-left",
          "border-primary/35 bg-primary/[0.04] hover:border-primary/65 hover:bg-primary/[0.08] hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/40 disabled:opacity-65 disabled:shadow-none",
          open && !locked && "border-primary/70 bg-primary/[0.08] shadow-md",
        )}
        disabled={locked}
        onClick={() => setOpen((current) => !current)}
        type="button"
        variant="outline"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors group-hover:bg-primary/18">
          <Icon className="size-5" name={locked ? "lock" : "user-plus"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted-foreground">
            {t("pos.cart.customer")}
          </span>
          <span className="block truncate text-sm font-semibold text-foreground">
            {selected?.name ?? t("pos.cart.walkIn")}
          </span>
          {!locked ? (
            <span className="mt-0.5 block text-xs font-semibold text-primary group-hover:underline">
              {t("pos.cart.selectCustomer")}
            </span>
          ) : null}
        </span>
        {!locked ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-background text-primary shadow-sm">
            <Icon
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
              name="chevron-down"
            />
          </span>
        ) : null}
      </Button>
      {open && !locked ? (
        <div className="mt-3 space-y-2" id="cart-customer-selector-panel">
          <Input
            className="h-10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("pos.cart.customerSearch")}
            value={query}
          />
          <Button
            className="w-full justify-between"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            type="button"
            variant="ghost"
          >
            {t("pos.cart.walkIn")}
            {!selected ? <Icon className="size-4" name="check" /> : null}
          </Button>
          <div className="max-h-48 overflow-y-auto">
            {options.map((customer) => (
              <Button
                className="h-auto w-full justify-between gap-2 whitespace-normal text-left"
                key={customer.id}
                onClick={() => {
                  onSelect(customer);
                  setOpen(false);
                }}
                type="button"
                variant="ghost"
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
              </Button>
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

"use client";

import type {
  PosCatalogProduct,
  PosCustomerProfileWithAccount,
  ServiceTicketDetail,
} from "@cleanhub/api-client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";
import { posApi } from "@/lib/api-client";

import type {
  PosCartCloudSyncState,
  PosCartMutationResult,
  PosCartScope,
  PosCartSnapshot,
} from "../cart.types";
import {
  addProductToPosCart,
  addTicketToPosCart,
  buildPosCartStorageKey,
  createEmptyPosCart,
  readStoredPosCart,
  removePosCartLine,
  selectNewestPosCart,
  setPosCartCustomer,
  setPosCartDiscount,
  setPosCartNotes,
  setPosCartProductQuantity,
  writePosCart,
} from "./pos-cart";

const CART_UPDATED_EVENT = "cleanhub:pos-cart-updated";
const CLOUD_SAVE_DELAY_MS = 450;
const LOCAL_AUTOSAVE_INTERVAL_MS = 30_000;

function isNewer(left: PosCartSnapshot, right: PosCartSnapshot): boolean {
  return Date.parse(left.updatedAt) > Date.parse(right.updatedAt);
}

export function usePosCart() {
  const { tenantId, branchId, terminalId, userId, currency } =
    usePosRuntimeConfig();
  const scope = useMemo<PosCartScope | null>(
    () =>
      tenantId && branchId && terminalId
        ? { tenantId, branchId, terminalId, userId }
        : null,
    [branchId, tenantId, terminalId, userId],
  );
  const storageKey = scope ? buildPosCartStorageKey(scope) : null;
  const [cart, setCart] = useState<PosCartSnapshot>(() =>
    createEmptyPosCart(currency),
  );
  const cartRef = useRef(cart);
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cloudSyncState, setCloudSyncState] =
    useState<PosCartCloudSyncState>("local");

  const replaceCart = useCallback(
    async (next: PosCartSnapshot): Promise<void> => {
      cartRef.current = next;
      setCart(next);
      if (!scope) return;
      await writePosCart(getPosOfflineStorage(), scope, next);
      window.dispatchEvent(
        new CustomEvent(CART_UPDATED_EVENT, { detail: storageKey }),
      );
    },
    [scope, storageKey],
  );

  const saveCloud = useCallback(
    async (snapshot: PosCartSnapshot) => {
      if (!scope || !scope.userId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setCloudSyncState("offline");
        return;
      }
      setCloudSyncState("syncing");
      try {
        const result = await posApi.pos.carts.saveCurrent({ cart: snapshot });
        if (
          !result.accepted &&
          isNewer(result.cart.cart, cartRef.current)
        ) {
          await replaceCart(result.cart.cart);
        }
        setCloudSyncState("synced");
      } catch {
        setCloudSyncState(
          typeof navigator !== "undefined" && !navigator.onLine
            ? "offline"
            : "error",
        );
      }
    },
    [replaceCart, scope],
  );

  const scheduleCloudSave = useCallback(
    (snapshot: PosCartSnapshot) => {
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setCloudSyncState("offline");
        return;
      }
      setCloudSyncState("syncing");
      cloudTimerRef.current = setTimeout(() => {
        cloudTimerRef.current = null;
        void saveCloud(snapshot);
      }, CLOUD_SAVE_DELAY_MS);
    },
    [saveCloud],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const local = scope
        ? await readStoredPosCart(
            getPosOfflineStorage(),
            scope,
            currency,
          ).catch(() => null)
        : null;
      const remote =
        scope && scope.userId && navigator.onLine
          ? await posApi.pos.carts.getCurrent().catch(() => null)
          : null;
      if (!active) return;
      const next = selectNewestPosCart(local, remote?.cart ?? null, currency);
      cartRef.current = next;
      setCart(next);
      setLoaded(true);
      if (scope) {
        await writePosCart(getPosOfflineStorage(), scope, next).catch(
          () => undefined,
        );
      }
      if (remote) setCloudSyncState("synced");
      else if (!navigator.onLine) setCloudSyncState("offline");
      else if (local) void saveCloud(local);
    })();
    return () => {
      active = false;
    };
  }, [currency, saveCloud, scope]);

  useEffect(() => {
    if (!scope || !storageKey) return;
    const handleCartUpdate = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== storageKey) return;
      void readStoredPosCart(getPosOfflineStorage(), scope, currency).then(
        (stored) => {
          if (stored && isNewer(stored, cartRef.current)) {
            cartRef.current = stored;
            setCart(stored);
          }
        },
      );
    };
    const handleOnline = () => void saveCloud(cartRef.current);
    const handleOffline = () => setCloudSyncState("offline");
    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdate);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdate);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [currency, saveCloud, scope, storageKey]);

  useEffect(
    () => () => {
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!loaded || !scope) return;

    const persistCurrentCart = () =>
      writePosCart(getPosOfflineStorage(), scope, cartRef.current).catch(
        () => undefined,
      );
    const interval = window.setInterval(
      () => void persistCurrentCart(),
      LOCAL_AUTOSAVE_INTERVAL_MS,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void persistCurrentCart();
      }
    };
    const handlePageHide = () => void persistCurrentCart();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [loaded, scope]);

  const commit = useCallback(
    (next: PosCartSnapshot) => {
      // Mutations are persisted immediately; the 30-second timer is an
      // additional checkpoint, not the only opportunity to save the cart.
      void replaceCart(next).catch(() => undefined);
      scheduleCloudSave(next);
    },
    [replaceCart, scheduleCloudSave],
  );
  const apply = useCallback(
    (result: PosCartMutationResult) => {
      if (result.changed) commit(result.cart);
      return result;
    },
    [commit],
  );
  const addProduct = useCallback(
    (product: PosCatalogProduct) => apply(addProductToPosCart(cart, product)),
    [apply, cart],
  );
  const addTicket = useCallback(
    (ticket: ServiceTicketDetail) =>
      branchId
        ? apply(addTicketToPosCart(cart, ticket, branchId))
        : { cart, changed: false, message: "当前门店尚未初始化。" },
    [apply, branchId, cart],
  );
  const setCustomer = useCallback(
    (customer: PosCustomerProfileWithAccount | null) =>
      apply(
        setPosCartCustomer(
          cart,
          customer
            ? {
                id: customer.id,
                name: customer.fullName,
                accountName: customer.accountName,
              }
            : null,
        ),
      ),
    [apply, cart],
  );
  const setProductQuantity = useCallback(
    (lineId: string, quantity: number) =>
      apply(setPosCartProductQuantity(cart, lineId, quantity)),
    [apply, cart],
  );
  const removeLine = useCallback(
    (lineId: string) => apply(removePosCartLine(cart, lineId)),
    [apply, cart],
  );
  const setNotes = useCallback(
    (notes: string) => commit(setPosCartNotes(cart, notes)),
    [cart, commit],
  );
  const setDiscount = useCallback(
    (code: string, reason: string) =>
      commit(setPosCartDiscount(cart, { code, reason })),
    [cart, commit],
  );
  const clear = useCallback(async () => {
    const empty = createEmptyPosCart(currency);
    // Checkout may only continue after the local empty-cart tombstone is
    // durable, otherwise a restart can resurrect an already completed cart.
    await replaceCart(empty);
    if (typeof navigator !== "undefined" && navigator.onLine) {
      setCloudSyncState("syncing");
      try {
        await posApi.pos.carts.clearCurrent();
        setCloudSyncState("synced");
        return;
      } catch {
        // Preserve the empty cart as a cloud tombstone if explicit abandon
        // fails after checkout; an older remote cart must not reappear.
      }
    }
    await saveCloud(empty);
  }, [currency, replaceCart, saveCloud]);

  return {
    addProduct,
    addTicket,
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
  };
}

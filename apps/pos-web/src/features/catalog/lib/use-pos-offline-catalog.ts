"use client";

import type {
  PosCatalogProduct,
  PosCatalogService,
} from "@cleanhub/api-client";
import { useEffect, useMemo, useState } from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";

import {
  readPosOfflineCatalog,
  type PosOfflineCatalogScope,
  type PosOfflineCatalogSnapshot,
  writePosOfflineCatalog,
} from "./pos-offline-catalog";

export type PosOfflineCatalogSource = "server" | "cache" | "unavailable";

type UsePosOfflineCatalogInput = {
  catalogAvailable: boolean;
  products: PosCatalogProduct[];
  services: PosCatalogService[];
};

type UsePosOfflineCatalogResult = {
  products: PosCatalogProduct[];
  services: PosCatalogService[];
  source: PosOfflineCatalogSource;
  updatedAt: string | null;
};

type CachedCatalogState = {
  scopeKey: string;
  snapshot: PosOfflineCatalogSnapshot | null;
};

export function usePosOfflineCatalog({
  catalogAvailable,
  products,
  services,
}: UsePosOfflineCatalogInput): UsePosOfflineCatalogResult {
  const { tenantId, branchId, terminalId, currency } = usePosRuntimeConfig();
  const scope = useMemo<PosOfflineCatalogScope | null>(
    () =>
      tenantId && branchId && terminalId
        ? { tenantId, branchId, terminalId, currency }
        : null,
    [branchId, currency, tenantId, terminalId],
  );
  const scopeKey = scope
    ? `${scope.tenantId}:${scope.branchId}:${scope.terminalId}:${scope.currency}`
    : null;
  const [cachedCatalog, setCachedCatalog] = useState<CachedCatalogState | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    if (scope && catalogAvailable) {
      void writePosOfflineCatalog(getPosOfflineStorage(), scope, {
        products,
        data: services,
      }).catch(() => undefined);
    }
    if (scope && scopeKey && !catalogAvailable) {
      void readPosOfflineCatalog(getPosOfflineStorage(), scope)
        .then((snapshot) => {
          if (active) setCachedCatalog({ scopeKey, snapshot });
        })
        .catch(() => {
          if (active) setCachedCatalog({ scopeKey, snapshot: null });
        });
    }
    return () => {
      active = false;
    };
  }, [catalogAvailable, products, scope, scopeKey, services]);

  if (catalogAvailable) {
    return { products, services, source: "server", updatedAt: null };
  }
  if (cachedCatalog?.scopeKey === scopeKey && cachedCatalog.snapshot) {
    return {
      products: cachedCatalog.snapshot.products,
      services: cachedCatalog.snapshot.services,
      source: "cache",
      updatedAt: cachedCatalog.snapshot.updatedAt,
    };
  }
  return {
    products: [],
    services: [],
    source: "unavailable",
    updatedAt: null,
  };
}

import { getDb, type Database } from "@cleanhub/db";
import { selectedServiceItemGroups } from "@cleanhub/domain/service-item-catalog";
import { findTenantItemCatalog } from "../../service-item-catalog/service-item-catalog.repository.js";
import { MediaService } from "../../media/media.service.js";

import {
  requireAnyPosBranchAccess,
  requirePosBranchAccess,
  requirePosTenantId,
} from "../access-control.helper.js";
import {
  findPosCatalogProducts,
  findPosCatalogServices,
} from "./catalog.repository.js";
import type {
  PosCatalogListInput,
  PosCatalogMedia,
  PosCatalogMediaRecord,
  PosCatalogProduct,
  PosCatalogProductRecord,
  PosCatalogService,
  PosCatalogServiceRecord,
} from "./catalog.types.js";
import { releaseExpiredProductReservations } from "../orders/orders.inventory.js";

type PosCatalogMediaServiceLike = Pick<
  MediaService,
  "createDownloadLinkForKnownCommittedObject"
>;

async function hydrateCatalogMedia(
  tenantId: string,
  records: PosCatalogMediaRecord[],
  mediaService: PosCatalogMediaServiceLike,
  cache: Map<string, Promise<{ downloadUrl: string; expiresAt: string }>>,
): Promise<PosCatalogMedia[]> {
  return Promise.all(
    records.map(async ({ objectKey, ...record }) => {
      let ticketPromise = cache.get(objectKey);
      if (!ticketPromise) {
        ticketPromise = mediaService.createDownloadLinkForKnownCommittedObject({
          tenantId,
          objectKey,
        });
        cache.set(objectKey, ticketPromise);
      }
      const ticket = await ticketPromise;
      return {
        ...record,
        downloadUrl: ticket.downloadUrl,
        expiresAt: ticket.expiresAt,
      };
    }),
  );
}

async function hydrateServiceCatalog(
  tenantId: string,
  records: PosCatalogServiceRecord[],
  mediaService: PosCatalogMediaServiceLike,
): Promise<PosCatalogService[]> {
  const cache = new Map<
    string,
    Promise<{ downloadUrl: string; expiresAt: string }>
  >();
  return Promise.all(
    records.map(async ({ media, ...record }) => ({
      ...record,
      media: await hydrateCatalogMedia(tenantId, media, mediaService, cache),
    })),
  );
}

async function hydrateProductCatalog(
  tenantId: string,
  records: PosCatalogProductRecord[],
  mediaService: PosCatalogMediaServiceLike,
): Promise<PosCatalogProduct[]> {
  const cache = new Map<
    string,
    Promise<{ downloadUrl: string; expiresAt: string }>
  >();
  return Promise.all(
    records.map(async ({ media, ...record }) => ({
      ...record,
      media: await hydrateCatalogMedia(tenantId, media, mediaService, cache),
    })),
  );
}

export async function listPosCatalogServices(
  input: PosCatalogListInput,
  db: Database = getDb(),
  mediaService: PosCatalogMediaServiceLike = new MediaService(),
): Promise<PosCatalogService[]> {
  const tenantId = requirePosTenantId(input.authContext);
  if (input.query.branchId) {
    requirePosBranchAccess(input.authContext, input.query.branchId);
  } else {
    requireAnyPosBranchAccess(input.authContext);
  }
  const records = await findPosCatalogServices(db, {
    tenantId,
    ...input.query,
  });
  const itemCatalog = await findTenantItemCatalog(db, tenantId);
  const enabledTypes = new Set(selectedServiceItemGroups(itemCatalog).map((group) => group.itemType));
  return hydrateServiceCatalog(tenantId, records.map((record) => ({ ...record,
    applicableItemTypes: record.applicableItemTypes.filter((type) => enabledTypes.has(type)),
  })).filter((record) => record.applicableItemTypes.length > 0), mediaService);
}

export async function listPosCatalogProducts(
  input: PosCatalogListInput,
  db: Database = getDb(),
  mediaService: PosCatalogMediaServiceLike = new MediaService(),
): Promise<PosCatalogProduct[]> {
  const tenantId = requirePosTenantId(input.authContext);
  if (!input.query.branchId) {
    return [];
  }
  requirePosBranchAccess(input.authContext, input.query.branchId);
  const records = await db.transaction(async (tx) => {
    await releaseExpiredProductReservations(tx, {
      tenantId,
      branchId: input.query.branchId!,
      actorUserId: input.authContext.userId,
    });
    return findPosCatalogProducts(tx, {
      tenantId,
      ...input.query,
      branchId: input.query.branchId!,
    });
  });
  return hydrateProductCatalog(tenantId, records, mediaService);
}

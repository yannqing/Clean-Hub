import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  requireFeatureEnabled,
  requireTenantRole,
  type TenantRole,
} from "../../auth/permission.helper.js";
import {
  assertBranchIdsSubset,
  resolveAllowedBranchIds,
} from "../../auth/branch-scope.helper.js";
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  MediaError,
  MediaService,
  type MediaUploadTicket,
} from "../../media/index.js";
import {
  bootstrapDefaultProductCategoryMetadata,
  createTenantProductRecord,
  findTenantProductDetailRecord,
  findTenantProductCategoryAttributes,
  findTenantProductCategories,
  findTenantProductMediaRecords,
  findTenantProductOverview,
  findTenantProducts,
  updateTenantProductRecord,
} from "./products.repository.js";
import { TenantProductsError } from "./products.errors.js";
import type {
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  RequestTenantProductMediaDownloads,
  RequestTenantProductMediaUpload,
  TenantProductCategoryAttributeListResponse,
  TenantProductCategoryListResponse,
  TenantProductDetail,
  TenantProductDetailRecord,
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductMediaDownloadListResponse,
  TenantProductMediaUploadTicket,
  TenantProductOverview,
  TenantProductOverviewQuery,
  TenantProductRepositoryScope,
  UpdateTenantProductRequest,
  UpdateTenantProductResponse,
} from "./products.types.js";

const TENANT_OWNER_ROLE: TenantRole = "owner";
const PRODUCT_IMAGE_PURPOSE = "product_image";

type TenantProductAccess = TenantProductRepositoryScope & {
  role: TenantRole;
};

export type TenantProductMediaServiceLike = Pick<
  MediaService,
  "requestUpload" | "assertOwnedPendingAndUploaded"
>;

export type TenantProductMediaDownloadServiceLike = Pick<
  MediaService,
  "createDownloadLink"
>;

export type TenantProductBatchMediaDownloadServiceLike = Pick<
  MediaService,
  "createDownloadLinkForKnownCommittedObject"
>;

export function mapProductMediaError(error: MediaError): TenantProductsError {
  if (error.code === "MEDIA_FORBIDDEN") {
    return new TenantProductsError(
      "PRODUCT_MEDIA_FORBIDDEN",
      "Product image is not accessible.",
      403,
    );
  }

  if (error.code === "MEDIA_NOT_FOUND") {
    return new TenantProductsError(
      "PRODUCT_MEDIA_NOT_FOUND",
      error.message,
      404,
    );
  }

  if (error.code === "MEDIA_CONFLICT") {
    return new TenantProductsError(
      "PRODUCT_MEDIA_CONFLICT",
      "Product image has already been used.",
      409,
    );
  }

  if (error.code === "MEDIA_STORAGE_ERROR") {
    return new TenantProductsError(
      "PRODUCT_MEDIA_STORAGE_ERROR",
      "Product image storage is unavailable.",
      500,
    );
  }

  return new TenantProductsError("PRODUCT_MEDIA_INVALID", error.message, 422);
}

async function resolveProductAccess(
  authContext: AuthContext,
  db: Database,
): Promise<TenantProductAccess> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  await requireFeatureEnabled(authContext, "retail", db);

  const branchScope = await resolveAllowedBranchIds(authContext, db);

  return {
    tenantId: authContext.tenantId!,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
    role: authContext.role as TenantRole,
  };
}

async function addProductMediaDownloadLinks(
  tenantId: string,
  record: TenantProductDetailRecord,
  mediaService: TenantProductMediaDownloadServiceLike,
): Promise<TenantProductDetail> {
  try {
    const media = await Promise.all(
      record.media.map(async (item) => {
        const ticket = await mediaService.createDownloadLink({
          tenantId,
          objectKey: item.objectKey,
        });

        return {
          ...item,
          downloadUrl: ticket.downloadUrl,
          expiresAt: ticket.expiresAt,
        };
      }),
    );

    return {
      ...record,
      media,
    };
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapProductMediaError(error);
    }

    throw error;
  }
}

export async function createTenantProduct(
  authContext: AuthContext,
  data: CreateTenantProductRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
  mediaService?: TenantProductMediaServiceLike,
): Promise<CreateTenantProductResponse> {
  const scope = await resolveProductAccess(authContext, db);
  const branchIds = data.branchSettings.map((setting) => setting.branchId);
  await assertBranchIdsSubset(authContext, branchIds, db);

  if (data.mediaObjectKeys.length > 0) {
    const productMediaService = mediaService ?? new MediaService();

    try {
      await Promise.all(
        data.mediaObjectKeys.map((objectKey) =>
          productMediaService.assertOwnedPendingAndUploaded({
            tenantId: scope.tenantId,
            objectKey,
            expectedPurpose: PRODUCT_IMAGE_PURPOSE,
            expectedCreatedBy: authContext.userId,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof MediaError) {
        throw mapProductMediaError(error);
      }

      throw error;
    }
  }

  return createTenantProductRecord(db, {
    ...data,
    tenantId: scope.tenantId,
    actorUserId: authContext.userId,
    createTenantDefaultPrice: scope.role === TENANT_OWNER_ROLE,
    requestMeta,
  });
}

export async function getTenantProductDetail(
  authContext: AuthContext,
  productId: string,
  db: Database = getDb(),
  mediaService: TenantProductMediaDownloadServiceLike = new MediaService(),
): Promise<TenantProductDetail> {
  const scope = await resolveProductAccess(authContext, db);
  const product = await findTenantProductDetailRecord(db, {
    tenantId: scope.tenantId,
    allowedBranchIds: scope.allowedBranchIds,
    productId,
    preferTenantDefaultPrice: scope.role === TENANT_OWNER_ROLE,
  });

  if (!product) {
    throw new TenantProductsError(
      "PRODUCT_NOT_FOUND",
      "Product was not found.",
      404,
    );
  }

  return addProductMediaDownloadLinks(scope.tenantId, product, mediaService);
}

export async function requestTenantProductMediaDownloads(
  authContext: AuthContext,
  data: RequestTenantProductMediaDownloads,
  db: Database = getDb(),
  mediaService: TenantProductBatchMediaDownloadServiceLike = new MediaService(),
): Promise<TenantProductMediaDownloadListResponse> {
  const scope = await resolveProductAccess(authContext, db);
  const mediaRecords = await findTenantProductMediaRecords(db, {
    tenantId: scope.tenantId,
    allowedBranchIds: scope.allowedBranchIds,
    items: data.items,
  });

  try {
    const downloads = await Promise.all(
      mediaRecords.map(async (media) => {
        const ticket =
          await mediaService.createDownloadLinkForKnownCommittedObject({
            tenantId: scope.tenantId,
            objectKey: media.objectKey,
          });

        return {
          productId: media.productId,
          mediaId: media.mediaId,
          downloadUrl: ticket.downloadUrl,
          expiresAt: ticket.expiresAt,
        };
      }),
    );

    return { data: downloads };
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapProductMediaError(error);
    }

    throw error;
  }
}

export async function updateTenantProduct(
  authContext: AuthContext,
  productId: string,
  data: UpdateTenantProductRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
  mediaService: TenantProductMediaServiceLike = new MediaService(),
): Promise<UpdateTenantProductResponse> {
  requireTenantRole(authContext, [TENANT_OWNER_ROLE]);
  const scope = await resolveProductAccess(authContext, db);
  const branchIds = data.branchSettings.map((setting) => setting.branchId);
  await assertBranchIdsSubset(authContext, branchIds, db);

  if (data.newMediaObjectKeys.length > 0) {
    try {
      await Promise.all(
        data.newMediaObjectKeys.map((objectKey) =>
          mediaService.assertOwnedPendingAndUploaded({
            tenantId: scope.tenantId,
            objectKey,
            expectedPurpose: PRODUCT_IMAGE_PURPOSE,
            expectedCreatedBy: authContext.userId,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof MediaError) {
        throw mapProductMediaError(error);
      }

      throw error;
    }
  }

  const product = await updateTenantProductRecord(db, {
    ...data,
    productId,
    tenantId: scope.tenantId,
    allowedBranchIds: scope.allowedBranchIds,
    actorUserId: authContext.userId,
    updateTenantDefaultPrice: scope.role === TENANT_OWNER_ROLE,
    requestMeta,
  });

  return {
    id: product.id,
    version: product.version,
    skuVersion: product.sku.version,
  };
}

export async function requestTenantProductMediaUpload(
  authContext: AuthContext,
  data: RequestTenantProductMediaUpload,
  db: Database = getDb(),
  mediaService: TenantProductMediaServiceLike = new MediaService(),
): Promise<TenantProductMediaUploadTicket> {
  const scope = await resolveProductAccess(authContext, db);

  try {
    const ticket: MediaUploadTicket = await mediaService.requestUpload({
      tenantId: scope.tenantId,
      actorUserId: authContext.userId,
      purpose: PRODUCT_IMAGE_PURPOSE,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
    });

    return ticket;
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapProductMediaError(error);
    }

    throw error;
  }
}

export async function listTenantProductCategories(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<TenantProductCategoryListResponse> {
  const scope = await resolveProductAccess(authContext, db);

  await bootstrapDefaultProductCategoryMetadata(db, {
    tenantId: scope.tenantId,
    actorUserId: authContext.userId,
  });

  return findTenantProductCategories(db, {
    tenantId: scope.tenantId,
  });
}

export async function getTenantProductCategoryAttributes(
  authContext: AuthContext,
  categoryId: string,
  db: Database = getDb(),
): Promise<TenantProductCategoryAttributeListResponse> {
  const scope = await resolveProductAccess(authContext, db);

  await bootstrapDefaultProductCategoryMetadata(db, {
    tenantId: scope.tenantId,
    actorUserId: authContext.userId,
  });

  return findTenantProductCategoryAttributes(db, {
    tenantId: scope.tenantId,
    categoryId,
  });
}

export async function listTenantProducts(
  authContext: AuthContext,
  query: TenantProductListQuery,
  db: Database = getDb(),
): Promise<TenantProductListResponse> {
  const scope = await resolveProductAccess(authContext, db);

  return findTenantProducts(db, {
    ...query,
    ...scope,
  });
}

export async function getTenantProductOverview(
  authContext: AuthContext,
  query: TenantProductOverviewQuery,
  db: Database = getDb(),
): Promise<TenantProductOverview> {
  const scope = await resolveProductAccess(authContext, db);

  return findTenantProductOverview(db, {
    ...query,
    ...scope,
  });
}

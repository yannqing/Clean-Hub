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
  findTenantProductCategoryAttributes,
  findTenantProductCategories,
  findTenantProductOverview,
  findTenantProducts,
} from "./products.repository.js";
import { TenantProductsError } from "./products.errors.js";
import type {
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  RequestTenantProductMediaUpload,
  TenantProductCategoryAttributeListResponse,
  TenantProductCategoryListResponse,
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductMediaUploadTicket,
  TenantProductOverview,
  TenantProductOverviewQuery,
  TenantProductRepositoryScope,
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

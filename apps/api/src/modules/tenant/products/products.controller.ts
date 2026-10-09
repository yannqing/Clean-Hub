import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantProductsError } from "./products.errors.js";
import {
  createTenantProduct,
  getTenantProductDetail,
  getTenantProductCategoryAttributes,
  getTenantProductOverview,
  listTenantProductCategories,
  listTenantProducts,
  requestTenantProductMediaDownloads,
  requestTenantProductMediaUpload,
  updateTenantProduct,
} from "./products.service.js";
import {
  createTenantProductBodySchema,
  requestTenantProductMediaDownloadsBodySchema,
  requestTenantProductMediaUploadBodySchema,
  tenantProductCategoryParamsSchema,
  tenantProductListQuerySchema,
  tenantProductOverviewQuerySchema,
  tenantProductParamsSchema,
  updateTenantProductBodySchema,
} from "./products.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function createTenantProductsErrorResponse(
  c: Context<AppBindings>,
  error: TenantProductsError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function createTenantProductController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createTenantProductBodySchema.parse(rawBody);

  try {
    const product = await createTenantProduct(
      c.get("authContext"),
      data,
      getRequestMeta(c),
    );

    return c.json(product, 201);
  } catch (error) {
    if (error instanceof TenantProductsError) {
      return createTenantProductsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getTenantProductController(c: Context<AppBindings>) {
  const { productId } = tenantProductParamsSchema.parse(c.req.param());

  try {
    const product = await getTenantProductDetail(
      c.get("authContext"),
      productId,
    );

    return c.json(product);
  } catch (error) {
    if (error instanceof TenantProductsError) {
      return createTenantProductsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function requestTenantProductMediaDownloadsController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = requestTenantProductMediaDownloadsBodySchema.parse(rawBody);

  try {
    const result = await requestTenantProductMediaDownloads(
      c.get("authContext"),
      data,
    );

    return c.json(result);
  } catch (error) {
    if (error instanceof TenantProductsError) {
      return createTenantProductsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateTenantProductController(c: Context<AppBindings>) {
  const { productId } = tenantProductParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTenantProductBodySchema.parse(rawBody);

  try {
    const product = await updateTenantProduct(
      c.get("authContext"),
      productId,
      data,
      getRequestMeta(c),
    );

    return c.json(product);
  } catch (error) {
    if (error instanceof TenantProductsError) {
      return createTenantProductsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function listTenantProductsController(c: Context<AppBindings>) {
  const query = tenantProductListQuerySchema.parse(c.req.query());
  const result = await listTenantProducts(c.get("authContext"), query);

  return c.json(result);
}

export async function listTenantProductCategoriesController(
  c: Context<AppBindings>,
) {
  const result = await listTenantProductCategories(c.get("authContext"));

  return c.json(result);
}

export async function getTenantProductCategoryAttributesController(
  c: Context<AppBindings>,
) {
  const { categoryId } = tenantProductCategoryParamsSchema.parse(c.req.param());

  try {
    const result = await getTenantProductCategoryAttributes(
      c.get("authContext"),
      categoryId,
    );

    return c.json(result);
  } catch (error) {
    if (error instanceof TenantProductsError) {
      return createTenantProductsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function requestTenantProductMediaUploadController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = requestTenantProductMediaUploadBodySchema.parse(rawBody);

  try {
    const result = await requestTenantProductMediaUpload(
      c.get("authContext"),
      data,
    );

    c.get("logger").info(
      {
        tenantId: c.get("authContext").tenantId,
        actorUserId: c.get("authContext").userId,
        objectKey: result.objectKey,
        sizeBytes: data.sizeBytes,
      },
      "Created product image upload ticket",
    );

    return c.json(result, 201);
  } catch (error) {
    if (error instanceof TenantProductsError) {
      return createTenantProductsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function getTenantProductOverviewController(
  c: Context<AppBindings>,
) {
  const query = tenantProductOverviewQuerySchema.parse(c.req.query());
  const result = await getTenantProductOverview(c.get("authContext"), query);

  return c.json(result);
}

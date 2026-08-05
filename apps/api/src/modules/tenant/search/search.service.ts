import { getDb, type Database } from "@cleanhub/db";
import { formatPosOrderCode } from "@cleanhub/domain/order-codes";

import { AuthError } from "../../auth/auth.errors.js";
import { listTenantBranches } from "../branches/branches.service.js";
import { listTenantCustomers } from "../customers/customers.service.js";
import { listTenantOrders } from "../orders/orders.service.js";
import { listTenantProducts } from "../products/products.service.js";
import { listTenantServices } from "../services/services.service.js";
import { listTenantUsers } from "../users/tenant-users.service.js";
import type {
  TenantGlobalSearchInput,
  TenantGlobalSearchItem,
  TenantGlobalSearchResponse,
} from "./search.types.js";

function listHref(path: string, query: string): string {
  return `${path}?q=${encodeURIComponent(query)}`;
}

async function searchProducts(input: TenantGlobalSearchInput, db: Database) {
  try {
    return await listTenantProducts(
      input.authContext,
      {
        q: input.query.q,
        limit: input.query.limit,
        offset: 0,
      },
      db,
    );
  } catch (error) {
    if (error instanceof AuthError && error.code === "FEATURE_DISABLED") {
      return { data: [], total: 0 };
    }

    throw error;
  }
}

export async function searchTenantGlobalService(
  input: TenantGlobalSearchInput,
  db: Database = getDb(),
): Promise<TenantGlobalSearchResponse> {
  const query = input.query.q;
  const limit = input.query.limit;
  const [
    ordersResult,
    customersResult,
    productsResult,
    services,
    branches,
    users,
  ] = await Promise.all([
    listTenantOrders(
      {
        authContext: input.authContext,
        query: { q: query, limit, offset: 0, sort: "created_desc" },
      },
      db,
    ),
    listTenantCustomers(
      {
        authContext: input.authContext,
        query: {
          q: query,
          limit,
          offset: 0,
          sort: "created_desc",
        },
      },
      db,
    ),
    searchProducts(input, db),
    listTenantServices(input.authContext, { q: query, limit, offset: 0 }, db),
    listTenantBranches(input.authContext, { q: query, limit, offset: 0 }, db),
    listTenantUsers(
      {
        authContext: input.authContext,
        query: { q: query, limit, offset: 0 },
      },
      db,
    ),
  ]);

  const orderItems: TenantGlobalSearchItem[] = ordersResult.data.map(
    (order) => {
      const orderCode = formatPosOrderCode(order.id);

      return {
        id: order.id,
        type: "order",
        title: orderCode,
        subtitle: [order.customerName, `${order.totalAmount} ${order.currency}`]
          .filter(Boolean)
          .join(" · "),
        badge: order.paymentStatus,
        href: listHref("/tenant/orders", orderCode),
        updatedAt: order.updatedAt,
        metadata: {
          branchId: order.branchId,
          currency: order.currency,
          customerId: order.customerId,
          totalAmount: order.totalAmount,
        },
      };
    },
  );
  const customerItems: TenantGlobalSearchItem[] = customersResult.data.map(
    (customer) => {
      const contact = customer.phone ?? customer.email;

      return {
        id: customer.id,
        type: "customer",
        title: customer.fullName,
        subtitle: contact ?? customer.accountName,
        badge: customer.status,
        href: listHref("/tenant/customers", customer.fullName),
        updatedAt: customer.createdAt,
        metadata: { contact },
      };
    },
  );
  const productItems: TenantGlobalSearchItem[] = productsResult.data.map(
    (product) => ({
      id: product.id,
      type: "product",
      title: product.name,
      subtitle: [product.brand, product.categoryName, product.primarySkuCode]
        .filter(Boolean)
        .join(" · "),
      badge: product.status,
      href: `/tenant/products/${encodeURIComponent(product.id)}`,
      updatedAt: product.updatedAt,
      metadata: { skuCount: product.skuCount },
    }),
  );
  const serviceItems: TenantGlobalSearchItem[] = services.map((service) => ({
    id: service.id,
    type: "service",
    title: service.name,
    subtitle: `${service.categoryName} · ${service.standardPrice} ${service.currency}`,
    badge: service.status,
    href: listHref("/tenant/services", service.name),
    updatedAt: service.updatedAt,
    metadata: { currency: service.currency },
  }));
  const branchItems: TenantGlobalSearchItem[] = branches.map((branch) => ({
    id: branch.id,
    type: "branch",
    title: branch.name,
    subtitle: branch.address ?? branch.phone ?? undefined,
    badge: branch.status,
    href: `/tenant/branches/${encodeURIComponent(branch.id)}`,
    updatedAt: branch.updatedAt,
  }));
  const userItems: TenantGlobalSearchItem[] = users.map((user) => ({
    id: user.id,
    type: "user",
    title: user.displayName,
    subtitle: user.email ?? user.phone ?? undefined,
    badge: user.status,
    href: listHref("/tenant/users", user.displayName),
    updatedAt: user.createdAt,
    metadata: { contact: user.email ?? user.phone, role: user.role },
  }));

  const groups = {
    orders: orderItems,
    customers: customerItems,
    products: productItems,
    services: serviceItems,
    branches: branchItems,
    users: userItems,
  };

  return {
    query,
    total: Object.values(groups).reduce(
      (total, group) => total + group.length,
      0,
    ),
    groups,
  };
}

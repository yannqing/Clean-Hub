import {
  type Database,
  customerAccounts,
  customers,
  orders,
  serviceTickets,
  userBranches,
} from "@cleanhub/db";
import {
  type SQL,
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { findBranchById } from "../../tenant/branches/branches.repository.js";
import { findStatisticsOverview } from "../statistics/statistics.repository.js";
import type {
  PosPendingTask,
  PosPendingTasksResponse,
  PosQuickAction,
  PosRecentActivity,
  PosRecentActivitiesResponse,
  PosWorkspaceBranch,
  PosWorkspaceOverview,
  PosWorkspaceRepositoryInput,
} from "./workspace.types.js";

// ---------------------------------------------------------------------------
// Quick actions configuration
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: PosQuickAction[] = [
  {
    id: "new-intake",
    label: "新建工单",
    icon: "plus",
    route: "/new-intake",
    color: "blue",
  },
  {
    id: "customers",
    label: "客户管理",
    icon: "users",
    route: "/customers",
    color: "green",
  },
  {
    id: "tickets",
    label: "工单管理",
    icon: "clipboard-list",
    route: "/tickets",
    color: "purple",
  },
  {
    id: "orders",
    label: "订单管理",
    icon: "receipt",
    route: "/orders",
    color: "orange",
  },
];

// ---------------------------------------------------------------------------
// Branch info
// ---------------------------------------------------------------------------

async function findWorkspaceBranch(
  db: Database,
  input: PosWorkspaceRepositoryInput,
): Promise<PosWorkspaceBranch | null> {
  let branchId = input.branchId;

  if (!branchId && input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return null;
    }

    // A terminal-bound POS session already resolves to exactly one branch.
    // Use that terminal scope directly; requiring a separate user_branches row
    // incorrectly makes Owner sessions appear unbound on the workspace.
    branchId = input.allowedBranchIds[0];
  }

  if (!branchId) {
    // Try to get the first branch for the user
    const userBranchFilters: SQL[] = [
      eq(userBranches.tenantId, input.tenantId),
    ];

    const userBranch = await db
      .select({ branchId: userBranches.branchId })
      .from(userBranches)
      .where(and(...userBranchFilters))
      .limit(1);

    if (!userBranch[0]?.branchId) {
      return null;
    }

    branchId = userBranch[0].branchId;
  }

  const branch = await findBranchById(db, {
    tenantId: input.tenantId,
    branchId,
  });

  if (!branch) {
    return null;
  }

  return {
    id: branch.id,
    name: branch.name,
    status: branch.status,
    phone: branch.phone,
    address: branch.address,
  };
}

// ---------------------------------------------------------------------------
// Recent activities
// ---------------------------------------------------------------------------

export async function findRecentActivities(
  db: Database,
  input: PosWorkspaceRepositoryInput & { limit?: number },
): Promise<PosRecentActivitiesResponse> {
  const limit = input.limit ?? 10;
  const activities: PosRecentActivity[] = [];

  // Recent orders
  const orderFilters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    isNull(orders.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return { activities: [] };
    }
    orderFilters.push(eq(orders.branchId, input.allowedBranchIds[0]));
  }

  if (input.branchId) {
    orderFilters.push(eq(orders.branchId, input.branchId));
  }

  const recentOrders = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(...orderFilters))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  for (const order of recentOrders) {
    activities.push({
      id: order.id,
      type: "order",
      title: `新订单`,
      description: `金额: ¥${order.totalAmount}`,
      timestamp: order.createdAt.toISOString(),
      metadata: { orderId: order.id, status: order.status },
    });
  }

  // Recent tickets
  const ticketFilters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return { activities: [] };
    }
    ticketFilters.push(eq(serviceTickets.branchId, input.allowedBranchIds[0]));
  }

  if (input.branchId) {
    ticketFilters.push(eq(serviceTickets.branchId, input.branchId));
  }

  const recentTickets = await db
    .select({
      id: serviceTickets.id,
      ticketNo: serviceTickets.ticketNo,
      ticketStatus: serviceTickets.ticketStatus,
      createdAt: serviceTickets.createdAt,
    })
    .from(serviceTickets)
    .where(and(...ticketFilters))
    .orderBy(desc(serviceTickets.createdAt))
    .limit(limit);

  for (const ticket of recentTickets) {
    activities.push({
      id: ticket.id,
      type: "ticket",
      title: `新工单`,
      description: `工单号: ${ticket.ticketNo ?? ticket.id.slice(0, 8)}`,
      timestamp: ticket.createdAt.toISOString(),
      metadata: { ticketId: ticket.id, status: ticket.ticketStatus },
    });
  }

  // Recent customers
  const customerFilters: SQL[] = [
    eq(customerAccounts.tenantId, input.tenantId),
    isNull(customerAccounts.deletedAt),
    isNull(customers.deletedAt),
  ];

  const recentCustomers = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      accountId: customerAccounts.id,
      createdAt: customers.createdAt,
    })
    .from(customerAccounts)
    .innerJoin(
      customers,
      and(
        eq(customers.customerAccountId, customerAccounts.id),
        eq(customers.tenantId, customerAccounts.tenantId),
      ),
    )
    .where(and(...customerFilters))
    .orderBy(desc(customers.createdAt))
    .limit(limit);

  for (const customer of recentCustomers) {
    activities.push({
      id: customer.id,
      type: "customer",
      title: `新客户`,
      description: `客户: ${customer.fullName}`,
      timestamp: customer.createdAt.toISOString(),
      metadata: { accountId: customer.accountId, customerId: customer.id },
    });
  }

  // Sort by timestamp and limit
  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return { activities: activities.slice(0, limit) };
}

// ---------------------------------------------------------------------------
// Pending tasks
// ---------------------------------------------------------------------------

export async function findPendingTasks(
  db: Database,
  input: PosWorkspaceRepositoryInput,
): Promise<PosPendingTasksResponse> {
  const tasks: PosPendingTask[] = [];

  // Overdue tickets
  const overdueFilters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
    sql`${serviceTickets.ticketStatus} IN ('pending', 'in_progress', 'ready_to_pick')`,
    sql`${serviceTickets.expectedPickupAt} <= NOW()`,
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return { tasks: [] };
    }
    overdueFilters.push(eq(serviceTickets.branchId, input.allowedBranchIds[0]));
  }

  if (input.branchId) {
    overdueFilters.push(eq(serviceTickets.branchId, input.branchId));
  }

  const overdueCount = await db
    .select({ value: count() })
    .from(serviceTickets)
    .where(and(...overdueFilters));

  if ((overdueCount[0]?.value ?? 0) > 0) {
    tasks.push({
      id: "overdue-tickets",
      type: "overdue_ticket",
      title: "逾期工单",
      description: "有工单已超过预计取件时间",
      count: overdueCount[0]?.value ?? 0,
      priority: "high",
      actionRoute: "/tickets?status=overdue",
    });
  }

  // Unpaid orders
  const unpaidFilters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    isNull(orders.deletedAt),
    sql`${orders.paymentStatus} = 'unpaid'`,
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return { tasks };
    }
    unpaidFilters.push(eq(orders.branchId, input.allowedBranchIds[0]));
  }

  if (input.branchId) {
    unpaidFilters.push(eq(orders.branchId, input.branchId));
  }

  const unpaidCount = await db
    .select({ value: count() })
    .from(orders)
    .where(and(...unpaidFilters));

  if ((unpaidCount[0]?.value ?? 0) > 0) {
    tasks.push({
      id: "unpaid-orders",
      type: "unpaid_order",
      title: "待收款订单",
      description: "有订单尚未收款",
      count: unpaidCount[0]?.value ?? 0,
      priority: "medium",
      actionRoute: "/orders?paymentStatus=unpaid",
    });
  }

  // Pending pickup tickets
  const pickupFilters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
    sql`${serviceTickets.ticketStatus} = 'ready_to_pick'`,
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return { tasks };
    }
    pickupFilters.push(eq(serviceTickets.branchId, input.allowedBranchIds[0]));
  }

  if (input.branchId) {
    pickupFilters.push(eq(serviceTickets.branchId, input.branchId));
  }

  const pickupCount = await db
    .select({ value: count() })
    .from(serviceTickets)
    .where(and(...pickupFilters));

  if ((pickupCount[0]?.value ?? 0) > 0) {
    tasks.push({
      id: "pending-pickup",
      type: "pending_pickup",
      title: "待取件工单",
      description: "有工单等待客户取件",
      count: pickupCount[0]?.value ?? 0,
      priority: "low",
      actionRoute: "/tickets?status=ready_to_pick",
    });
  }

  return { tasks };
}

// ---------------------------------------------------------------------------
// Aggregated overview
// ---------------------------------------------------------------------------

export async function findWorkspaceOverview(
  db: Database,
  input: PosWorkspaceRepositoryInput,
): Promise<PosWorkspaceOverview> {
  const [branch, statistics] = await Promise.all([
    findWorkspaceBranch(db, input),
    findStatisticsOverview(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: input.branchId,
      period: "today",
      timeZone: input.timeZone ?? "UTC",
    }),
  ]);

  return {
    branch,
    statistics: {
      orders: {
        orderCount: statistics.orders.orderCount,
        totalAmount: statistics.orders.totalAmount,
        paidAmount: statistics.orders.paidAmount,
        unpaidCount: statistics.orders.unpaidCount,
      },
      tickets: {
        total: statistics.tickets.total,
        overdueCount: statistics.tickets.overdueCount,
        todayCreatedCount: statistics.tickets.todayCreatedCount,
        todayPickedUpCount: statistics.tickets.todayPickedUpCount,
      },
      customers: {
        totalCount: statistics.customers.totalCount,
        todayNewCount: statistics.customers.todayNewCount,
      },
    },
    quickActions: QUICK_ACTIONS,
  };
}

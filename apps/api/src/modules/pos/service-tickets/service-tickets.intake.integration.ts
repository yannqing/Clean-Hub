import assert from "node:assert/strict";
import "../../../config/env.js";
import { and, eq } from "drizzle-orm";
import {
  auditLogs,
  branches,
  closeDbConnection,
  customerAccounts,
  customers,
  getDb,
  prices,
  runWithSystemDatabaseContext,
  serviceCategories,
  serviceTickets,
  services,
  tenantFeatureFlags,
  tenants,
  ticketItems,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  createPosServiceTicket,
  createPosServiceTicketItem,
} from "./service-tickets.service.js";
import {
  createServiceTicketBodySchema,
  createServiceTicketItemBodySchema,
} from "./service-tickets.validation.js";
import { createPosServiceTicketsRoutes } from "./service-tickets.routes.js";

const rollback = new Error("INTAKE_TEST_ROLLBACK");
async function run() {
  assert.ok(
    ["localhost", "127.0.0.1", "postgres", "[::1]"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    ),
    "Use a local test database.",
  );
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const tenantId = createId(),
            userId = createId(),
            branchId = createId(),
            customerId = createId(),
            accountId = createId(),
            serviceId = createId(),
            categoryId = createId();
          await tx.insert(tenants).values({
            id: tenantId,
            name: "Intake test",
            pressingCode: `INTAKE-${tenantId}`,
            status: "active",
          });
          await tx.insert(users).values({
            id: userId,
            tenantId,
            userType: "tenant",
            passwordHash: "test",
            pinHash: "test",
            status: "active",
          });
          await tx.insert(branches).values({
            id: branchId,
            tenantId,
            name: "Intake store",
            defaultCurrency: "XOF",
            status: "active",
          });
          await tx
            .insert(tenantFeatureFlags)
            .values({ id: createId(), tenantId, laundryEnabled: true });
          await tx.insert(customerAccounts).values({
            id: accountId,
            tenantId,
            accountName: "Family",
            status: "active",
          });
          await tx.insert(customers).values({
            id: customerId,
            tenantId,
            customerAccountId: accountId,
            fullName: "Amina",
            status: "active",
          });
          await tx.insert(serviceCategories).values({
            id: categoryId,
            tenantId,
            name: "Laundry",
            businessLine: "laundry",
            status: "active",
          });
          await tx.insert(services).values({
            id: serviceId,
            tenantId,
            categoryId,
            name: "Wash",
            businessLine: "laundry",
            pricingUnit: "per_item",
            applicableItemTypes: ["cloth"],
            status: "active",
          });
          await tx.insert(prices).values({
            id: createId(),
            tenantId,
            serviceId,
            amount: "1500.00",
            currency: "XOF",
            status: "active",
          });
          const auth: AuthContext = {
            tenantId,
            userId,
            displayName: "Operator",
            role: "cashier",
            roles: ["cashier"],
            permissions: [],
            branchIds: [branchId],
            terminalBranchId: branchId,
            accessTokenExpiresAt: new Date(Date.now() + 60000).toISOString(),
          };
          const ticketId = createId();
          const body = createServiceTicketBodySchema.parse({
            id: ticketId,
            operatorUserId: userId,
            customerId,
            branchId,
            ticketType: "laundry",
            priority: "urgent",
            remark: "Handle carefully",
          });
          const first = await createPosServiceTicket(auth, body, {}, tx);
          const second = await createPosServiceTicket(auth, body, {}, tx);
          assert.equal(first.id, ticketId);
          assert.equal(second.ticketNo, first.ticketNo);
          assert.equal(second.remark, "Handle carefully");
          assert.equal(
            (
              await tx
                .select()
                .from(serviceTickets)
                .where(eq(serviceTickets.id, ticketId))
            ).length,
            1,
          );
          const itemId = createId();
          const itemBody = createServiceTicketItemBodySchema.parse({
            id: itemId,
            operatorUserId: userId,
            serviceId,
            itemType: "cloth",
            quantity: 2,
            itemColor: "Blue",
            defectNotes: "Stain",
          });
          const item1 = await createPosServiceTicketItem(
            auth,
            { ticketId, data: itemBody },
            {},
            tx,
          );
          const item2 = await createPosServiceTicketItem(
            auth,
            { ticketId, data: itemBody },
            {},
            tx,
          );
          assert.equal(item1.id, itemId);
          assert.equal(item2.labelCode, item1.labelCode);
          assert.equal(item2.lineAmount, "3000.00");
          assert.equal(
            (
              await tx
                .select()
                .from(ticketItems)
                .where(eq(ticketItems.ticketId, ticketId))
            ).length,
            1,
          );
          const [after] = await tx
            .select()
            .from(serviceTickets)
            .where(eq(serviceTickets.id, ticketId));
          assert.equal(
            after?.version,
            2,
            "idempotent retries must not bump ticket version",
          );
          assert.equal(
            (
              await tx
                .select()
                .from(auditLogs)
                .where(eq(auditLogs.tenantId, tenantId))
            ).length,
            2,
            "each new entity has one audit event, retries have none",
          );
          // Retry must return the existing result even after later staff edits / feature changes.
          await tx
            .update(serviceTickets)
            .set({ ticketStatus: "picked_up", priority: "critical" })
            .where(eq(serviceTickets.id, ticketId));
          await tx
            .update(tenantFeatureFlags)
            .set({ laundryEnabled: false })
            .where(eq(tenantFeatureFlags.tenantId, tenantId));
          assert.equal(
            (await createPosServiceTicket(auth, body, {}, tx)).priority,
            "critical",
          );
          assert.equal(
            (
              await createPosServiceTicketItem(
                auth,
                { ticketId, data: itemBody },
                {},
                tx,
              )
            ).id,
            itemId,
          );
          await assert.rejects(
            createPosServiceTicket(
              { ...auth, userId: createId() },
              body,
              {},
              tx,
            ),
            /original operator/,
          );
          await assert.rejects(
            createPosServiceTicketItem(
              { ...auth, userId: createId() },
              { ticketId, data: itemBody },
              {},
              tx,
            ),
            /original operator/,
          );
          await assert.rejects(
            createPosServiceTicket(
              auth,
              { ...body, customerId: createId() },
              {},
              tx,
            ),
            /identifier is already in use/,
          );
          await assert.rejects(
            createPosServiceTicket(
              { ...auth, branchIds: [], terminalBranchId: createId() },
              body,
              {},
              tx,
            ),
          );
          // Cross-tenant IDs are neither readable nor reusable.
          const otherTenant = createId(),
            otherBranch = createId();
          await tx.insert(tenants).values({
            id: otherTenant,
            name: "Other",
            pressingCode: `INTAKE-${otherTenant}`,
            status: "active",
          });
          await tx.insert(branches).values({
            id: otherBranch,
            tenantId: otherTenant,
            name: "Other",
            defaultCurrency: "XOF",
            status: "active",
          });
          await tx.insert(tenantFeatureFlags).values({
            id: createId(),
            tenantId: otherTenant,
            laundryEnabled: true,
          });
          const otherAccount = createId(),
            otherCustomer = createId();
          await tx.insert(customerAccounts).values({
            id: otherAccount,
            tenantId: otherTenant,
            accountName: "Other",
          });
          await tx.insert(customers).values({
            id: otherCustomer,
            tenantId: otherTenant,
            customerAccountId: otherAccount,
            fullName: "Other",
          });
          await assert.rejects(
            createPosServiceTicket(
              {
                ...auth,
                tenantId: otherTenant,
                branchIds: [otherBranch],
                terminalBranchId: otherBranch,
              },
              { ...body, branchId: otherBranch, customerId: otherCustomer },
              {},
              tx,
            ),
            /identifier is already in use/,
          );
          assert.equal(
            (
              await tx
                .select()
                .from(serviceTickets)
                .where(
                  and(
                    eq(serviceTickets.tenantId, otherTenant),
                    eq(serviceTickets.id, ticketId),
                  ),
                )
            ).length,
            0,
          );
          // An offline retry must never resurrect a soft-deleted record.
          await tx
            .update(serviceTickets)
            .set({ deletedAt: new Date() })
            .where(eq(serviceTickets.id, ticketId));
          await tx
            .update(tenantFeatureFlags)
            .set({ laundryEnabled: true })
            .where(eq(tenantFeatureFlags.tenantId, tenantId));
          await assert.rejects(
            createPosServiceTicket(auth, body, {}, tx),
            /identifier is already in use/,
          );
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
    const capability = await createPosServiceTicketsRoutes().request(
      "http://localhost/intake-capabilities",
    );
    assert.equal(capability.status, 200);
    assert.deepEqual(await capability.json(), { stableClientIds: true });
    console.log(
      "POS intake idempotency integration passed (ticket/item retries, handover, branch/tenant isolation, deletion, capability). No fixture data retained.",
    );
  } finally {
    await closeDbConnection();
  }
}
await run();

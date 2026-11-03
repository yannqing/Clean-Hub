import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../../config/env.js";
import { and, eq, sql } from "drizzle-orm";
import {
  appointments,
  branches,
  closeDbConnection,
  customerAccounts,
  customerAuthRefreshTokens,
  customerCredentials,
  customers,
  deliveryTasks,
  deliveryTaskEvents,
  getDb,
  orderItems,
  orders,
  orderTicketReferences,
  paymentTransactions,
  posPaymentAdjustments,
  refundRequests,
  runWithSystemDatabaseContext,
  serviceTickets,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
  ticketItems,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import type { AuthContext } from "../auth/auth.types.js";
import type { MobileAuthContext } from "./auth/auth.types.js";
import { MobileAuthRepository } from "./auth/auth.repository.js";
import { CustomerRepository } from "./customer/customer.repository.js";
import { DeliveryRepository } from "./delivery/delivery.repository.js";
import { OwnerRepository } from "./owner/owner.repository.js";
import { PaymentService } from "./payment/payment.service.js";
import {
  getCustomerRefundSettlementPlan,
  settleCustomerRefund,
} from "../pos/payment-adjustments/customer-refunds.service.js";
import { getTenantFinanceSummaryRecord } from "../tenant/finance/finance.repository.js";
import { findCustomerAppointmentTracking } from "./customer/customer-tracking.repository.js";
import { findPosAccountById } from "../pos/customers/customers.repository.js";
import { CustomerService } from "./customer/customer.service.js";
import { receiveCustomerAppointment } from "./owner/appointment-reception.service.js";
import { revokeTenantRefreshTokens } from "../saas/tenants/tenants.repository.js";

const rollback = new Error("CUSTOMER_APP_READINESS_ROLLBACK");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
  "Use a local test database.",
);
try {
  await runWithSystemDatabaseContext(async () => {
    try {
      await getDb().transaction(async (tx) => {
        const tenantId = createId(),
          branchId = createId(),
          userId = createId(),
          accountId = createId(),
          customerId = createId();
        await tx.insert(tenants).values({
          id: tenantId,
          name: "Customer readiness integration",
          pressingCode: `TEST-${tenantId}`,
          country: "SN",
        });
        await tx.insert(users).values({
          id: userId,
          tenantId,
          userType: "tenant",
          passwordHash: "test-only",
          pinHash: "test-only",
          status: "active",
        });
        await tx.insert(tenantSettings).values({
          id: createId(),
          tenantId,
          defaultCurrency: "XOF",
          timezone: "Africa/Dakar",
        });
        await tx.insert(tenantFeatureFlags).values({
          id: createId(),
          tenantId,
          laundryEnabled: true,
          deliveryEnabled: true,
        });
        await tx.insert(branches).values({
          id: branchId,
          tenantId,
          name: "Readiness store",
          defaultCurrency: "XOF",
          status: "active",
        });
        await tx.insert(customerAccounts).values({
          id: accountId,
          tenantId,
          accountName: "Customer",
          status: "active",
        });
        await tx.insert(customers).values({
          id: customerId,
          tenantId,
          customerAccountId: accountId,
          fullName: "Contact",
        });
        const auth: AuthContext = {
          userId,
          tenantId,
          displayName: "Owner",
          branchIds: [branchId],
          role: "owner",
          roles: ["owner"],
          permissions: [],
          accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        };
        // Exercise the historical repair SQL as well as the new runtime flow.
        const strandedAppointmentId = createId(),
          oldCancelledTaskId = createId();
        await tx.insert(appointments).values({
          id: strandedAppointmentId,
          tenantId,
          branchId,
          customerId,
          type: "pickup",
          status: "accepted",
          expectedAt: new Date(),
          address: "Repair fixture",
        });
        await tx.insert(deliveryTasks).values({
          id: oldCancelledTaskId,
          tenantId,
          branchId,
          customerId,
          appointmentId: strandedAppointmentId,
          type: "pickup",
          status: "cancelled",
          customerName: "Repair fixture",
          address: "Repair fixture",
        });
        const repairSql = await readFile(
          new URL(
            "../../../../../packages/db/drizzle/0074_repair_cancelled_delivery_appointments.sql",
            import.meta.url,
          ),
          "utf8",
        );
        await tx.execute(sql.raw(repairSql));
        const repaired = (
          await tx
            .select()
            .from(appointments)
            .where(eq(appointments.id, strandedAppointmentId))
        )[0]!;
        assert.equal(
          repaired.status,
          "pending",
          "historical cancelled orphan is reopened",
        );
        await tx.execute(sql.raw(repairSql));
        assert.equal(
          (
            await tx
              .select()
              .from(appointments)
              .where(eq(appointments.id, strandedAppointmentId))
          )[0]?.version,
          repaired.version,
          "repair migration is idempotent",
        );
        await tx
          .delete(deliveryTasks)
          .where(eq(deliveryTasks.id, oldCancelledTaskId));
        await tx
          .delete(appointments)
          .where(eq(appointments.id, strandedAppointmentId));
        const customer: MobileAuthContext = {
          subjectId: accountId,
          tenantId,
          displayName: "Customer",
          subjectType: "customer",
          role: "customer",
          roles: ["customer"],
          branchIds: [],
          permissions: [],
          currency: "XOF",
          country: "SN",
          accessTokenExpiresAt: auth.accessTokenExpiresAt,
        };
        const owner: MobileAuthContext = {
          ...customer,
          subjectId: userId,
          subjectType: "staff",
          role: "owner",
          roles: ["owner"],
          branchIds: [branchId],
        };
        const createOrder = async (amount = "1000.00") => {
          const id = createId();
          await tx.insert(orders).values({
            id,
            tenantId,
            branchId,
            customerId,
            currency: "XOF",
            status: "paid",
            paymentStatus: "paid",
            subtotalAmount: amount,
            totalAmount: amount,
            paidAmount: amount,
            createdBy: userId,
          });
          return id;
        };
        const orderId = await createOrder();
        const cash = createId(),
          card = createId();
        await tx.insert(paymentTransactions).values([
          {
            id: cash,
            tenantId,
            branchId,
            customerId,
            orderId,
            currency: "XOF",
            amount: "600.00",
            paymentMethod: "cash",
            paymentStatus: "paid",
            paidAt: new Date(),
            createdAt: new Date(Date.now() - 1000),
            createdBy: userId,
          },
          {
            id: card,
            tenantId,
            branchId,
            customerId,
            orderId,
            currency: "XOF",
            amount: "400.00",
            paymentMethod: "card",
            paymentStatus: "paid",
            paidAt: new Date(),
            createdBy: userId,
          },
        ]);
        const payments = new PaymentService({
          db: tx,
          config: {
            gateway: "mock",
            mockSecret: "integration-only",
            mockPaymentBaseUrl: "https://example.invalid",
          },
        });
        const request = await payments.createRefundRequest({
          authContext: customer,
          orderId,
          amount: "800.00",
          reason: "Customer requested return",
        });
        const approved = await payments.approveRefundRequest({
          authContext: owner,
          refundRequestId: request.id,
        });
        assert.equal(approved.refundRequest.status, "approved");
        assert.equal(approved.gateway, undefined);
        const getOrder = async () =>
          (await tx.select().from(orders).where(eq(orders.id, orderId)))[0]!;
        assert.equal(
          (await getOrder()).paidAmount,
          "1000.00",
          "approval never moves money",
        );
        await assert.rejects(() =>
          payments.createRefundRequest({
            authContext: customer,
            orderId,
            amount: "100.00",
            reason: "Duplicate",
          }),
        );
        const plan = await getCustomerRefundSettlementPlan(
          auth,
          request.id,
          tx,
        );
        assert.deepEqual(
          plan.allocations.map((a) => [a.paymentId, a.amount]),
          [
            [cash, "600.00"],
            [card, "200.00"],
          ],
        );
        await assert.rejects(() =>
          settleCustomerRefund(
            auth,
            request.id,
            {
              cashReturned: false,
              providerReferences: { [card]: "PROVIDER-1" },
            },
            tx,
          ),
        );
        await assert.rejects(() =>
          settleCustomerRefund(
            auth,
            request.id,
            { cashReturned: true, providerReferences: {} },
            tx,
          ),
        );
        assert.equal(
          (await getOrder()).paidAmount,
          "1000.00",
          "failed settlement is atomic",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(posPaymentAdjustments)
              .where(eq(posPaymentAdjustments.orderId, orderId))
          ).length,
          0,
        );
        await settleCustomerRefund(
          auth,
          request.id,
          { cashReturned: true, providerReferences: { [card]: "PROVIDER-1" } },
          tx,
        );
        assert.equal((await getOrder()).paidAmount, "200.00");
        const adjustments = await tx
          .select()
          .from(posPaymentAdjustments)
          .where(eq(posPaymentAdjustments.orderId, orderId));
        assert.equal(adjustments.length, 2);
        assert.ok(
          adjustments.every(
            (a) =>
              a.customerRefundRequestId === request.id &&
              a.status === "succeeded",
          ),
        );
        assert.equal(
          (
            await settleCustomerRefund(
              auth,
              request.id,
              { cashReturned: true, providerReferences: {} },
              tx,
            )
          ).idempotent,
          true,
        );
        assert.equal(
          (await getOrder()).paidAmount,
          "200.00",
          "replay never refunds twice",
        );

        const finance = await getTenantFinanceSummaryRecord(tx, {
          tenantId,
          allowedBranchIds: [branchId],
          currency: "XOF",
          timezone: "Africa/Dakar",
          availableCurrencies: ["XOF"],
          availableBranches: [{ id: branchId, name: "Store" }],
          from: new Date(Date.now() - 86400000).toISOString(),
          to: new Date(Date.now() + 86400000).toISOString(),
        });
        assert.equal(
          finance.summary.refundAmount,
          800,
          "customer request and POS adjustments never double-count refunds",
        );
        assert.equal(finance.summary.netCollected, 200);
        assert.equal(
          finance.recentTransactions.filter((t) => t.kind === "refund").length,
          2,
        );
        const customerRepo = new CustomerRepository(tx);
        assert.equal(
          (
            await customerRepo.getOrderDetail({
              tenantId,
              customerAccountId: accountId,
              orderId,
            })
          )?.branchName,
          "Readiness store",
        );
        await customerRepo.softDeleteContact({
          tenantId,
          customerAccountId: accountId,
          customerId,
        });
        assert.equal(
          (
            await tx
              .select()
              .from(customers)
              .where(eq(customers.id, customerId))
          )[0]?.deletedAt,
          null,
        );
        assert.ok(
          (
            await customerRepo.listOrders({
              tenantId,
              customerAccountId: accountId,
            })
          ).some((o) => o.id === orderId),
          "archiving contact preserves financial history",
        );
        assert.equal(
          (
            await customerRepo.getProfile({
              tenantId,
              customerAccountId: accountId,
            })
          )?.addresses.length,
          0,
        );

        const ticketId = createId(),
          ticketItemId = createId(),
          deliveryOrderId = await createOrder();
        await tx.insert(serviceTickets).values({
          id: ticketId,
          tenantId,
          branchId,
          customerId,
          currency: "XOF",
          ticketType: "laundry",
          ticketStatus: "ready_to_pick",
          createdBy: userId,
        });
        await tx.insert(ticketItems).values({
          id: ticketItemId,
          tenantId,
          branchId,
          ticketId,
          itemName: "Shirt",
          itemStatus: "ready_to_pick",
          unitAmount: "1000",
          lineAmount: "1000",
        });
        await tx.insert(orderItems).values({
          id: createId(),
          tenantId,
          branchId,
          customerId,
          orderId: deliveryOrderId,
          ticketId,
          sourceType: "ticket_item",
          sourceId: ticketItemId,
          itemName: "Shirt",
          quantity: "1",
          unitAmount: "1000",
          lineAmount: "1000",
        });
        await tx.insert(orderTicketReferences).values({
          id: createId(),
          tenantId,
          branchId,
          orderId: deliveryOrderId,
          ticketId,
          createdBy: userId,
        });
        const appointmentId = createId();
        const input = {
          id: appointmentId,
          tenantId,
          branchId,
          customerId,
          type: "dropoff" as const,
          ticketId,
          expectedAt: new Date(Date.now() + 3600000),
          address: "Delivery address",
        };
        assert.equal(
          (await customerRepo.createAppointment(input)).id,
          appointmentId,
        );
        assert.equal(
          (await customerRepo.createAppointment(input)).id,
          appointmentId,
          "appointment timeout retry is idempotent",
        );
        await assert.rejects(
          () => customerRepo.createAppointment({ ...input, id: createId() }),
          "duplicate active return delivery is rejected",
        );
        let accepted = await new OwnerRepository(
          tx,
        ).acceptAppointmentAndCreateTask({
          tenantId,
          appointmentId,
          operatorUserId: userId,
          assigneeUserId: userId,
        });
        assert.ok(accepted);
        const deliveryRepo = new DeliveryRepository(tx);
        const statusInput = {
          tenantId,
          taskId: accepted.taskId,
          driverUserId: userId,
          fromStatus: "pending_dispatch" as const,
          toStatus: "en_route" as const,
          idempotencyKey: "status-fault-retry",
        };
        // Real PostgreSQL fault injection: event failure must roll back status.
        await tx.execute(sql`CREATE FUNCTION pg_temp.reject_delivery_audit_write() RETURNS trigger
          LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_DELIVERY_WRITE_FAILURE'; END $$`);
        await tx.execute(
          sql.raw(`CREATE TRIGGER readiness_event_fault BEFORE INSERT ON delivery_task_events
          FOR EACH ROW WHEN (NEW.task_id = '${accepted.taskId}')
          EXECUTE FUNCTION pg_temp.reject_delivery_audit_write()`),
        );
        await assert.rejects(
          () => deliveryRepo.transitionTask(statusInput),
          (error: unknown) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes("INJECTED_DELIVERY_WRITE_FAILURE"),
        );
        assert.equal(
          (
            await tx
              .select()
              .from(deliveryTasks)
              .where(eq(deliveryTasks.id, accepted.taskId))
          )[0]?.status,
          "pending_dispatch",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(deliveryTaskEvents)
              .where(
                and(
                  eq(deliveryTaskEvents.taskId, accepted.taskId),
                  eq(
                    deliveryTaskEvents.idempotencyKey,
                    statusInput.idempotencyKey,
                  ),
                ),
              )
          ).length,
          0,
        );
        await tx.execute(
          sql`DROP TRIGGER readiness_event_fault ON delivery_task_events`,
        );
        assert.equal(
          (await deliveryRepo.transitionTask(statusInput))?.idempotent,
          false,
        );
        assert.equal(
          (await deliveryRepo.transitionTask(statusInput))?.idempotent,
          true,
        );
        const cancelInput = {
          tenantId,
          taskId: accepted.taskId,
          operatorUserId: userId,
          taskVersion: (
            await tx
              .select()
              .from(deliveryTasks)
              .where(eq(deliveryTasks.id, accepted.taskId))
          )[0]!.version,
          fromStatus: "en_route" as const,
          idempotencyKey: "cancel-fault-retry",
          reason: "Retry test",
        };
        await tx.execute(
          sql.raw(`CREATE TRIGGER readiness_appointment_fault BEFORE UPDATE ON appointments
          FOR EACH ROW WHEN (OLD.id = '${appointmentId}' AND NEW.status = 'pending')
          EXECUTE FUNCTION pg_temp.reject_delivery_audit_write()`),
        );
        await assert.rejects(
          () => deliveryRepo.cancelTask(cancelInput),
          (error: unknown) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes("INJECTED_DELIVERY_WRITE_FAILURE"),
        );
        assert.equal(
          (
            await tx
              .select()
              .from(deliveryTasks)
              .where(eq(deliveryTasks.id, accepted.taskId))
          )[0]?.status,
          "en_route",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(appointments)
              .where(eq(appointments.id, appointmentId))
          )[0]?.status,
          "accepted",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(deliveryTaskEvents)
              .where(
                and(
                  eq(deliveryTaskEvents.taskId, accepted.taskId),
                  eq(
                    deliveryTaskEvents.idempotencyKey,
                    cancelInput.idempotencyKey,
                  ),
                ),
              )
          ).length,
          0,
        );
        await tx.execute(
          sql`DROP TRIGGER readiness_appointment_fault ON appointments`,
        );
        assert.ok(await deliveryRepo.cancelTask(cancelInput));
        assert.equal(
          (
            await tx
              .select()
              .from(appointments)
              .where(eq(appointments.id, appointmentId))
          )[0]?.status,
          "pending",
        );
        const cancelledTaskId = accepted.taskId;
        accepted = await new OwnerRepository(tx).acceptAppointmentAndCreateTask(
          {
            tenantId,
            appointmentId,
            operatorUserId: userId,
            assigneeUserId: userId,
          },
        );
        assert.ok(accepted);
        assert.notEqual(
          accepted.taskId,
          cancelledTaskId,
          "cancelled appointment can be assigned to a new task",
        );
        await deliveryRepo.reconcileCancelledAppointment({
          tenantId,
          taskId: cancelledTaskId,
          operatorUserId: userId,
        });
        assert.equal(
          (
            await tx
              .select()
              .from(appointments)
              .where(eq(appointments.id, appointmentId))
          )[0]?.deliveryTaskId,
          accepted.taskId,
          "replaying old cancellation preserves replacement task",
        );
        await tx
          .update(deliveryTasks)
          .set({ status: "delivering" })
          .where(eq(deliveryTasks.id, accepted.taskId));
        await tx
          .update(orders)
          .set({ paymentStatus: "partial", paidAmount: "900.00" })
          .where(eq(orders.id, deliveryOrderId));
        await assert.rejects(
          () =>
            deliveryRepo.signTask({
              tenantId,
              taskId: accepted.taskId,
              driverUserId: userId,
              fromStatus: "delivering",
              signatureMediaRef: "invalid-signature",
              idempotencyKey: createId(),
            }),
          "unpaid work cannot be signed off",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(deliveryTasks)
              .where(eq(deliveryTasks.id, accepted.taskId))
          )[0]?.status,
          "delivering",
          "failed signature rolls back the task",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(serviceTickets)
              .where(eq(serviceTickets.id, ticketId))
          )[0]?.ticketStatus,
          "ready_to_pick",
          "failed signature rolls back the work order",
        );
        await tx
          .update(orders)
          .set({ paymentStatus: "paid", paidAmount: "1000.00" })
          .where(eq(orders.id, deliveryOrderId));
        const signed = await deliveryRepo.signTask({
          tenantId,
          taskId: accepted.taskId,
          driverUserId: userId,
          fromStatus: "delivering",
          signatureMediaRef: "integration-signature",
          idempotencyKey: createId(),
        });
        assert.ok(signed);
        assert.equal(
          (
            await tx
              .select()
              .from(serviceTickets)
              .where(eq(serviceTickets.id, ticketId))
          )[0]?.ticketStatus,
          "picked_up",
        );
        assert.equal(
          (
            await tx.select().from(orders).where(eq(orders.id, deliveryOrderId))
          )[0]?.status,
          "delivered",
        );
        assert.equal(
          (
            await tx
              .select()
              .from(appointments)
              .where(eq(appointments.id, appointmentId))
          )[0]?.status,
          "done",
        );

        const pickupId = createId();
        await tx.insert(appointments).values({
          id: pickupId,
          tenantId,
          branchId,
          customerId,
          type: "pickup",
          status: "done",
          expectedAt: new Date(),
          address: "Pickup address",
        });
        const received = await receiveCustomerAppointment(
          auth,
          pickupId,
          "laundry",
          tx,
        );
        assert.equal(
          (await receiveCustomerAppointment(auth, pickupId, "laundry", tx))
            .ticketId,
          received.ticketId,
        );
        assert.equal(
          (
            await tx
              .select()
              .from(serviceTickets)
              .where(eq(serviceTickets.id, received.ticketId))
          )[0]?.sourceChannel,
          "app",
        );

        const tracking = await findCustomerAppointmentTracking(tx, {
          tenantId,
          customerAccountId: accountId,
          appointmentId,
        });
        assert.equal(tracking?.deliveryStatus, "signed");
        assert.equal(
          await findCustomerAppointmentTracking(tx, {
            tenantId,
            customerAccountId: createId(),
            appointmentId,
          }),
          null,
          "another customer cannot track the appointment",
        );
        assert.equal(
          await findCustomerAppointmentTracking(tx, {
            tenantId: createId(),
            customerAccountId: accountId,
            appointmentId,
          }),
          null,
          "another tenant cannot track the appointment",
        );
        await assert.rejects(
          () => customerRepo.createAppointment({ ...input, id: createId() }),
          "already delivered tickets cannot schedule a second delivery",
        );
        const paged = await new CustomerService({
          db: tx,
        }).listOrdersAndTickets(customer, { limit: 1 });
        assert.equal(paged.orders.length, 1);
        assert.equal(paged.nextOffset, 1);
        const secondPage = await new CustomerService({
          db: tx,
        }).listOrdersAndTickets(customer, { limit: 1, offset: 1 });
        assert.notEqual(
          paged.orders[0]?.id,
          secondPage.orders[0]?.id,
          "paging does not repeat the first page",
        );
        const beforeAccess = await findPosAccountById(tx, tenantId, accountId);
        assert.equal(beforeAccess?.appAccess?.passwordEnabled, false);
        assert.equal(beforeAccess?.appAccess?.tenantCode, `TEST-${tenantId}`);
        await tx.insert(customerCredentials).values({
          id: createId(),
          tenantId,
          customerAccountId: accountId,
          passwordHash: "test-only",
          mustChangePassword: true,
        });
        const issuedAccess = await findPosAccountById(tx, tenantId, accountId);
        assert.equal(issuedAccess?.appAccess?.passwordEnabled, true);
        assert.equal(issuedAccess?.appAccess?.mustChangePassword, true);
        const appointmentsPage = await new CustomerService({
          db: tx,
        }).listAppointments(customer, { limit: 1, offset: 1 });
        assert.equal(
          appointmentsPage.length,
          1,
          "appointment history supports bounded pages",
        );
        const authRepo = new MobileAuthRepository(tx);
        const otpInput = {
          tenantId,
          customerAccountId: accountId,
          phone: "+221000000000",
          code: "654321",
          expiresAt: new Date(Date.now() + 600000),
          minimumIntervalSeconds: 60,
        };
        await authRepo.createCustomerOtp(otpInput);
        await assert.rejects(
          () => authRepo.createCustomerOtp(otpInput),
          "OTP resend is throttled in the database",
        );
        const tokenId = await authRepo.createCustomerRefreshToken({
          customerAccountId: accountId,
          tenantId,
          tokenHash: createId(),
          familyId: createId(),
          expiresAt: new Date(Date.now() + 3600000),
        });
        await tx
          .update(tenants)
          .set({ status: "suspended" })
          .where(eq(tenants.id, tenantId));
        assert.equal(
          await authRepo.findTenantById(tenantId),
          null,
          "suspended tenant cannot resolve an existing mobile session",
        );
        await revokeTenantRefreshTokens(tx, tenantId);
        assert.ok(
          (
            await tx
              .select()
              .from(customerAuthRefreshTokens)
              .where(
                and(
                  eq(customerAuthRefreshTokens.tenantId, tenantId),
                  eq(customerAuthRefreshTokens.id, tokenId),
                ),
              )
          )[0]?.revokedAt,
        );
        assert.equal(
          (
            await tx
              .select()
              .from(refundRequests)
              .where(eq(refundRequests.id, request.id))
          )[0]?.status,
          "refunded",
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
  console.log(
    "Customer app readiness integration passed: refund ledger, mixed tender, replay, archived history, appointment, delivery, reception, tenant sessions. All fixtures rolled back.",
  );
} finally {
  await closeDbConnection();
}

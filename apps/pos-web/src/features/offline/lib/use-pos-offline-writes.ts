"use client";

import {
  ApiHttpError,
  ApiNetworkError,
  ApiParseError,
  ApiTimeoutError,
  type ChangePosOrderStatusRequest,
  type ChangeServiceTicketStatusRequest,
  type CreatePosAccountRequest,
  type CreatePosCheckoutRequest,
  type CreatePosProfileRequest,
  type CreatePosOrderRequest,
  type CreatePosPaymentRequest,
  type CreatePosPaymentResponse,
  type PosCustomerProfileWithAccount,
} from "@cleanhub/api-client";
import type { EnqueueInput } from "@cleanhub/offline";
import { useCallback } from "react";

import { posApi } from "@/lib/api-client";
import { isPosTerminalSessionInvalidated } from "@/lib/pos-terminal-session";
import { posMessage } from "@/lib/pos-message";

import { useOfflineSync } from "../components/offline-sync-provider";
import {
  createCustomerAccountOfflineMutation,
  createCustomerProfileOfflineMutation,
  createOrderOfflineMutation,
  createOrderCheckoutOfflineMutation,
  createOrderPaymentOfflineMutation,
  createOrderStatusOfflineMutation,
  createTicketStatusOfflineMutation,
  findQueuedPosCreateDependency,
  getQueuedPosCustomerAccounts,
  getQueuedPosCustomerProfiles,
  POS_OFFLINE_ENTITIES,
  resolvePosOfflineDependencyState,
  type PosOfflineCustomerAccountSnapshot,
  type PosOfflineCustomerAccountResult,
  type PosOfflineCustomerProfileResult,
  type PosOfflineMutation,
  type PosOfflineOrderPaymentResult,
  type PosOfflineCheckoutResult,
  type PosOfflineOrderResult,
  type PosOfflineOrderStatusResult,
  type PosOfflinePayload,
  type PosQueuedCustomerAccount,
  type PosOfflineTicketStatusResult,
} from "./pos-offline-operations";

// Online payment writes can be overridden (for example to keep going through
// the pay server action) while the offline fallback still uses the queue.
export type PosOfflinePayOrderWrite = (
  input: CreatePosPaymentRequest,
  options: { idempotencyKey: string; requestId: string },
) => Promise<CreatePosPaymentResponse | undefined>;

export type PosOfflineOrderWriteOptions = {
  allowOffline?: boolean;
  /** A terminal health check already established that the API is unreachable. */
  forceOffline?: boolean;
};

function isUncertainWriteOutcome(error: unknown): boolean {
  if (
    error instanceof ApiNetworkError ||
    error instanceof ApiTimeoutError ||
    error instanceof ApiParseError
  ) {
    return true;
  }

  return (
    error instanceof ApiHttpError &&
    (error.status === 408 || error.status === 425 || error.status === 429 ||
      error.status >= 500)
  );
}

export function usePosOfflineWrites() {
  const {
    connectionStatusResolved,
    isConnectionAvailable,
    pendingCount,
    queue,
    refresh,
  } = useOfflineSync();

  const execute = useCallback(
    async <TData, TPayload extends PosOfflinePayload>(
      mutation: PosOfflineMutation<TPayload>,
      write: () => Promise<TData>,
      options: PosOfflineOrderWriteOptions = {},
    ): Promise<
      | { queued: false; data: TData }
      | { queued: true; entityId: string; operationId: string }
    > => {
      if (isPosTerminalSessionInvalidated()) {
        throw new Error("The enrolled terminal session is no longer active.");
      }

      if (!queue) {
        throw new Error("The enrolled terminal scope is unavailable.");
      }

      const isOffline =
        options.forceOffline ||
        !isConnectionAvailable ||
        (typeof navigator !== "undefined" && !navigator.onLine);
      if (isOffline && options.allowOffline === false) {
        throw new Error(
          "该订单包含不允许离线销售的商品，请恢复网络后再提交。",
        );
      }

      const dependencyState = resolvePosOfflineDependencyState(
        await queue.list(),
        mutation.metadata.dependsOnOperationIds,
      );
      if (dependencyState.blockedOperationId) {
        throw new Error(
          dependencyState.lastError
            ? posMessage("pos.inline.upstreamSyncFailed", {
                reason: dependencyState.lastError,
              })
            : "上游离线数据尚未正确同步，请先处理同步队列后再继续。",
        );
      }

      // Write-ahead invariant: the complete command and its stable
      // idempotency key reach SQLite/IndexedDB before any server request.
      // If power disappears after the server commits but before the response,
      // startup replay safely asks the backend for the same result.
      const item = await queue.enqueue(mutation as EnqueueInput<TPayload>);
      await refresh();

      const queuedResult = () => {
        if (isPosTerminalSessionInvalidated()) {
          throw new Error(
            "The enrolled terminal session is no longer active.",
          );
        }
        return {
          queued: true as const,
          entityId: mutation.entityId,
          operationId: item.id,
        };
      };

      if (item.id !== mutation.id) {
        // The same idempotency key is already durable (for example after a
        // reboot during checkout). Never send a newly reconstructed body under
        // that key; recovery must replay the original persisted intent.
        return queuedResult();
      }

      if (dependencyState.pendingOperationIds.length > 0) {
        return queuedResult();
      }

      if (isOffline) {
        return queuedResult();
      }

      try {
        const data = await write();
        await queue.markSynced(item.id);
        await refresh();
        return { queued: false, data };
      } catch (error) {
        if (isUncertainWriteOutcome(error) && options.allowOffline !== false) {
          // A timeout, malformed success response, rate limit, or 5xx can be
          // observed after the server has already committed. Keep the durable
          // journal entry so recovery asks the idempotent endpoint instead of
          // silently losing the sale.
          return queuedResult();
        }
        // A definitive validation/authorization response means the command did
        // not commit. Remove its journal entry so startup recovery does not
        // retry a rejected business operation forever.
        await queue.markSynced(item.id);
        await refresh();
        throw error;
      }
    },
    [isConnectionAvailable, queue, refresh],
  );

  const createCustomerAccount = useCallback(
    async (
      input: CreatePosAccountRequest,
    ): Promise<PosOfflineCustomerAccountResult> => {
      const mutation = createCustomerAccountOfflineMutation(input);
      return execute(mutation, () =>
        posApi.pos.accounts.create(mutation.payload.input, {
          idempotencyKey: mutation.idempotencyKey,
          requestId: mutation.id,
        }),
      );
    },
    [execute],
  );

  const createOrder = useCallback(
    async (
      input: CreatePosOrderRequest,
      options: PosOfflineOrderWriteOptions = {},
    ): Promise<PosOfflineOrderResult> => {
      const items = queue ? await queue.list() : [];
      const customerDependency =
        input.orderType === "manual" && input.customerId
          ? findQueuedPosCreateDependency(
              items,
              POS_OFFLINE_ENTITIES.customerProfileCreate,
              input.customerId,
            )
          : undefined;
      assertDependencyUsable(customerDependency);
      const mutation = createOrderOfflineMutation(
        input,
        customerDependency ? [customerDependency.operationId] : [],
      );
      return execute(
        mutation,
        () =>
          posApi.pos.orders.create(mutation.payload.input, {
            idempotencyKey: mutation.idempotencyKey,
            requestId: mutation.id,
          }),
        options,
      );
    },
    [execute, queue],
  );

  const checkoutOrder = useCallback(
    async (
      input: CreatePosCheckoutRequest,
      options: PosOfflineOrderWriteOptions = {},
    ): Promise<PosOfflineCheckoutResult> => {
      const items = queue ? await queue.list() : [];
      const customerDependency =
        input.order.orderType === "manual" && input.order.customerId
          ? findQueuedPosCreateDependency(
              items,
              POS_OFFLINE_ENTITIES.customerProfileCreate,
              input.order.customerId,
            )
          : undefined;
      assertDependencyUsable(customerDependency);
      const mutation = createOrderCheckoutOfflineMutation(
        input,
        customerDependency ? [customerDependency.operationId] : [],
      );
      return execute(
        mutation,
        () =>
          posApi.pos.orders.checkout(mutation.payload.input, {
            idempotencyKey: mutation.idempotencyKey,
            requestId: mutation.id,
          }),
        options,
      );
    },
    [execute, queue],
  );

  const payOrder = useCallback(
    async (
      orderId: string,
      input: CreatePosPaymentRequest,
      write?: PosOfflinePayOrderWrite,
    ): Promise<PosOfflineOrderPaymentResult> => {
      const items = queue ? await queue.list() : [];
      const pendingPayment = items.find(
        (item) =>
          item.status === "pending" &&
          item.entity === POS_OFFLINE_ENTITIES.orderPaymentCreate &&
          item.metadata?.entityId === orderId,
      );
      if (pendingPayment) {
        return {
          queued: true,
          entityId: orderId,
          operationId: pendingPayment.id,
        };
      }
      // Payments for offline-created orders must wait for the order create
      // operation, otherwise replay would target a not-yet-synced order id.
      const orderDependency = findQueuedPosCreateDependency(
        items,
        POS_OFFLINE_ENTITIES.orderCreate,
        orderId,
      );
      assertDependencyUsable(orderDependency);
      const mutation = createOrderPaymentOfflineMutation(
        orderId,
        input,
        orderDependency ? [orderDependency.operationId] : [],
      );
      const requestOptions = {
        idempotencyKey: mutation.idempotencyKey,
        requestId: mutation.id,
      };
      return execute(mutation, () =>
        write
          ? write(mutation.payload.input, requestOptions)
          : posApi.pos.orders.pay(
              orderId,
              mutation.payload.input,
              requestOptions,
            ),
      );
    },
    [execute, queue],
  );

  const createCustomerProfile = useCallback(
    async (
      accountId: string,
      input: CreatePosProfileRequest,
      account: PosOfflineCustomerAccountSnapshot,
    ): Promise<PosOfflineCustomerProfileResult> => {
      const items = queue ? await queue.list() : [];
      const accountDependency = findQueuedPosCreateDependency(
        items,
        POS_OFFLINE_ENTITIES.customerAccountCreate,
        accountId,
      );
      assertDependencyUsable(accountDependency);
      const mutation = createCustomerProfileOfflineMutation(
        accountId,
        input,
        account,
        accountDependency ? [accountDependency.operationId] : [],
      );
      return execute(mutation, () =>
        posApi.pos.accounts.createProfile(
          accountId,
          mutation.payload.input,
          {
            idempotencyKey: mutation.idempotencyKey,
            requestId: mutation.id,
          },
        ),
      );
    },
    [execute, queue],
  );

  const listQueuedCustomerAccounts = useCallback(async (): Promise<
    PosQueuedCustomerAccount[]
  > => {
    if (!queue) {
      return [];
    }
    return getQueuedPosCustomerAccounts(await queue.list());
  }, [queue]);

  const listQueuedCustomerProfiles = useCallback(async (): Promise<
    PosCustomerProfileWithAccount[]
  > => {
    if (!queue) {
      return [];
    }
    return getQueuedPosCustomerProfiles(await queue.list());
  }, [queue]);

  const changeOrderStatus = useCallback(
    async (
      orderId: string,
      input: ChangePosOrderStatusRequest,
    ): Promise<PosOfflineOrderStatusResult> => {
      const mutation = createOrderStatusOfflineMutation(orderId, input);
      return execute(mutation, () =>
        posApi.pos.orders.changeStatus(orderId, input, {
          idempotencyKey: mutation.idempotencyKey,
          requestId: mutation.id,
        }),
      );
    },
    [execute],
  );

  const changeTicketStatus = useCallback(
    async (
      ticketId: string,
      input: ChangeServiceTicketStatusRequest,
    ): Promise<PosOfflineTicketStatusResult> => {
      const mutation = createTicketStatusOfflineMutation(ticketId, input);
      return execute(mutation, () =>
        posApi.pos.serviceTickets.changeStatus(ticketId, input, {
          idempotencyKey: mutation.idempotencyKey,
          requestId: mutation.id,
        }),
      );
    },
    [execute],
  );

  return {
    createCustomerAccount,
    createCustomerProfile,
    checkoutOrder,
    createOrder,
    listQueuedCustomerAccounts,
    listQueuedCustomerProfiles,
    payOrder,
    pendingCount,
    isConnectionAvailable,
    connectionStatusResolved,
    changeOrderStatus,
    changeTicketStatus,
  };
}

function assertDependencyUsable(
  dependency:
    | { blocked: boolean; lastError?: string }
    | undefined,
): void {
  if (!dependency?.blocked) {
    return;
  }

  throw new Error(
    dependency.lastError
      ? posMessage("pos.inline.upstreamSyncFailed", {
          reason: dependency.lastError,
        })
      : "上游离线数据尚未正确同步，请先处理同步队列后再继续。",
  );
}

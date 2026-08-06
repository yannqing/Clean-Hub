"use client";

import {
  ApiNetworkError,
  ApiTimeoutError,
  type ChangePosOrderStatusRequest,
  type ChangeServiceTicketStatusRequest,
  type CreatePosAccountRequest,
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

import { useOfflineSync } from "../components/offline-sync-provider";
import {
  createCustomerAccountOfflineMutation,
  createCustomerProfileOfflineMutation,
  createOrderOfflineMutation,
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

export function usePosOfflineWrites() {
  const { pendingCount, queue, refresh } = useOfflineSync();

  const execute = useCallback(
    async <TData, TPayload extends PosOfflinePayload>(
      mutation: PosOfflineMutation<TPayload>,
      write: () => Promise<TData>,
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

      const enqueue = async () => {
        if (isPosTerminalSessionInvalidated()) {
          throw new Error(
            "The enrolled terminal session is no longer active.",
          );
        }

        const item = await queue.enqueue(mutation as EnqueueInput<TPayload>);
        await refresh();
        return {
          queued: true as const,
          entityId: mutation.entityId,
          operationId: item.id,
        };
      };

      const dependencyState = resolvePosOfflineDependencyState(
        await queue.list(),
        mutation.metadata.dependsOnOperationIds,
      );
      if (dependencyState.blockedOperationId) {
        throw new Error(
          dependencyState.lastError
            ? `上游离线数据同步失败：${dependencyState.lastError}`
            : "上游离线数据尚未正确同步，请先处理同步队列后再继续。",
        );
      }
      if (dependencyState.pendingOperationIds.length > 0) {
        return enqueue();
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return enqueue();
      }

      try {
        return { queued: false, data: await write() };
      } catch (error) {
        if (
          error instanceof ApiNetworkError ||
          error instanceof ApiTimeoutError
        ) {
          return enqueue();
        }
        throw error;
      }
    },
    [queue, refresh],
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
    async (input: CreatePosOrderRequest): Promise<PosOfflineOrderResult> => {
      const items = queue ? await queue.list() : [];
      const customerDependency =
        input.orderType === "manual"
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
      return execute(mutation, () =>
        posApi.pos.orders.create(mutation.payload.input, {
          idempotencyKey: mutation.idempotencyKey,
          requestId: mutation.id,
        }),
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
    createOrder,
    listQueuedCustomerAccounts,
    listQueuedCustomerProfiles,
    payOrder,
    pendingCount,
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
      ? `上游离线数据同步失败：${dependency.lastError}`
      : "上游离线数据尚未正确同步，请先处理同步队列后再继续。",
  );
}

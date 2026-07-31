"use client";

import {
  ApiNetworkError,
  ApiTimeoutError,
  type ChangePosOrderStatusRequest,
  type ChangeServiceTicketStatusRequest,
  type CreatePosAccountRequest,
  type CreatePosOrderRequest,
} from "@cleanhub/api-client";
import type { EnqueueInput } from "@cleanhub/offline";
import { useCallback } from "react";

import { posApi } from "@/lib/api-client";
import { isPosTerminalSessionInvalidated } from "@/lib/pos-terminal-session";

import { useOfflineSync } from "../components/offline-sync-provider";
import {
  createCustomerAccountOfflineMutation,
  createOrderOfflineMutation,
  createOrderStatusOfflineMutation,
  createTicketStatusOfflineMutation,
  type PosOfflineCustomerAccountResult,
  type PosOfflineMutation,
  type PosOfflineOrderResult,
  type PosOfflineOrderStatusResult,
  type PosOfflinePayload,
  type PosOfflineTicketStatusResult,
} from "./pos-offline-operations";

export function usePosOfflineWrites() {
  const { queue, refresh } = useOfflineSync();

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
      const mutation = createOrderOfflineMutation(input);
      return execute(mutation, () =>
        posApi.pos.orders.create(mutation.payload.input, {
          idempotencyKey: mutation.idempotencyKey,
          requestId: mutation.id,
        }),
      );
    },
    [execute],
  );

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
    createOrder,
    changeOrderStatus,
    changeTicketStatus,
  };
}

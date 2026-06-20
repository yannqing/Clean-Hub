/**
 * POS notifications — service layer (Scaffold).
 */
import type {
  MarkAllPosNotificationsReadInput,
  MarkPosNotificationReadInput,
  PosNotification,
  PosNotificationListInput,
} from "./notifications.types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";

export async function listPosNotifications(
  _input: PosNotificationListInput,
): Promise<PosNotification[]> {
  throw new PosNotImplementedError("listPosNotifications");
}

export async function markPosNotificationRead(
  _input: MarkPosNotificationReadInput,
): Promise<PosNotification> {
  throw new PosNotImplementedError("markPosNotificationRead");
}

export async function markAllPosNotificationsRead(
  _input: MarkAllPosNotificationsReadInput,
): Promise<{ updated: number }> {
  throw new PosNotImplementedError("markAllPosNotificationsRead");
}

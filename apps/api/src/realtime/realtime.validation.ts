import { z } from "zod";

import { POS_REALTIME_PROTOCOL_VERSION } from "@cleanhub/domain/pos-terminal-status";

const protocolVersionSchema = z.literal(POS_REALTIME_PROTOCOL_VERSION);
const sequenceSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const isoDateTimeSchema = z.iso.datetime({ offset: true });

const statusReportSchema = z
  .object({
    type: z.literal("terminal.status.report"),
    protocolVersion: protocolVersionSchema,
    sequence: sequenceSchema,
    clientTime: isoDateTimeSchema,
    syncState: z.enum(["never", "idle", "pending", "syncing", "error"]),
    pendingSalesCount: z.number().int().min(0).max(1_000_000),
    pendingOperationsCount: z.number().int().min(0).max(10_000_000),
    oldestPendingAt: isoDateTimeSchema.nullable(),
    lastSyncErrorCode: z.string().trim().max(128).nullable(),
    lastSyncErrorMessage: z.string().trim().max(2_000).nullable(),
    appVisibility: z.enum(["foreground", "background", "unknown"]),
  })
  .strict();

const pingSchema = z
  .object({
    type: z.literal("terminal.ping"),
    protocolVersion: protocolVersionSchema,
    sequence: sequenceSchema,
    clientTime: isoDateTimeSchema,
  })
  .strict();

export const posRealtimeClientMessageSchema = z.discriminatedUnion("type", [
  statusReportSchema,
  pingSchema,
]);

export const tenantRealtimePingSchema = z
  .object({
    type: z.literal("tenant.ping"),
    protocolVersion: protocolVersionSchema,
    sequence: sequenceSchema,
    clientTime: isoDateTimeSchema,
  })
  .strict();

export class RealtimeMessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealtimeMessageValidationError";
  }
}

export function parseRealtimeJsonMessage(value: unknown): unknown {
  if (typeof value !== "string") {
    throw new RealtimeMessageValidationError(
      "Realtime messages must be UTF-8 JSON text.",
    );
  }

  if (Buffer.byteLength(value, "utf8") > 16_384) {
    throw new RealtimeMessageValidationError(
      "Realtime message exceeds the 16 KB limit.",
    );
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new RealtimeMessageValidationError(
      "Realtime message must contain valid JSON.",
    );
  }
}

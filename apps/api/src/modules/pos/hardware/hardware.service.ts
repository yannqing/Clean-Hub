import { auditLogs, getDb, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, eq } from "drizzle-orm";

import type { AuthContext } from "../../auth/auth.types.js";
import { AuthError } from "../../auth/auth.errors.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosRole,
  requirePosTenantId,
} from "../access-control.helper.js";
import { PosHardwareError } from "./hardware.errors.js";
import {
  clearDefaultPosPrinterBindings,
  findActiveHardwareDeviceForTerminal,
  findHardwareDevicesByTerminal,
  findPaidCashPaymentForBranch,
  updatePosPrinterBindingRecord,
  upsertBuiltInHardwareDeviceRecord,
} from "./hardware.repository.js";
import type {
  AuthorizeManualDrawerOpenRequest,
  AuthorizePosHardwareActionInput,
  AuthorizePrivilegedReprintRequest,
  BindPosPrinterInput,
  ConnectPosBuiltInHardwareInput,
  PosHardwareAction,
  PosHardwareActionAuthorization,
  PosHardwareDeviceSummary,
  PosCashPaymentDrawerAuditResult,
  PosPrintJobAuditResult,
  RecordCashPaymentDrawerResultRequest,
  RecordPosPrintJobResultRequest,
} from "./hardware.types.js";

/**
 * List peripherals for the enrolled POS terminal in the current session.
 * Any POS role (owner/manager/cashier) can read the device list.
 */
export async function listPosHardwareDevices(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosHardwareDeviceSummary[]> {
  const terminal = requireHardwareTerminal(authContext);
  return findHardwareDevicesByTerminal(
    db,
    terminal.tenantId,
    terminal.terminalId,
  );
}

/**
 * Persist a built-in peripheral only after the native POS host has confirmed
 * that it is available. Repeated connections revive/update the same immutable
 * terminal-scoped record instead of creating duplicates.
 */
export async function connectPosBuiltInHardware(
  input: ConnectPosBuiltInHardwareInput,
  db: Database = getDb(),
): Promise<PosHardwareDeviceSummary> {
  requirePosRole(input.authContext, ["owner", "manager"]);
  const terminal = requireHardwareTerminal(input.authContext);
  const connectedAt = new Date().toISOString();

  return db.transaction(async (tx) => {
    const terminalDevices = await findHardwareDevicesByTerminal(
      tx,
      terminal.tenantId,
      terminal.terminalId,
    );
    const existingBuiltIn = terminalDevices.find(
      (device) => device.hardwareKey === input.data.hardwareKey,
    );
    const hasOtherDefaultReceiptPrinter = terminalDevices.some(
      (device) =>
        device.id !== existingBuiltIn?.id &&
        device.deviceType === "printer" &&
        device.config.printerPurpose !== "label" &&
        device.config.printerIsDefault === true,
    );
    const hardware = await upsertBuiltInHardwareDeviceRecord(tx, {
      tenantId: terminal.tenantId,
      terminalId: terminal.terminalId,
      hardwareKey: input.data.hardwareKey,
      name: input.data.name,
      deviceType: input.data.deviceType,
      config: {
        ...(input.data.deviceModel
          ? { deviceModel: input.data.deviceModel }
          : {}),
        ...(input.data.deviceType === "printer"
          ? {
              printerId: input.data.localDeviceId,
              printerName: input.data.name,
              printerIsDefault:
                existingBuiltIn?.config.printerIsDefault === true ||
                !hasOtherDefaultReceiptPrinter,
              printerPurpose: "receipt",
            }
          : { scannerId: input.data.localDeviceId }),
        builtIn: true,
        hardwareKey: input.data.hardwareKey,
        connectedAt,
        connectionSource: "pos_native_discovery",
      },
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      eventCategory: "pos_hardware",
      eventType: "pos_hardware.built_in.connected",
      entityType: "hardware_config",
      entityId: hardware.id,
      after: {
        hardwareKey: hardware.hardwareKey,
        deviceType: hardware.deviceType,
        terminalId: hardware.terminalId,
        provisioningMode: hardware.provisioningMode,
        connectedAt,
      },
      metadata: createPosAuditMetadata(input.authContext, {
        hardwareKey: input.data.hardwareKey,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return hardware;
  });
}

/**
 * Bind the admin-created logical printer to a printer exposed by this POS
 * terminal's operating system. The tenant and terminal identifiers are always
 * derived from the HttpOnly terminal session, never from the request body.
 */
export async function bindPosPrinter(
  input: BindPosPrinterInput,
  db: Database = getDb(),
): Promise<PosHardwareDeviceSummary> {
  requirePosRole(input.authContext, ["owner", "manager"]);
  const terminal = requireHardwareTerminal(input.authContext);

  return db.transaction(async (tx) => {
    const existing = await findActiveHardwareDeviceForTerminal(tx, {
      tenantId: terminal.tenantId,
      terminalId: terminal.terminalId,
      hardwareId: input.hardwareId,
    });
    if (!existing) {
      throw new PosHardwareError(
        "POS_HARDWARE_NOT_FOUND",
        "The active hardware device was not found for this POS terminal.",
        404,
      );
    }
    if (existing.deviceType !== "printer") {
      throw new PosHardwareError(
        "POS_HARDWARE_NOT_PRINTER",
        "Only printer hardware can be bound to an operating-system printer.",
        422,
      );
    }
    if (existing.version !== input.data.version) {
      throw new PosHardwareError(
        "POS_HARDWARE_VERSION_CONFLICT",
        "Printer configuration was modified. Refresh and try again.",
        409,
      );
    }
    const terminalDevices = await findHardwareDevicesByTerminal(
      tx,
      terminal.tenantId,
      terminal.terminalId,
    );
    const conflictingBinding = terminalDevices.find(
      (device) =>
        device.id !== existing.id &&
        device.deviceType === "printer" &&
        device.config.printerId === input.data.printerId,
    );
    if (conflictingBinding) {
      throw new PosHardwareError(
        "POS_HARDWARE_PRINTER_ALREADY_BOUND",
        "This physical printer is already assigned to another print purpose on this terminal.",
        409,
      );
    }

    const boundAt = new Date().toISOString();
    const printerPurpose =
      existing.config.printerPurpose === "label" ? "label" : "receipt";
    const existingDefaultForPurpose = terminalDevices.some(
      (device) =>
        device.id !== existing.id &&
        device.deviceType === "printer" &&
        (device.config.printerPurpose === "label" ? "label" : "receipt") ===
          printerPurpose &&
        device.config.printerIsDefault === true,
    );
    if (input.data.isDefault === true && existingDefaultForPurpose) {
      await clearDefaultPosPrinterBindings(tx, {
        tenantId: terminal.tenantId,
        terminalId: terminal.terminalId,
        hardwareId: existing.id,
        printerPurpose,
        actorUserId: input.authContext.userId,
      });
    }
    const updated = await updatePosPrinterBindingRecord(tx, {
      tenantId: terminal.tenantId,
      terminalId: terminal.terminalId,
      hardwareId: existing.id,
      actorUserId: input.authContext.userId,
      version: input.data.version,
      config: {
        ...existing.config,
        printerId: input.data.printerId,
        printerName: input.data.printerName,
        printerIsDefault: input.data.isDefault ?? false,
        printerBoundAt: boundAt,
        printerBindingSource: "pos_terminal",
      },
    });
    if (!updated) {
      throw new PosHardwareError(
        "POS_HARDWARE_VERSION_CONFLICT",
        "Printer configuration was modified. Refresh and try again.",
        409,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      eventCategory: "pos_hardware",
      eventType: "pos_hardware.printer.bound",
      entityType: "hardware_config",
      entityId: existing.id,
      before: {
        printerId: existing.config.printerId,
        printerName: existing.config.printerName,
        version: existing.version,
      },
      after: {
        printerId: input.data.printerId,
        printerName: input.data.printerName,
        isDefault: input.data.isDefault ?? false,
        boundAt,
        version: updated.version,
      },
      metadata: createPosAuditMetadata(input.authContext, {
        hardwareId: existing.id,
      }),
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return updated;
  });
}

function requireHardwareTerminal(authContext: AuthContext): {
  tenantId: string;
  branchId: string;
  terminalId: string;
} {
  const tenantId = requirePosTenantId(authContext);
  if (!authContext.terminalId || !authContext.terminalBranchId) {
    throw new AuthError(
      "FORBIDDEN",
      "An enrolled POS terminal session is required for hardware actions.",
    );
  }
  requirePosBranchAccess(authContext, authContext.terminalBranchId);
  return {
    tenantId,
    branchId: authContext.terminalBranchId,
    terminalId: authContext.terminalId,
  };
}

async function authorizeHardwareAction(
  input: {
    authContext: AuthContext;
    requestMeta?: AuthorizePosHardwareActionInput<unknown>["requestMeta"];
    action: PosHardwareAction;
    reason: string;
    metadata?: Record<string, unknown>;
  },
  db: Database,
): Promise<PosHardwareActionAuthorization> {
  const reason = authorizePosSensitiveOperation(
    input.authContext,
    input.action,
    input.reason,
  );
  const terminal = requireHardwareTerminal(input.authContext);
  const authorization: PosHardwareActionAuthorization = {
    authorizationId: createId(),
    action: input.action,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    terminalId: terminal.terminalId,
    actorUserId: input.authContext.userId,
    reason,
    authorizedAt: new Date().toISOString(),
  };

  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    eventCategory: "pos_hardware",
    eventType: `pos_hardware.${input.action}.authorized`,
    entityType: "pos_terminal_settings",
    entityId: terminal.terminalId,
    reason,
    after: { ...authorization },
    metadata: createPosAuditMetadata(input.authContext, {
      authorizationId: authorization.authorizationId,
      action: input.action,
      ...input.metadata,
    }),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return authorization;
}

export async function authorizeManualDrawerOpen(
  input: AuthorizePosHardwareActionInput<AuthorizeManualDrawerOpenRequest>,
  db: Database = getDb(),
): Promise<PosHardwareActionAuthorization> {
  return authorizeHardwareAction(
    {
      ...input,
      action: "manual_drawer_open",
      reason: input.data.reason,
    },
    db,
  );
}

export async function authorizePrivilegedReprint(
  input: AuthorizePosHardwareActionInput<AuthorizePrivilegedReprintRequest>,
  db: Database = getDb(),
): Promise<PosHardwareActionAuthorization> {
  return authorizeHardwareAction(
    {
      ...input,
      action: "privileged_reprint",
      reason: input.data.reason,
      metadata: {
        documentType: input.data.documentType,
        entityId: input.data.entityId,
        originalPrintJobId: input.data.originalPrintJobId,
      },
    },
    db,
  );
}

export async function recordPosPrintJobResult(
  input: AuthorizePosHardwareActionInput<RecordPosPrintJobResultRequest>,
  db: Database = getDb(),
): Promise<PosPrintJobAuditResult> {
  const terminal = requireHardwareTerminal(input.authContext);
  const eventType = `pos_hardware.print_job.${input.data.status}`;
  const existingEvents = await db
    .select({
      eventType: auditLogs.eventType,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, terminal.tenantId),
        eq(auditLogs.branchId, terminal.branchId),
        eq(auditLogs.entityType, "pos_print_job"),
        eq(auditLogs.entityId, input.data.jobId),
      ),
    );
  const alreadyRecorded = existingEvents.some(
    (event) =>
      event.eventType === eventType &&
      event.metadata?.attempt === input.data.attempt,
  );

  if (alreadyRecorded) {
    return {
      jobId: input.data.jobId,
      status: input.data.status,
      attempt: input.data.attempt,
      recorded: false,
      idempotent: true,
    };
  }

  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    eventCategory: "pos_hardware",
    eventType,
    entityType: "pos_print_job",
    entityId: input.data.jobId,
    success: input.data.status === "printed",
    after: {
      jobId: input.data.jobId,
      documentType: input.data.documentType,
      documentEntityId: input.data.entityId,
      status: input.data.status,
      attempt: input.data.attempt,
      authorizationId: input.data.authorizationId,
      originalPrintJobId: input.data.originalPrintJobId,
    },
    metadata: createPosAuditMetadata(input.authContext, {
      jobId: input.data.jobId,
      documentType: input.data.documentType,
      documentEntityId: input.data.entityId,
      attempt: input.data.attempt,
      error: input.data.error,
      authorizationId: input.data.authorizationId,
      originalPrintJobId: input.data.originalPrintJobId,
    }),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return {
    jobId: input.data.jobId,
    status: input.data.status,
    attempt: input.data.attempt,
    recorded: true,
    idempotent: false,
  };
}

export async function recordCashPaymentDrawerResult(
  input: AuthorizePosHardwareActionInput<RecordCashPaymentDrawerResultRequest>,
  db: Database = getDb(),
): Promise<PosCashPaymentDrawerAuditResult> {
  const terminal = requireHardwareTerminal(input.authContext);
  const payment = await findPaidCashPaymentForBranch(db, {
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    paymentId: input.data.paymentId,
  });

  if (!payment) {
    throw new AuthError(
      "FORBIDDEN",
      "Cash-drawer results must reference a paid cash payment from the current branch.",
    );
  }

  const eventType = `pos_hardware.cash_payment_drawer.${input.data.status}`;
  const existingEvents = await db
    .select({
      eventType: auditLogs.eventType,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, terminal.tenantId),
        eq(auditLogs.branchId, terminal.branchId),
        eq(auditLogs.entityType, "payment_transaction"),
        eq(auditLogs.entityId, payment.id),
      ),
    );
  const alreadyRecorded = existingEvents.some(
    (event) =>
      event.eventType === eventType &&
      event.metadata?.attempt === input.data.attempt &&
      event.metadata?.terminalId === terminal.terminalId,
  );

  if (alreadyRecorded) {
    return {
      paymentId: payment.id,
      status: input.data.status,
      attempt: input.data.attempt,
      recorded: false,
      idempotent: true,
    };
  }

  await writeAuditLog(db, {
    actorUserId: input.authContext.userId,
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    eventCategory: "pos_hardware",
    eventType,
    entityType: "payment_transaction",
    entityId: payment.id,
    success: input.data.status === "opened",
    after: {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: input.data.status,
      attempt: input.data.attempt,
      printerId: input.data.printerId,
    },
    metadata: createPosAuditMetadata(input.authContext, {
      paymentId: payment.id,
      orderId: payment.orderId,
      attempt: input.data.attempt,
      printerId: input.data.printerId,
      error: input.data.error,
    }),
    ipAddress: input.requestMeta?.ipAddress,
    userAgent: input.requestMeta?.userAgent,
  });

  return {
    paymentId: payment.id,
    status: input.data.status,
    attempt: input.data.attempt,
    recorded: true,
    idempotent: false,
  };
}

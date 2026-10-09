import type {
  PosBootstrapTenantRecord,
  PosBootstrapTerminalRecord,
} from "./auth.repository.js";
import type { AuthContext, PosBootstrapState } from "./auth.types.js";

type ResolvePosBootstrapStateInput = {
  deviceId: string;
  authContext: AuthContext | null;
  credentialPresented: boolean;
  credentialTerminal: PosBootstrapTerminalRecord | null;
  adminTerminal: PosBootstrapTerminalRecord | null;
  adminTenant: PosBootstrapTenantRecord | null;
};

function isSetupAdmin(
  authContext: AuthContext | null,
): authContext is AuthContext & {
  tenantId: string;
  role: "owner" | "manager";
} {
  return Boolean(
    authContext?.tenantId &&
    !authContext.terminalId &&
    (authContext.role === "owner" || authContext.role === "manager"),
  );
}

function isDisabled(record: PosBootstrapTerminalRecord): boolean {
  return (
    record.status !== "active" ||
    record.tenantStatus !== "active" ||
    record.tenantDeleted ||
    record.branchStatus !== "active" ||
    record.branchDeleted
  );
}

function canReenrollRevokedCredential(
  record: PosBootstrapTerminalRecord,
): boolean {
  return (
    !record.credentialDigest &&
    record.tenantStatus === "active" &&
    !record.tenantDeleted &&
    record.branchStatus === "active" &&
    !record.branchDeleted
  );
}

function resources(record: PosBootstrapTerminalRecord) {
  return {
    terminal: {
      id: record.id,
      label: record.label,
      status: record.status,
      branchId: record.branchId,
    },
    tenant: {
      id: record.tenantId,
      name: record.tenantName,
      code: record.tenantCode,
    },
    branch: {
      id: record.branchId,
      name: record.branchName,
    },
  };
}

function emptyResources() {
  return {
    terminal: null,
    tenant: null,
    branch: null,
  };
}

export function resolvePosBootstrapState(
  input: ResolvePosBootstrapStateInput,
): PosBootstrapState {
  const setupContext = isSetupAdmin(input.authContext)
    ? input.authContext
    : null;
  const setupAdmin = Boolean(setupContext);
  const credentialTerminal =
    input.credentialTerminal &&
    (!input.authContext ||
      input.credentialTerminal.tenantId === input.authContext.tenantId)
      ? input.credentialTerminal
      : null;

  if (credentialTerminal) {
    if (isDisabled(credentialTerminal)) {
      return {
        status: "disabled",
        deviceId: input.deviceId,
        requiresAdminLogin: !setupAdmin,
        canEnroll: setupAdmin,
        ...resources(credentialTerminal),
      };
    }

    return {
      status: input.authContext ? "enrolled" : "ready_for_pin",
      deviceId: input.deviceId,
      requiresAdminLogin: false,
      canEnroll: false,
      ...resources(credentialTerminal),
    };
  }

  if (setupAdmin) {
    if (input.adminTerminal) {
      return {
        status:
          isDisabled(input.adminTerminal) &&
          !canReenrollRevokedCredential(input.adminTerminal)
            ? "disabled"
            : "credential_lost",
        deviceId: input.deviceId,
        requiresAdminLogin: false,
        canEnroll: true,
        ...resources(input.adminTerminal),
      };
    }

    return {
      status: "admin_setup_required",
      deviceId: input.deviceId,
      requiresAdminLogin: false,
      canEnroll: true,
      terminal: null,
      tenant: input.adminTenant
        ? {
            id: input.adminTenant.id,
            name: input.adminTenant.name,
            code: input.adminTenant.code,
          }
        : null,
      branch: null,
    };
  }

  return {
    status: input.credentialPresented ? "credential_lost" : "unconfigured",
    deviceId: input.deviceId,
    requiresAdminLogin: true,
    canEnroll: false,
    ...emptyResources(),
  };
}

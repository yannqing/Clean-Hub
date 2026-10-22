"use client";

import type { PosBootstrapResponse } from "@cleanhub/api-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { posRoutes } from "@/config/routes";
import { getOrCreatePosDeviceId } from "@/features/auth/utils/device-id";

import { fetchTerminalBootstrap } from "../api";
import { TerminalStatusPanel } from "./terminal-status-panel";

type BootstrapViewState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "disabled"; data: PosBootstrapResponse }
  | { kind: "setup"; data: PosBootstrapResponse }
  | { kind: "ready"; data: PosBootstrapResponse };

type TerminalPinLoginGateProps = {
  children: (bootstrap: PosBootstrapResponse) => React.ReactNode;
};

function isSetupStatus(status: PosBootstrapResponse["status"]): boolean {
  return (
    status === "unconfigured" ||
    status === "admin_setup_required" ||
    status === "credential_lost"
  );
}

export function TerminalPinLoginGate({
  children,
}: TerminalPinLoginGateProps) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [viewState, setViewState] = useState<BootstrapViewState>({
    kind: "loading",
  });

  const checkTerminal = useCallback(async () => {
    setViewState({ kind: "loading" });

    try {
      const deviceId = await getOrCreatePosDeviceId();
      const bootstrap = await fetchTerminalBootstrap(deviceId);
      if (!mountedRef.current) return;

      if (bootstrap.status === "disabled") {
        setViewState({ kind: "disabled", data: bootstrap });
        return;
      }

      if (isSetupStatus(bootstrap.status)) {
        setViewState({ kind: "setup", data: bootstrap });
        const query =
          bootstrap.status === "credential_lost"
            ? "?reason=credential-lost"
            : "";
        router.replace(`${posRoutes.setup}${query}`);
        return;
      }

      setViewState({ kind: "ready", data: bootstrap });
    } catch {
      if (mountedRef.current) {
        setViewState({ kind: "error" });
      }
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void checkTerminal();
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [checkTerminal]);

  if (viewState.kind === "loading") {
    return <TerminalStatusPanel kind="loading" />;
  }

  if (viewState.kind === "error") {
    return (
      <TerminalStatusPanel kind="error" onRetry={() => void checkTerminal()} />
    );
  }

  if (viewState.kind === "disabled") {
    return <TerminalStatusPanel kind="disabled" />;
  }

  if (viewState.kind === "setup") {
    return (
      <TerminalStatusPanel
        kind="setup"
        recovery={viewState.data.status === "credential_lost"}
      />
    );
  }

  return children(viewState.data);
}

"use client";

import { resolveTimeZone } from "@cleanhub/domain/timezone";
import { createContext, useContext, useMemo } from "react";

const TenantTimeZoneContext = createContext("UTC");

export function TenantTimeZoneProvider({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone?: string | null;
}) {
  const value = useMemo(() => resolveTimeZone(timeZone), [timeZone]);

  return (
    <TenantTimeZoneContext.Provider value={value}>
      {children}
    </TenantTimeZoneContext.Provider>
  );
}

export function useTenantTimeZone(): string {
  return useContext(TenantTimeZoneContext);
}

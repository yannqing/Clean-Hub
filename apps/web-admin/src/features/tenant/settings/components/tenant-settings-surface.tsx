import type { ReactNode } from "react";

export function TenantSettingsSurface({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

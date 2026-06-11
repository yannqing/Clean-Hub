import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CleanHub POS",
  description: "CleanHub point-of-sale interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="bg-background text-foreground">
        <div className="flex h-screen w-screen flex-col overflow-hidden">
          <PosTopBar />
          <div className="flex flex-1 overflow-hidden">
            <PosNavSidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

function PosTopBar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide">CleanHub POS</span>
        <BranchSelectorPlaceholder />
      </div>

      <div className="flex items-center gap-2">
        <HardwareButton label="打印" icon="[P]" />
        <HardwareButton label="扫码" icon="[S]" />
        <HardwareButton label="客显" icon="[D]" />
        <PosClockDisplay />
      </div>
    </header>
  );
}

function BranchSelectorPlaceholder() {
  return (
    <button
      disabled
      className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground opacity-60"
      title="门店切换（待实现）"
    >
      <span>选择门店</span>
      <span>▾</span>
    </button>
  );
}

function HardwareButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      disabled
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-50 hover:bg-muted disabled:cursor-not-allowed"
      title={`${label}（P-07 硬件占位，待接入）`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function PosClockDisplay() {
  return (
    <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
      --:--
    </span>
  );
}

function PosNavSidebar() {
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-card py-3">
      <NavItem label="收银" icon="[$]" active />
      <NavItem label="订单" icon="[O]" />
      <NavItem label="服务" icon="[V]" />
      <NavItem label="设置" icon="[G]" />
    </nav>
  );
}

function NavItem({
  label,
  icon,
  active = false,
}: {
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <button
      disabled
      className={[
        "flex w-full flex-col items-center gap-0.5 py-2 text-center text-xs disabled:cursor-not-allowed",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

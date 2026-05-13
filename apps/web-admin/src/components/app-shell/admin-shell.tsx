type AdminShellProps = {
  children: React.ReactNode;
  scope: "auth" | "saas" | "tenant";
};

export function AdminShell({ children, scope }: AdminShellProps) {
  return (
    <div data-admin-scope={scope} className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}

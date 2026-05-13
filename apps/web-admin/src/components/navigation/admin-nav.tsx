import { webAdminNavigation } from "@/config/navigation";

type AdminNavProps = {
  scope: "saas" | "tenant";
};

export function AdminNav({ scope }: AdminNavProps) {
  const items = webAdminNavigation[scope];

  return (
    <nav aria-label={`${scope} navigation`} className="border-b bg-white px-8 py-3">
      <ul className="flex flex-wrap gap-4 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item.href}>
            <a className="hover:text-slate-950" href={item.href}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

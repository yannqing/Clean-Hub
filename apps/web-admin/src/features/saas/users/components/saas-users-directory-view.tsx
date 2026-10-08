"use client";

import { Button } from "@cleanhub/ui";
import { useState } from "react";

import { useSaasI18n } from "@/i18n";

import { SaasUserListView } from "./saas-user-list-view";
import { SaasTenantAdminListView } from "./saas-tenant-admin-list-view";

type DirectoryScope = "platform" | "tenant-admins";

export function SaasUsersDirectoryView() {
  const { m } = useSaasI18n();
  const [scope, setScope] = useState<DirectoryScope>("platform");

  return (
    <div className="space-y-5">
      <div
        aria-label={m.users.directoryLabel}
        className="flex flex-wrap gap-2 border-b pb-3"
        role="group"
      >
        <Button
          aria-pressed={scope === "platform"}
          onClick={() => setScope("platform")}
          size="sm"
          type="button"
          variant={scope === "platform" ? "default" : "outline"}
        >
          {m.users.platformTab}
        </Button>
        <Button
          aria-pressed={scope === "tenant-admins"}
          onClick={() => setScope("tenant-admins")}
          size="sm"
          type="button"
          variant={scope === "tenant-admins" ? "default" : "outline"}
        >
          {m.users.tenantAdminsTab}
        </Button>
      </div>
      {scope === "platform" ? (
        <div>
          <SaasUserListView />
        </div>
      ) : (
        <div>
          <SaasTenantAdminListView />
        </div>
      )}
    </div>
  );
}

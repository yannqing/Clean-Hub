"use client";

import { PagePlaceholder } from "@/components/app-shell";
import { webAdminApi } from "@/lib";
import { useEffect } from "react";

export default function SaasHomePage() {
  useEffect(() => {
    async function loadUser() {
      try {
        const user = await webAdminApi.saas.users.test();
        console.log(user);
      } catch (error) {
        console.error(error);
      }
    }

    loadUser();
  }, []);

  return (
    <PagePlaceholder
      description="Platform-level administration for tenants, SaaS users, audit logs, and global configuration."
      items={["Tenant lifecycle", "SaaS users", "Audit logs", "Platform settings"]}
      title="SaaS Admin"
    />
  );
}

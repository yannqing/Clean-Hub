import assert from "node:assert/strict";

import {
  canSaasRoleAccessHref,
  filterSidebarSections,
  isNavFeatureVisible,
} from "./feature-visibility";
import { webAdminRoutes } from "./routes";

const sections = [
  {
    title: "Main",
    items: [
      { href: webAdminRoutes.saas.home },
      { href: webAdminRoutes.saas.config.tenants },
      { href: webAdminRoutes.saas.users },
      { href: webAdminRoutes.saas.feedbackTickets },
      { href: webAdminRoutes.saas.todos },
    ],
  },
  {
    title: "System Settings",
    items: [
      { href: webAdminRoutes.saas.auditLogs },
      { href: webAdminRoutes.saas.system.logs },
      { href: webAdminRoutes.saas.system.backups },
      { href: webAdminRoutes.saas.system.security },
      { href: webAdminRoutes.saas.config.platformSettings },
    ],
  },
] as const;

function hrefsFor(role: Parameters<typeof filterSidebarSections>[1]): string[] {
  return filterSidebarSections(sections, role).flatMap((section) =>
    section.items.map((item) => item.href),
  );
}

// The API restricts these to super_admin; the sidebar must agree, or a support
// user is invited to fill in a form the backend will reject on submit.
for (const href of [
  webAdminRoutes.saas.config.tenants,
  webAdminRoutes.saas.users,
  webAdminRoutes.saas.config.platformSettings,
]) {
  assert.equal(
    canSaasRoleAccessHref("super_admin", href),
    true,
    `super_admin must reach ${href}`,
  );
  assert.equal(
    canSaasRoleAccessHref("support", href),
    false,
    `support must not be offered ${href}`,
  );
}

// Support staff genuinely work these queues; hiding them would break the role.
for (const href of [
  webAdminRoutes.saas.home,
  webAdminRoutes.saas.feedbackTickets,
  webAdminRoutes.saas.todos,
  webAdminRoutes.saas.auditLogs,
  webAdminRoutes.saas.system.logs,
  webAdminRoutes.saas.system.security,
]) {
  assert.equal(
    canSaasRoleAccessHref("support", href),
    true,
    `support must keep access to ${href}`,
  );
}

const supportHrefs = hrefsFor("support");
assert.ok(
  !supportHrefs.includes(webAdminRoutes.saas.users),
  "support sidebar must not list user management",
);
assert.ok(
  supportHrefs.includes(webAdminRoutes.saas.feedbackTickets),
  "support sidebar must still list feedback tickets",
);

const superAdminHrefs = hrefsFor("super_admin");
assert.ok(
  superAdminHrefs.includes(webAdminRoutes.saas.users),
  "super_admin sidebar must list user management",
);

// An unknown or not-yet-loaded session must not leak privileged links.
assert.ok(
  !hrefsFor(null).includes(webAdminRoutes.saas.config.platformSettings),
  "an unresolved role must be treated as unprivileged",
);

// Feature flags still win over role: an unfinished page stays hidden for
// everyone, including super_admin.
assert.equal(isNavFeatureVisible("backups"), false);
assert.ok(
  !superAdminHrefs.includes(webAdminRoutes.saas.system.backups),
  "a disabled feature stays hidden even for super_admin",
);

console.log("web-admin nav visibility smoke passed.");

// DEPRECATED: This module is being phased out. Active replacements:
//   - Tenant staff management  → modules/tenant-users
//   - SaaS platform users      → modules/saas-users
//   - Tenant owner provisioning → modules/tenant-users/tenant-users.helper.ts
// The exports below remain only for backward compatibility during the transition.
export * from "./users.errors.js";
export * from "./users.routes.js";
export * from "./users.types.js";
export { createTenantOwnerUser } from "./users.service.js";

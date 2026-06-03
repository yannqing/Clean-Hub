const AUDIT_EVENT_DESCRIPTIONS: Record<string, string> = {
  "auth.login.success": "User signed in",
  "auth.login.failed": "User sign-in failed",
  "auth.logout": "User signed out",
  "auth.refresh.reuse_detected": "Refresh token reuse detected",
  "tenant.created": "Tenant created",
  "tenant.updated": "Tenant updated",
  "tenant.status_updated": "Tenant status updated",
  "tenant_settings.updated": "Tenant settings updated",
  "tenant_feature_flags.updated": "Tenant feature flags updated",
  "saas_user.created": "SaaS user created",
  "saas_user.updated": "SaaS user updated",
  "saas_user.roles_updated": "SaaS user roles updated",
  "saas_user.status_updated": "SaaS user status updated",
  "tenant_user.created": "Tenant user created",
  "tenant_user.updated": "Tenant user updated",
  "tenant_user.disabled": "Tenant user disabled",
  "tenant_user.pin_reset": "Tenant user PIN reset",
  "tenant_user.owner_created": "Tenant owner created",
  "branch.created": "Branch created",
  "branch.updated": "Branch updated",
  "branch.status_changed": "Branch status changed",
  "service.created": "Service created",
  "service.updated": "Service updated",
  "service.status_changed": "Service status changed",
  "service.deleted": "Service deleted",
  "price.created": "Price created",
  "price.updated": "Price updated",
  "price.deleted": "Price deleted",
  "settings.updated": "Settings updated",
  "notification_settings.updated": "Notification settings updated",
  "tenant_hardware.created": "Hardware configuration created",
  "tenant_hardware.updated": "Hardware configuration updated",
  "backup_job.created": "Backup job created",
  "restore_request.created": "Restore request created",
  "feedback_ticket.status_updated": "Feedback ticket status updated",
  "feedback_ticket.assignee_updated": "Feedback ticket assignee updated",
  "platform_settings.updated": "Platform settings updated",
  "security_settings.updated": "Security settings updated",
  "security.settings.updated": "Security settings updated",
};

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getAuditEventDescription(eventType: string): string {
  if (AUDIT_EVENT_DESCRIPTIONS[eventType]) {
    return AUDIT_EVENT_DESCRIPTIONS[eventType];
  }

  return toTitleCase(eventType.replace(/[._]/g, " "));
}

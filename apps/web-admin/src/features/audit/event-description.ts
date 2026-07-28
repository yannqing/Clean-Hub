/**
 * Audit event dictionary.
 *
 * Events are grouped by their backend `eventCategory` so the audit log filters
 * can render a cascading "category → eventType" dropdown instead of asking
 * operators to type exact strings like `service.updated` from memory.
 *
 * The category keys here mirror the values emitted by `apps/api`:
 * - SaaS side: `auth`, `saas_platform`, `saas_tenant`, `saas_user`
 * - Tenant side: `tenant_branch`, `tenant_user`, `tenant_service`,
 *   `tenant_price`, `tenant_hardware`, `tenant_notification`,
 *   `tenant_settings`, `tenant_backup`
 *
 * Each entry keeps its human-readable description so the list and detail views
 * can surface a friendly label next to the raw `eventType` code.
 */

export const AUDIT_EVENT_DICTIONARY = {
  auth: {
    "auth.login.success": "User signed in",
    "auth.login.failed": "User sign-in failed",
    "auth.logout": "User signed out",
    "auth.refresh.reuse_detected": "Refresh token reuse detected",
  },
  saas_platform: {
    "platform_settings.updated": "Platform settings updated",
    "security_settings.updated": "Security settings updated",
    "security.settings.updated": "Security settings updated",
    "backup_job.created": "Backup job created",
    "restore_request.created": "Restore request created",
    "feedback_ticket.status_updated": "Feedback ticket status updated",
    "feedback_ticket.assignee_updated": "Feedback ticket assignee updated",
  },
  saas_tenant: {
    "tenant.created": "Tenant created",
    "tenant.updated": "Tenant updated",
    "tenant.status_updated": "Tenant status updated",
    "tenant_settings.updated": "Tenant settings updated",
    "tenant_feature_flags.updated": "Tenant feature flags updated",
  },
  saas_user: {
    "saas_user.created": "SaaS user created",
    "saas_user.updated": "SaaS user updated",
    "saas_user.roles_updated": "SaaS user roles updated",
    "saas_user.status_updated": "SaaS user status updated",
  },
  tenant_branch: {
    "branch.created": "Branch created",
    "branch.updated": "Branch updated",
    "branch.status_changed": "Branch status changed",
  },
  tenant_user: {
    "tenant_user.created": "Tenant user created",
    "tenant_user.updated": "Tenant user updated",
    "tenant_user.disabled": "Tenant user disabled",
    "tenant_user.pin_reset": "Tenant user PIN reset",
    "tenant_user.owner_created": "Tenant owner created",
  },
  tenant_service: {
    "service.created": "Service created",
    "service.updated": "Service updated",
    "service.status_changed": "Service status changed",
    "service.deleted": "Service deleted",
  },
  tenant_price: {
    "price.created": "Price created",
    "price.updated": "Price updated",
    "price.deleted": "Price deleted",
  },
  tenant_hardware: {
    "tenant_hardware.created": "Hardware configuration created",
    "tenant_hardware.updated": "Hardware configuration updated",
  },
  tenant_notification: {
    "notification_settings.updated": "Notification settings updated",
  },
  tenant_settings: {
    "settings.updated": "Settings updated",
  },
  tenant_backup: {},
} as const satisfies Record<string, Record<string, string>>;

export type AuditEventCategory = keyof typeof AUDIT_EVENT_DICTIONARY;

/**
 * Flat lookup kept for backward compatibility with the detail/list rows that
 * only need a description for a single `eventType` string.
 */
const AUDIT_EVENT_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.values(AUDIT_EVENT_DICTIONARY).flatMap((group) =>
    Object.entries(group),
  ),
);

const AUDIT_EVENT_DESCRIPTIONS_ZH_CN: Record<string, string> = {
  "auth.login.success": "用户登录成功",
  "auth.login.failed": "用户登录失败",
  "auth.logout": "用户已退出登录",
  "auth.refresh.reuse_detected": "检测到刷新令牌重复使用",
  "platform_settings.updated": "平台设置已更新",
  "security_settings.updated": "安全设置已更新",
  "security.settings.updated": "安全设置已更新",
  "backup_job.created": "备份任务已创建",
  "restore_request.created": "恢复请求已创建",
  "feedback_ticket.status_updated": "反馈工单状态已更新",
  "feedback_ticket.assignee_updated": "反馈工单受理人已更新",
  "tenant.created": "租户已创建",
  "tenant.updated": "租户资料已更新",
  "tenant.status_updated": "租户状态已更新",
  "tenant_settings.updated": "租户设置已更新",
  "tenant_feature_flags.updated": "租户功能开关已更新",
  "saas_user.created": "平台用户已创建",
  "saas_user.updated": "平台用户资料已更新",
  "saas_user.roles_updated": "平台用户角色已更新",
  "saas_user.status_updated": "平台用户状态已更新",
};

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getAuditEventDescription(
  eventType: string,
  locale?: string,
): string {
  if (locale === "zh-CN" && AUDIT_EVENT_DESCRIPTIONS_ZH_CN[eventType]) {
    return AUDIT_EVENT_DESCRIPTIONS_ZH_CN[eventType];
  }

  if (AUDIT_EVENT_DESCRIPTIONS[eventType]) {
    return AUDIT_EVENT_DESCRIPTIONS[eventType];
  }

  return toTitleCase(eventType.replace(/[._]/g, " "));
}

/**
 * Returns the ordered list of `eventType` codes that belong to a category.
 *
 * Pass `undefined` (or a category with no entries) to receive every known
 * `eventType` across all categories — used by the filter when no category is
 * selected yet. The result is referentially rebuilt on each call, so callers
 * should memoize when using it inside React render.
 */
export function getAuditEventTypesByCategory(
  category?: string,
  locale?: string,
): Array<{ value: string; label: string }> {
  if (category && category in AUDIT_EVENT_DICTIONARY) {
    const group = AUDIT_EVENT_DICTIONARY[
      category as AuditEventCategory
    ] as Record<string, string>;

    return Object.entries(group).map(([value, label]) => ({
      value,
      label:
        locale === "zh-CN"
          ? (AUDIT_EVENT_DESCRIPTIONS_ZH_CN[value] ?? label)
          : label,
    }));
  }

  return Object.entries(AUDIT_EVENT_DESCRIPTIONS).map(([value, label]) => ({
    value,
    label:
      locale === "zh-CN"
        ? (AUDIT_EVENT_DESCRIPTIONS_ZH_CN[value] ?? label)
        : label,
  }));
}

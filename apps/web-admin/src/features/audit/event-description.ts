import type { AuditCategoryCode, AuditEventCode } from "@/i18n/messages-types";

/**
 * Which events belong to which audit category.
 *
 * This is routing data, not copy: the filter uses it to narrow the event-type
 * dropdown once a category is picked. The wording lives in the message
 * catalogue under `common.auditEvents`, so a missing translation is a compile
 * error rather than a silent fallback to English.
 */
export const AUDIT_EVENT_DICTIONARY = {
  auth: [
    "auth.login.success",
    "auth.login.failed",
    "auth.logout",
    "auth.refresh.reuse_detected",
    "auth.pos_pin_login.success",
    "auth.pos_pin_login.failed",
  ],
  saas_platform: [
    "platform_settings.updated",
    "security_settings.updated",
    "security.settings.updated",
    "backup_job.created",
    "restore_request.created",
    "feedback_ticket.status_updated",
    "feedback_ticket.assignee_updated",
  ],
  saas_tenant: [
    "tenant.created",
    "tenant.updated",
    "tenant.status_updated",
    "tenant_settings.updated",
    "tenant_feature_flags.updated",
  ],
  saas_user: [
    "saas_user.created",
    "saas_user.updated",
    "saas_user.roles_updated",
    "saas_user.status_updated",
    "saas_user.password_reset",
    "saas_user.pin_reset",
  ],
  tenant_branch: ["branch.created", "branch.updated", "branch.status_changed"],
  tenant_user: [
    "tenant_user.created",
    "tenant_user.updated",
    "tenant_user.disabled",
    "tenant_user.pin_reset",
    "tenant_user.password_reset",
    "tenant_user.owner_created",
  ],
  tenant_service: [
    "service.created",
    "service.updated",
    "service.status_changed",
    "service.deleted",
  ],
  tenant_price: ["price.created", "price.updated", "price.deleted"],
  tenant_hardware: [
    "tenant_hardware.created",
    "tenant_hardware.updated",
    "tenant_hardware.deleted",
  ],
  tenant_notification: ["notification_settings.updated"],
  tenant_settings: ["settings.updated"],
  tenant_product: ["product.created", "product.updated"],
  tenant_customer: [
    "tenant.customer.comment_created",
    "tenant.customer.comment_updated",
  ],
  tenant_order: ["tenant.order.comment_created"],
  tenant_backup: [],
  pos_order: [
    "pos.order.created",
    "pos.order.item_added",
    "pos.order.payment_created",
    "pos.order.payment_refunded",
    "pos.order.status_changed",
  ],
  pos_service_ticket: [
    "pos.service_ticket.created",
    "pos.service_ticket.item_added",
    "pos.service_ticket.item_updated",
    "pos.service_ticket.item_status_changed",
    "pos.service_ticket.status_changed",
    "pos.service_ticket.status_synced_from_items",
  ],
  pos_customer: [
    "pos_customer.profile_created",
    "pos_customer.account_created",
    "pos_customer.account_status_changed",
    "pos_customer.account_deleted",
  ],
  pos_hardware: [
    "pos_hardware.printer.bound",
    "pos_hardware.print_job.printed",
    "pos_hardware.print_job.failed",
    "pos_hardware.built_in.connected",
    "pos_hardware.cash_payment_drawer.failed",
    "pos_hardware.privileged_reprint.authorized",
  ],
  pos_terminal_security: [
    "pos_terminal.enrolled",
    "pos_terminal.enabled",
    "pos_terminal.disabled",
    "pos_terminal.revoked",
    "pos_terminal.credential_rotated",
    "pos_terminal.credential_re_enrolled",
    "pos_terminal.rebound",
  ],
  pos_shift: [
    "pos.shift.clock_in",
    "pos.shift.break_start",
    "pos.shift.break_end",
    "pos.shift.security_forced_closed",
  ],
  pos_register: ["pos.register.opened"],
  pos_notification: ["pos.notification.read"],
  pos_channel_settings: ["pos_channel_settings.updated"],
} as const satisfies Record<AuditCategoryCode, readonly AuditEventCode[]>;

export type AuditEventCategory = keyof typeof AUDIT_EVENT_DICTIONARY;

/** Wording for every described event, from `messages.common.auditEvents`. */
export type AuditEventCopy = Record<AuditEventCode, string>;

/**
 * Event types the API emits that are deliberately left undescribed.
 *
 * Each needs a product decision about what it means to a store owner before it
 * gets wording; until then they fall through to the humanised code rather than
 * carrying a confident guess in an audit trail.
 *
 * Currently empty: the last four were described once the owner confirmed what
 * they mean. Two were written to match the code rather than the description
 * given -- `pos.shift.security_forced_closed` fires when an administrative
 * change (terminal removed or disabled, staff or tenant status changed)
 * invalidates a terminal, not on any elapsed-time rule, and
 * `pos_hardware.privileged_reprint.authorized` still records a reason-backed
 * authorisation because the POS enforces one today.
 */
export const UNDESCRIBED_AUDIT_EVENT_TYPES: ReadonlyArray<string> = [];

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Wording for one event code.
 *
 * Unknown codes -- events the API gained since this catalogue was written, and
 * the deliberately undescribed ones -- read as their humanised code, which is
 * still better than a raw `pos.order.item_added`.
 */
export function getAuditEventDescription(
  eventType: string,
  copy?: AuditEventCopy,
): string {
  const described = copy?.[eventType as AuditEventCode];
  if (described) {
    return described;
  }

  return toTitleCase(eventType.replace(/[._]/g, " "));
}

/**
 * The event-type options for a category, already worded for the reader.
 *
 * Pass `undefined` (or a category with no events) to receive every described
 * event -- used by the filter when no category is selected yet. The result is
 * rebuilt on each call, so callers should memoize it inside React render.
 */
export function getAuditEventTypesByCategory(
  category?: string,
  copy?: AuditEventCopy,
): Array<{ value: string; label: string }> {
  const codes =
    category && category in AUDIT_EVENT_DICTIONARY
      ? AUDIT_EVENT_DICTIONARY[category as AuditEventCategory]
      : Object.values(AUDIT_EVENT_DICTIONARY).flat();

  return codes.map((value) => ({
    value,
    label: getAuditEventDescription(value, copy),
  }));
}

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
  tenant_product: {
    "product.created": "Product created",
    "product.updated": "Product updated",
  },
  tenant_customer: {
    "tenant.customer.comment_created": "Comment added to customer",
    "tenant.customer.comment_updated": "Customer comment edited",
  },
  tenant_order: {
    "tenant.order.comment_created": "Comment added to order",
  },
  tenant_backup: {},
  pos_order: {
    "pos.order.created": "Order created",
    "pos.order.item_added": "Item added to order",
    "pos.order.payment_created": "Payment recorded",
    "pos.order.payment_refunded": "Payment refunded",
    "pos.order.status_changed": "Order status changed",
  },
  pos_service_ticket: {
    "pos.service_ticket.created": "Service ticket created",
    "pos.service_ticket.item_added": "Item added to ticket",
    "pos.service_ticket.item_updated": "Ticket item updated",
    "pos.service_ticket.item_status_changed": "Ticket item status changed",
    "pos.service_ticket.status_changed": "Ticket status changed",
  },
  pos_customer: {
    "pos_customer.profile_created": "Customer profile created",
    "pos_customer.account_created": "Customer account created",
    "pos_customer.account_status_changed": "Customer account status changed",
    "pos_customer.account_deleted": "Customer account deleted",
  },
  pos_hardware: {
    "pos_hardware.printer.bound": "Printer bound to terminal",
    "pos_hardware.print_job.printed": "Receipt printed",
    "pos_hardware.print_job.failed": "Receipt printing failed",
    "pos_hardware.built_in.connected": "Built-in peripheral connected",
    "pos_hardware.cash_payment_drawer.failed": "Cash drawer failed to open",
  },
  pos_terminal_security: {
    "pos_terminal.enrolled": "Terminal enrolled",
    "pos_terminal.enabled": "Terminal enabled",
    "pos_terminal.disabled": "Terminal disabled",
    "pos_terminal.revoked": "Terminal access revoked",
    "pos_terminal.credential_rotated": "Terminal credential rotated",
    "pos_terminal.credential_re_enrolled": "Terminal credential re-enrolled",
  },
  pos_shift: {
    "pos.shift.clock_in": "Staff clocked in",
    "pos.shift.break_start": "Break started",
    "pos.shift.break_end": "Break ended",
  },
  pos_register: {
    "pos.register.opened": "Register opened",
  },
  pos_notification: {
    "pos.notification.read": "Notification read",
  },
  pos_channel_settings: {
    "pos_channel_settings.updated": "POS channel settings updated",
  },
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
  "auth.pos_pin_login.success": "收银员 PIN 登录成功",
  "auth.pos_pin_login.failed": "收银员 PIN 登录失败",
  "branch.created": "门店已创建",
  "branch.updated": "门店资料已更新",
  "branch.status_changed": "门店状态已变更",
  "tenant_user.created": "员工账号已创建",
  "tenant_user.updated": "员工资料已更新",
  "tenant_user.disabled": "员工账号已停用",
  "tenant_user.pin_reset": "员工 PIN 已重置",
  "tenant_user.owner_created": "业主账号已创建",
  "service.created": "服务项目已创建",
  "service.updated": "服务项目已更新",
  "service.status_changed": "服务项目状态已变更",
  "service.deleted": "服务项目已删除",
  "price.created": "价格已创建",
  "price.updated": "价格已更新",
  "price.deleted": "价格已删除",
  "tenant_hardware.created": "外设配置已创建",
  "tenant_hardware.updated": "外设配置已更新",
  "tenant_hardware.deleted": "外设配置已删除",
  "notification_settings.updated": "通知设置已更新",
  "settings.updated": "设置已更新",
  "product.created": "商品已创建",
  "product.updated": "商品已更新",
  "tenant.customer.comment_created": "已为顾客添加备注",
  "tenant.customer.comment_updated": "顾客备注已修改",
  "tenant.order.comment_created": "已为订单添加备注",
  "pos.order.created": "订单已创建",
  "pos.order.item_added": "订单新增了项目",
  "pos.order.payment_created": "已记录一笔收款",
  "pos.order.payment_refunded": "已退款",
  "pos.order.status_changed": "订单状态已变更",
  "pos.service_ticket.created": "服务工单已创建",
  "pos.service_ticket.item_added": "工单新增了项目",
  "pos.service_ticket.item_updated": "工单项目已更新",
  "pos.service_ticket.item_status_changed": "工单项目状态已变更",
  "pos.service_ticket.status_changed": "工单状态已变更",
  "pos_customer.profile_created": "顾客档案已创建",
  "pos_customer.account_created": "顾客账户已创建",
  "pos_customer.account_status_changed": "顾客账户状态已变更",
  "pos_customer.account_deleted": "顾客账户已删除",
  "pos_hardware.printer.bound": "打印机已绑定到终端",
  "pos_hardware.print_job.printed": "小票已打印",
  "pos_hardware.print_job.failed": "小票打印失败",
  "pos_hardware.built_in.connected": "内置外设已连接",
  "pos_hardware.cash_payment_drawer.failed": "钱箱打开失败",
  "pos_terminal.enrolled": "收银终端已登记",
  "pos_terminal.enabled": "收银终端已启用",
  "pos_terminal.disabled": "收银终端已停用",
  "pos_terminal.revoked": "收银终端访问权限已吊销",
  "pos_terminal.credential_rotated": "终端凭据已轮换",
  "pos_terminal.credential_re_enrolled": "终端凭据已重新登记",
  "pos.shift.clock_in": "员工已上班打卡",
  "pos.shift.break_start": "开始休息",
  "pos.shift.break_end": "结束休息",
  "pos.register.opened": "收银台已开台",
  "pos.notification.read": "通知已读",
  "pos_channel_settings.updated": "POS 渠道设置已更新",
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

const AUDIT_EVENT_DESCRIPTIONS_FR: Record<string, string> = {
  "auth.login.success": "Connexion réussie",
  "auth.login.failed": "Échec de la connexion",
  "auth.logout": "Déconnexion",
  "auth.refresh.reuse_detected": "Réutilisation d'un jeton détectée",
  "auth.pos_pin_login.success": "Connexion caissier par PIN réussie",
  "auth.pos_pin_login.failed": "Échec de la connexion caissier par PIN",
  "platform_settings.updated": "Paramètres de la plateforme mis à jour",
  "security_settings.updated": "Paramètres de sécurité mis à jour",
  "security.settings.updated": "Paramètres de sécurité mis à jour",
  "backup_job.created": "Tâche de sauvegarde créée",
  "restore_request.created": "Demande de restauration créée",
  "feedback_ticket.status_updated": "Statut du ticket mis à jour",
  "feedback_ticket.assignee_updated": "Responsable du ticket mis à jour",
  "tenant.created": "Locataire créé",
  "tenant.updated": "Locataire mis à jour",
  "tenant.status_updated": "Statut du locataire mis à jour",
  "tenant_settings.updated": "Paramètres du locataire mis à jour",
  "tenant_feature_flags.updated": "Options du locataire mises à jour",
  "saas_user.created": "Utilisateur plateforme créé",
  "saas_user.updated": "Utilisateur plateforme mis à jour",
  "saas_user.roles_updated": "Rôles de l'utilisateur mis à jour",
  "saas_user.status_updated": "Statut de l'utilisateur mis à jour",
  "branch.created": "Succursale créée",
  "branch.updated": "Succursale mise à jour",
  "branch.status_changed": "Statut de la succursale modifié",
  "tenant_user.created": "Employé créé",
  "tenant_user.updated": "Employé mis à jour",
  "tenant_user.disabled": "Employé désactivé",
  "tenant_user.pin_reset": "PIN de l'employé réinitialisé",
  "tenant_user.owner_created": "Compte propriétaire créé",
  "service.created": "Service créé",
  "service.updated": "Service mis à jour",
  "service.status_changed": "Statut du service modifié",
  "service.deleted": "Service supprimé",
  "price.created": "Tarif créé",
  "price.updated": "Tarif mis à jour",
  "price.deleted": "Tarif supprimé",
  "tenant_hardware.created": "Périphérique créé",
  "tenant_hardware.updated": "Périphérique mis à jour",
  "tenant_hardware.deleted": "Périphérique supprimé",
  "notification_settings.updated": "Paramètres de notification mis à jour",
  "settings.updated": "Paramètres mis à jour",
  "product.created": "Produit créé",
  "product.updated": "Produit mis à jour",
  "tenant.customer.comment_created": "Commentaire ajouté au client",
  "tenant.customer.comment_updated": "Commentaire client modifié",
  "tenant.order.comment_created": "Commentaire ajouté à la commande",
  "pos.order.created": "Commande créée",
  "pos.order.item_added": "Article ajouté à la commande",
  "pos.order.payment_created": "Paiement enregistré",
  "pos.order.payment_refunded": "Paiement remboursé",
  "pos.order.status_changed": "Statut de la commande modifié",
  "pos.service_ticket.created": "Bon de service créé",
  "pos.service_ticket.item_added": "Article ajouté au bon",
  "pos.service_ticket.item_updated": "Article du bon mis à jour",
  "pos.service_ticket.item_status_changed": "Statut de l'article modifié",
  "pos.service_ticket.status_changed": "Statut du bon modifié",
  "pos_customer.profile_created": "Fiche client créée",
  "pos_customer.account_created": "Compte client créé",
  "pos_customer.account_status_changed": "Statut du compte client modifié",
  "pos_customer.account_deleted": "Compte client supprimé",
  "pos_hardware.printer.bound": "Imprimante associée au terminal",
  "pos_hardware.print_job.printed": "Reçu imprimé",
  "pos_hardware.print_job.failed": "Échec de l'impression du reçu",
  "pos_hardware.built_in.connected": "Périphérique intégré connecté",
  "pos_hardware.cash_payment_drawer.failed": "Échec d'ouverture du tiroir-caisse",
  "pos_terminal.enrolled": "Terminal enregistré",
  "pos_terminal.enabled": "Terminal activé",
  "pos_terminal.disabled": "Terminal désactivé",
  "pos_terminal.revoked": "Accès du terminal révoqué",
  "pos_terminal.credential_rotated": "Identifiants du terminal renouvelés",
  "pos_terminal.credential_re_enrolled": "Terminal réenregistré",
  "pos.shift.clock_in": "Pointage d'arrivée",
  "pos.shift.break_start": "Début de pause",
  "pos.shift.break_end": "Fin de pause",
  "pos.register.opened": "Caisse ouverte",
  "pos.notification.read": "Notification lue",
  "pos_channel_settings.updated": "Paramètres du canal POS mis à jour",
};

/** Translated descriptions, keyed by locale. English lives in the dictionary. */
const AUDIT_EVENT_DESCRIPTIONS_BY_LOCALE: Record<
  string,
  Record<string, string>
> = {
  "zh-CN": AUDIT_EVENT_DESCRIPTIONS_ZH_CN,
  fr: AUDIT_EVENT_DESCRIPTIONS_FR,
};

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getAuditEventDescription(
  eventType: string,
  locale?: string,
): string {
  const translated = locale
    ? AUDIT_EVENT_DESCRIPTIONS_BY_LOCALE[locale]?.[eventType]
    : undefined;
  if (translated) {
    return translated;
  }

  if (AUDIT_EVENT_DESCRIPTIONS[eventType]) {
    return AUDIT_EVENT_DESCRIPTIONS[eventType];
  }

  return toTitleCase(eventType.replace(/[._]/g, " "));
}

/**
 * Event types the dictionary deliberately does not describe yet.
 *
 * Each needs a product decision about what it means to a store owner before it
 * gets a label; until then they fall through to the humanised code rather than
 * carrying a confident guess in an audit trail.
 */
export const UNDESCRIBED_AUDIT_EVENT_TYPES = [
  "pos.service_ticket.status_synced_from_items",
  "pos.shift.security_forced_closed",
  "pos_terminal.rebound",
  "pos_hardware.privileged_reprint.authorized",
] as const;

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
      label: getAuditEventDescription(value, locale) || label,
    }));
  }

  return Object.entries(AUDIT_EVENT_DESCRIPTIONS).map(([value, label]) => ({
    value,
    label: getAuditEventDescription(value, locale) || label,
  }));
}

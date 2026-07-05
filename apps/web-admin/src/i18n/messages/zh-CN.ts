import { webAdminRoutes } from "@/config/routes";

import { saasMessagesZhCN } from "./saas/zh-CN";
import { tenantMessagesZhCN } from "./tenant/zh-CN";
import type { SaasMessages } from "./saas";
import type { TenantMessages } from "./tenant";
import type { WebAdminMessages } from "../messages-types";

/**
 * Simplified-Chinese message bundle.
 *
 * Loaded on demand (dynamic `import()`) from `messages.ts` so the Chinese
 * catalogs only ship to the client when the user actually switches to zh-CN,
 * keeping the default (en) bundle small.
 */
export const zhCNMessages: WebAdminMessages = {
  shell: {
    saas: {
      eyebrow: "SaaS 管理",
      title: "平台运营",
      description: "管理租户、平台用户、配置、日志与系统控制。",
    },
    tenant: {
      eyebrow: "租户管理",
      title: "门店运营",
      description: "管理门店、员工、服务配置、报表与租户设置。",
    },
  },
  sidebar: {
    saas: [
      {
        title: "主菜单",
        items: [
          { label: "仪表盘", href: webAdminRoutes.saas.home },
          { label: "用户管理", href: webAdminRoutes.saas.users },
          { label: "反馈工单", href: webAdminRoutes.saas.feedbackTickets },
        ],
      },
      {
        title: "配置管理",
        items: [
          { label: "租户管理", href: webAdminRoutes.saas.config.tenants },
          { label: "功能开关", href: webAdminRoutes.saas.config.featureFlags },
          { label: "本地化", href: webAdminRoutes.saas.config.localization },
          {
            label: "平台设置",
            href: webAdminRoutes.saas.config.platformSettings,
          },
        ],
      },
      {
        title: "系统设置",
        items: [
          { label: "审计日志", href: webAdminRoutes.saas.auditLogs },
          { label: "操作日志", href: webAdminRoutes.saas.system.logs },
          { label: "数据备份", href: webAdminRoutes.saas.system.backups },
          { label: "安全设置", href: webAdminRoutes.saas.system.security },
        ],
      },
    ],
    tenant: [
      {
        title: "主菜单",
        items: [
          { label: "仪表盘", href: webAdminRoutes.tenant.home },
          { label: "用户管理", href: webAdminRoutes.tenant.users },
          { label: "报表", href: webAdminRoutes.tenant.reports },
        ],
      },
      {
        title: "配置管理",
        items: [
          { label: "门店设置", href: webAdminRoutes.tenant.config.branches },
          { label: "服务目录", href: webAdminRoutes.tenant.config.services },
          { label: "价格本", href: webAdminRoutes.tenant.config.prices },
          { label: "硬件设备", href: webAdminRoutes.tenant.config.hardware },
          { label: "通知", href: webAdminRoutes.tenant.config.notifications },
        ],
      },
      {
        title: "系统设置",
        items: [
          { label: "操作日志", href: webAdminRoutes.tenant.system.logs },
          { label: "数据备份", href: webAdminRoutes.tenant.system.backups },
          { label: "租户设置", href: webAdminRoutes.tenant.system.settings },
        ],
      },
    ],
  },
  common: {
    personalCenter: "个人中心",
    language: "语言",
    signOut: "退出登录",
    signingOut: "正在退出...",
  },
  saas: saasMessagesZhCN satisfies SaasMessages,
  tenant: tenantMessagesZhCN satisfies TenantMessages,
};

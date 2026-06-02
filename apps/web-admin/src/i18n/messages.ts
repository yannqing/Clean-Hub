import { webAdminRoutes } from "@/config/routes";

import type { WebAdminLocale } from "./locale";
import { saasMessagesByLocale, type SaasMessages } from "./messages/saas";

type ShellCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

type SidebarSection = {
  title: string;
  items: { label: string; href: string }[];
};

export type WebAdminMessages = {
  shell: {
    saas: ShellCopy;
    tenant: ShellCopy;
  };
  sidebar: {
    saas: SidebarSection[];
    tenant: SidebarSection[];
  };
  common: {
    personalCenter: string;
    language: string;
    signOut: string;
    signingOut: string;
  };
  saas: SaasMessages;
};

const en: WebAdminMessages = {
  shell: {
    saas: {
      eyebrow: "SaaS Admin",
      title: "Platform Operations",
      description:
        "Manage tenants, platform users, configuration, logs, and system controls.",
    },
    tenant: {
      eyebrow: "Tenant Admin",
      title: "Store Operations",
      description:
        "Manage branches, staff, service configuration, reports, and tenant settings.",
    },
  },
  sidebar: {
    saas: [
      {
        title: "Main",
        items: [
          { label: "Dashboard", href: webAdminRoutes.saas.home },
          { label: "User Management", href: webAdminRoutes.saas.users },
          {
            label: "Feedback Tickets",
            href: webAdminRoutes.saas.feedbackTickets,
          },
        ],
      },
      {
        title: "Configuration Management",
        items: [
          {
            label: "Tenant Management",
            href: webAdminRoutes.saas.config.tenants,
          },
          {
            label: "Feature Flags",
            href: webAdminRoutes.saas.config.featureFlags,
          },
          {
            label: "Localization",
            href: webAdminRoutes.saas.config.localization,
          },
          {
            label: "Platform Settings",
            href: webAdminRoutes.saas.config.platformSettings,
          },
        ],
      },
      {
        title: "System Settings",
        items: [
          { label: "Audit Logs", href: webAdminRoutes.saas.auditLogs },
          { label: "Operation Logs", href: webAdminRoutes.saas.system.logs },
          { label: "Data Backups", href: webAdminRoutes.saas.system.backups },
          {
            label: "Security Settings",
            href: webAdminRoutes.saas.system.security,
          },
        ],
      },
    ],
    tenant: [
      {
        title: "Main",
        items: [
          { label: "Dashboard", href: webAdminRoutes.tenant.home },
          { label: "User Management", href: webAdminRoutes.tenant.users },
          { label: "Reports", href: webAdminRoutes.tenant.reports },
        ],
      },
      {
        title: "Configuration Management",
        items: [
          {
            label: "Branch Settings",
            href: webAdminRoutes.tenant.config.branches,
          },
          {
            label: "Service Catalog",
            href: webAdminRoutes.tenant.config.services,
          },
          { label: "Price Books", href: webAdminRoutes.tenant.config.prices },
          {
            label: "Hardware Devices",
            href: webAdminRoutes.tenant.config.hardware,
          },
          {
            label: "Notifications",
            href: webAdminRoutes.tenant.config.notifications,
          },
        ],
      },
      {
        title: "System Settings",
        items: [
          { label: "Operation Logs", href: webAdminRoutes.tenant.system.logs },
          { label: "Data Backups", href: webAdminRoutes.tenant.system.backups },
          {
            label: "Tenant Settings",
            href: webAdminRoutes.tenant.system.settings,
          },
        ],
      },
    ],
  },
  common: {
    personalCenter: "Personal Center",
    language: "Language",
    signOut: "Sign out",
    signingOut: "Signing out...",
  },
  saas: saasMessagesByLocale.en,
};

const zhCN: WebAdminMessages = {
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
  saas: saasMessagesByLocale["zh-CN"],
};

export const webAdminMessages: Record<WebAdminLocale, WebAdminMessages> = {
  en,
  "zh-CN": zhCN,
};

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
      header: {
        searchLabel: "搜索平台工作区",
        searchPlaceholder: "搜索租户、用户、工单或设置...",
        assistantLabel: "CleanHub 助手",
        accountLabel: "当前登录用户",
        assistant: {
          title: "CleanHub 助手",
          description: "快速进入常用的平台页面与运营工具。",
          closeLabel: "关闭助手",
          searchLabel: "搜索平台操作",
          searchPlaceholder: "搜索租户、用户或日志...",
          quickActionsTitle: "平台快捷入口",
          emptyTitle: "没有匹配的操作",
          emptyDescription: "请尝试输入租户、用户、工单或安全等页面名称。",
          actions: {
            overview: {
              label: "平台概览",
              description: "查看平台动态与关键运营指标。",
            },
            tenants: {
              label: "租户管理",
              description: "管理租户账号及其平台访问状态。",
            },
            users: {
              label: "平台用户",
              description: "管理 SaaS 运营人员及其角色。",
            },
            feedbackTickets: {
              label: "反馈工单",
              description: "查看并处理收到的支持请求。",
            },
            todos: {
              label: "我的待办",
              description: "集中查看尚待处理的平台工作。",
            },
            auditLogs: {
              label: "审计日志",
              description: "追溯重要的平台与账号变更。",
            },
            operationLogs: {
              label: "操作日志",
              description: "查看应用与服务的运行记录。",
            },
            security: {
              label: "安全设置",
              description: "查看安全策略与近期安全事件。",
            },
            settings: {
              label: "平台设置",
              description: "配置全平台默认规则与运行方式。",
            },
          },
        },
        account: {
          menuLabel: "打开账户菜单",
          roleLabel: "角色",
          profile: "个人中心",
          settings: "平台设置",
        },
      },
    },
    tenant: {
      eyebrow: "租户管理",
      title: "门店运营",
      description: "管理门店、员工、服务配置、报表与租户设置。",
      header: {
        searchLabel: "搜索租户工作区",
        searchPlaceholder: "搜索门店、用户或服务...",
        assistantLabel: "CleanHub 助手",
        messagesLabel: "消息",
        accountLabel: "当前登录用户",
        assistant: {
          title: "CleanHub 助手",
          description:
            "快速查找租户工作区中的常用页面与操作。当前助手用于导航 CleanHub，不会生成 AI 回答。",
          closeLabel: "关闭助手",
          searchLabel: "搜索操作",
          searchPlaceholder: "搜索订单、产品或设置...",
          recommendedTitle: "当前页面常用操作",
          quickActionsTitle: "全部快捷入口",
          emptyTitle: "没有匹配的操作",
          emptyDescription: "请尝试输入订单、产品、报表等页面或操作名称。",
          actions: {
            orders: {
              label: "订单",
              description: "查看当前权限范围内全部门店的订单。",
            },
            customers: {
              label: "顾客",
              description: "打开租户顾客目录。",
            },
            products: {
              label: "产品",
              description: "查看产品、价格与库存信息。",
            },
            newProduct: {
              label: "添加产品",
              description: "创建一个新的实体商品。",
            },
            services: {
              label: "服务",
              description: "查看服务目录。",
            },
            newService: {
              label: "添加服务",
              description: "创建一个新的销售服务。",
            },
            discounts: {
              label: "折扣",
              description: "查看生效中与计划中的折扣。",
            },
            newDiscount: {
              label: "创建折扣",
              description: "配置一个新的折扣规则。",
            },
            reports: {
              label: "报表",
              description: "查看业务表现与趋势。",
            },
            finance: {
              label: "财务",
              description: "查看销售、结算与财务汇总。",
            },
            settings: {
              label: "租户设置",
              description: "管理租户与门店配置。",
            },
          },
        },
        messages: {
          title: "消息",
          unreadCount: "{count} 条未读",
          noUnread: "消息已全部读完",
          markAllRead: "全部标为已读",
          marking: "正在更新...",
          loading: "正在加载消息...",
          errorTitle: "消息加载失败",
          errorHint: "请检查连接后重试。",
          retry: "重试",
          emptyTitle: "暂无消息",
          emptyHint: "新的租户通知会显示在这里。",
          businessType: "业务",
          systemType: "系统",
          unreadStatus: "未读",
          readStatus: "已读",
          markRead: "标为已读",
          relatedOrder: "查看订单",
          viewAll: "查看全部通知",
        },
        account: {
          menuLabel: "打开账户菜单",
          roleLabel: "角色",
          branchScopeLabel: "门店权限",
          allBranches: "全部门店",
          assignedBranches: "已分配 {count} 个门店",
          profile: "个人中心",
          loadingProfile: "正在加载个人中心…",
          employees: "员工管理",
          settings: "租户设置",
        },
      },
    },
  },
  sidebar: {
    saas: [
      {
        title: "主菜单",
        items: [
          { label: "主页", href: webAdminRoutes.saas.home },
          { label: "租户管理", href: webAdminRoutes.saas.config.tenants },
          { label: "用户管理", href: webAdminRoutes.saas.users },
          { label: "反馈工单", href: webAdminRoutes.saas.feedbackTickets },
          { label: "我的待办", href: webAdminRoutes.saas.todos },
        ],
      },
      {
        title: "配置管理",
        items: [
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
          { label: "主页", href: webAdminRoutes.tenant.home },
          { label: "订单", href: webAdminRoutes.tenant.orders },
          { label: "顾客", href: webAdminRoutes.tenant.customers },
          { label: "员工", href: webAdminRoutes.tenant.users },
          { label: "产品", href: webAdminRoutes.tenant.products },
          { label: "折扣", href: webAdminRoutes.tenant.discounts },
          {
            label: "销售点",
            href: webAdminRoutes.tenant.pointOfSale.home,
          },
          { label: "报表", href: webAdminRoutes.tenant.reports },
          { label: "财务", href: webAdminRoutes.tenant.finance },
        ],
      },
      {
        title: "门店与设备",
        items: [
          { label: "门店", href: webAdminRoutes.tenant.config.branches },
          { label: "通知", href: webAdminRoutes.tenant.notifications },
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
    languageLabels: {
      en: "English",
      fr: "Français",
      zhCN: "简体中文",
    },
    theme: "主题",
    switchToDarkTheme: "切换为深色主题",
    switchToLightTheme: "切换为浅色主题",
    signOut: "退出登录",
    signingOut: "正在退出...",
  },
  auth: {
    brandName: "CleanHub 管理后台",
    brandSuffix: "管理控制台",
    heroTitle: "把日常经营，打理得井然有序。",
    heroDescription:
      "集中管理门店、员工、服务配置、报表与运营设置，让日常管理更清晰高效。",
    title: "欢迎回来",
    description:
      "使用工作邮箱登录，系统将根据账号权限，带你进入相应工作台。",
    identifierLabel: "邮箱",
    identifierPlaceholder: "admin@cleanhub.local",
    passwordLabel: "密码",
    passwordPlaceholder: "请输入密码",
    passwordShow: "显示密码",
    passwordHide: "隐藏密码",
    submit: "登录",
    submitting: "正在登录...",
    signedIn: "登录成功。",
    validation: {
      identifierRequired: "请输入邮箱。",
      identifierInvalid: "请输入有效的邮箱地址。",
      passwordRequired: "请输入密码。",
    },
    errors: {
      checkForm: "请检查登录信息。",
      accessDenied:
        "该账号无法访问 CleanHub 管理后台，请使用业主、经理或平台管理员账号登录。",
      signInFailed: "登录失败，请检查账号信息后重试。",
    },
    redirect: {
      sessionExpired: "登录状态已过期，请重新登录。",
      tenantAccessDenied:
        "该账号无权访问租户管理后台，请使用业主或经理账号登录。",
    },
  },
  saas: saasMessagesZhCN satisfies SaasMessages,
  tenant: tenantMessagesZhCN satisfies TenantMessages,
};

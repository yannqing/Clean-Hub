import type { PosIconName } from "@/components/app-shell/icons";

import { posRoutes } from "./routes";

export type PosNavItem = {
  label: string;
  href: string;
  icon: PosIconName;
};

export type PosNavSection = {
  title: string;
  items: PosNavItem[];
};

export const posSidebarNavigation: PosNavSection[] = [
  {
    title: "业务操作",
    items: [
      { label: "工作台", href: posRoutes.workspace, icon: "layout-dashboard" },
      { label: "客户接待", href: posRoutes.newIntake, icon: "user-plus" },
      { label: "扫描标签", href: posRoutes.scan, icon: "scan-line" },
    ],
  },
  {
    title: "业务记录",
    items: [
      { label: "客户管理", href: posRoutes.customers, icon: "users" },
      { label: "工单管理", href: posRoutes.tickets, icon: "clipboard-list" },
      { label: "订单管理", href: posRoutes.orders, icon: "receipt" },
      { label: "统计数据", href: posRoutes.statistics, icon: "chart" },
      { label: "衣物管理", href: posRoutes.garments, icon: "shirt" },
    ],
  },
  {
    title: "门店",
    items: [
      { label: "店员交接", href: posRoutes.shiftHandover, icon: "replace" },
      { label: "通知中心", href: posRoutes.notifications, icon: "bell" },
      { label: "设置", href: posRoutes.settings, icon: "settings" },
    ],
  },
];

export const posShellCopy = {
  brandName: "CleanHub",
  brandSuffix: "POS",
} as const;

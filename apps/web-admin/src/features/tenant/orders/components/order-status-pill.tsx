import { Badge, Icon, cn } from "@cleanhub/ui";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  type LucideIcon,
  RotateCcw,
  XCircle,
} from "lucide-react";

export type OrderStatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "purple";

const toneClasses: Record<OrderStatusTone, string> = {
  neutral:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  warning:
    "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  success:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  danger:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  purple:
    "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

const toneIcons: Record<OrderStatusTone, LucideIcon> = {
  neutral: CircleDot,
  info: Clock3,
  warning: AlertTriangle,
  success: CheckCircle2,
  danger: XCircle,
  purple: RotateCcw,
};

export function OrderStatusPill({
  className,
  label,
  tone,
  icon,
}: {
  className?: string;
  label: string;
  tone: OrderStatusTone;
  icon?: LucideIcon;
}) {
  return (
    <Badge
      className={cn(
        "border px-2.5 py-1 font-semibold shadow-none",
        toneClasses[tone],
        className,
      )}
      variant="outline"
    >
      <Icon aria-hidden icon={icon ?? toneIcons[tone]} size={13} />
      {label}
    </Badge>
  );
}

export function getOrderWorkflowTone(
  status: "draft" | "received" | "paid" | "delivered" | "cancelled",
): OrderStatusTone {
  switch (status) {
    case "received":
      return "info";
    case "paid":
      return "purple";
    case "delivered":
      return "success";
    case "cancelled":
      return "danger";
    case "draft":
    default:
      return "neutral";
  }
}

export function getOrderPaymentTone(
  status: "unpaid" | "paid" | "partial" | "refunded",
): OrderStatusTone {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
    case "unpaid":
      return "warning";
    case "refunded":
      return "purple";
  }
}

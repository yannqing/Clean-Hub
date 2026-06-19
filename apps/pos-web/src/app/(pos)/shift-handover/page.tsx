import { PosPagePlaceholder } from "@/components/app-shell";

export default function ShiftHandoverPage() {
  return (
    <PosPagePlaceholder
      breadcrumb="交接班"
      description="结束当前班次：核对现金、确认待处理支付，并交接给下一位收银员。"
      icon="replace"
      title="交接班"
    />
  );
}

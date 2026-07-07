import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@cleanhub/ui";

import { formatMoney } from "@/lib/format";

import type { ReportSummary, ReportSummaryQuery } from "../types";

type ReportSummaryViewProps = {
  query: ReportSummaryQuery;
  summary?: ReportSummary;
  error?: string;
  /**
   * ISO 4217 currency code to use when rendering monetary amounts. Falls back to
   * the platform default (`XOF`) when undefined so the report never renders in
   * a misleading currency such as USD.
   */
  currency?: string;
};

function formatPercent(part: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(part / total);
}

export function ReportSummaryView({
  query,
  summary,
  error,
  currency,
}: ReportSummaryViewProps) {
  const paymentTotal = summary
    ? Object.values(summary.paymentBreakdown).reduce(
        (total, value) => total + value,
        0,
      )
    : 0;

  return (
    <div className="grid gap-6">
      <div>
        <Badge variant="secondary">Tenant reports</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">Reports</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Review tenant sales and operation summary for the selected date range.
        </p>
      </div>

      <form className="grid gap-4 rounded-md border p-4 md:grid-cols-4" method="GET">
        <div className="grid gap-2">
          <Label htmlFor="report-from">From</Label>
          <Input
            defaultValue={query.from}
            id="report-from"
            name="from"
            type="date"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-to">To</Label>
          <Input defaultValue={query.to} id="report-to" name="to" type="date" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-branch-id">Branch ID</Label>
          <Input
            defaultValue={query.branchId}
            id="report-branch-id"
            name="branchId"
            placeholder="Optional branch ULID"
          />
        </div>

        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Apply filters
          </Button>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Gross Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {formatMoney(summary.grossSales, currency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{summary.orderCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Pending Pickup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {summary.pendingPickupCount}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {summary.inProgressCount}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {Object.entries(summary.paymentBreakdown).map(([method, amount]) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0"
                    key={method}
                  >
                    <span className="capitalize text-sm">{method}</span>
                    <span className="text-sm font-medium">
                      {formatMoney(amount, currency)} · {formatPercent(amount, paymentTotal)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exports</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button disabled type="button" variant="outline">
                  Export
                </Button>
                <Button disabled type="button" variant="outline">
                  Z Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

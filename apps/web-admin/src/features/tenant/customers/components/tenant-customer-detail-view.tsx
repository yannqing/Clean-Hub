"use client";

import { formatPosOrderCode } from "@cleanhub/domain/order-codes";
import type {
  TenantCustomerDetail,
  TenantCustomerTimelineResponse,
  TenantOrderSummary,
  TenantUserSummary,
} from "@cleanhub/api-client";
import { Badge, Card, CardContent, Icon } from "@cleanhub/ui";
import {
  ChevronRight,
  ContactRound,
  FileText,
  Link2,
  Mail,
  Phone,
  ReceiptText,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import {
  getOrderPaymentTone,
  getOrderWorkflowTone,
  OrderStatusPill,
} from "@/features/tenant/orders/components/order-status-pill";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import { TenantCustomerTimeline } from "./tenant-customer-timeline";

function displayValue(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

function formatOrderMoney(value: string, currency: string, locale: string) {
  const amount = Number(value);
  return formatMoney(Number.isFinite(amount) ? amount : 0, currency, locale);
}

export function TenantCustomerDetailView({
  customer,
  fromAccountDetail = false,
  initialTimeline,
  recentOrders,
  staffMembers,
  totalOrders,
}: {
  customer: TenantCustomerDetail;
  fromAccountDetail?: boolean;
  initialTimeline: TenantCustomerTimelineResponse;
  recentOrders: TenantOrderSummary[];
  staffMembers: TenantUserSummary[];
  totalOrders: number;
}) {
  const { formatDateTime, locale, m } = useTenantI18n();
  const detail = m.customers.detail;

  return (
    <section
      className="mx-auto w-full max-w-[1120px] space-y-5 pb-20"
      data-testid="tenant-customer-detail-view"
    >
      <header className="space-y-3">
        <nav
          aria-label={
            fromAccountDetail
              ? m.customers.accounts.detail.breadcrumbLabel
              : detail.breadcrumbLabel
          }
        >
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link
                aria-label={
                  fromAccountDetail
                    ? m.customers.accounts.detail.backToAccounts
                    : detail.backToCustomers
                }
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                href={
                  fromAccountDetail
                    ? webAdminRoutes.tenant.customerAccounts
                    : webAdminRoutes.tenant.customers
                }
                title={
                  fromAccountDetail
                    ? m.customers.accounts.title
                    : m.customers.title
                }
              >
                <Icon
                  aria-hidden
                  icon={fromAccountDetail ? UsersRound : ContactRound}
                  size={16}
                />
              </Link>
            </li>
            <li aria-hidden className="text-muted-foreground">
              <Icon aria-hidden icon={ChevronRight} size={14} />
            </li>
            {fromAccountDetail ? (
              <>
                <li>
                  <Link
                    className="block max-w-64 truncate text-muted-foreground transition-colors hover:text-foreground"
                    href={webAdminRoutes.tenant.customerAccount(
                      customer.account.id,
                    )}
                  >
                    {customer.account.name}
                  </Link>
                </li>
                <li aria-hidden className="text-muted-foreground">
                  <Icon aria-hidden icon={ChevronRight} size={14} />
                </li>
              </>
            ) : null}
            <li>
              <span
                aria-current="page"
                className="block max-w-64 truncate font-medium"
              >
                {customer.fullName}
              </span>
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {customer.fullName}
          </h1>
          <Badge variant={customer.status === "active" ? "default" : "outline"}>
            {m.customers.statusLabels[customer.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {customer.accountName} · {formatDateTime(customer.createdAt)}
        </p>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid min-w-0 gap-5">
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={UserRound} size={17} />
                <h2 className="text-sm font-semibold">{detail.profileTitle}</h2>
              </div>
              <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.relationship}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {displayValue(
                      customer.relationship,
                      m.customers.notProvided,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.address}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap font-medium">
                    {displayValue(customer.address, m.customers.notProvided)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    {detail.notes}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-foreground/90">
                    {displayValue(customer.notes, m.customers.notProvided)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden icon={ReceiptText} size={17} />
                    <h2 className="text-sm font-semibold">
                      {detail.recentOrdersTitle}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {interpolate(detail.recentOrdersDescription, {
                      count: totalOrders.toLocaleString(locale),
                    })}
                  </p>
                </div>
              </div>

              {recentOrders.length === 0 ? (
                <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
                  {detail.recentOrdersEmpty}
                </p>
              ) : (
                <ol className="divide-y border-t">
                  {recentOrders.map((order) => (
                    <li key={order.id}>
                      <Link
                        aria-label={interpolate(m.orders.detail.openOrder, {
                          order: formatPosOrderCode(order.id),
                        })}
                        className="grid gap-3 px-5 py-4 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        href={webAdminRoutes.tenant.order(order.id)}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {formatPosOrderCode(order.id)}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <OrderStatusPill
                            label={m.orders.statusLabels[order.status]}
                            tone={getOrderWorkflowTone(order.status)}
                          />
                          <OrderStatusPill
                            label={
                              m.orders.paymentStatusLabels[order.paymentStatus]
                            }
                            tone={getOrderPaymentTone(order.paymentStatus)}
                          />
                          <span className="ml-1 text-sm font-semibold">
                            {formatOrderMoney(
                              order.totalAmount,
                              order.currency,
                              locale,
                            )}
                          </span>
                          <Icon
                            aria-hidden
                            className="text-muted-foreground"
                            icon={ChevronRight}
                            size={15}
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <TenantCustomerTimeline
            customerId={customer.id}
            initialTimeline={initialTimeline}
            staffMembers={staffMembers}
          />
        </main>

        <aside className="grid gap-4">
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={Phone} size={17} />
                <h2 className="text-sm font-semibold">{detail.contactTitle}</h2>
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden icon={Phone} size={13} />
                    {m.customers.columns.phone}
                  </dt>
                  <dd className="mt-1 break-all font-medium">
                    {displayValue(customer.phone, m.customers.notProvided)}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden icon={Mail} size={13} />
                    {m.customers.columns.email}
                  </dt>
                  <dd className="mt-1 break-all font-medium">
                    {displayValue(customer.email, m.customers.notProvided)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <Link
                aria-label={interpolate(
                  m.customers.accounts.detail.openAccount,
                  { account: customer.account.name },
                )}
                className="flex items-center gap-2 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={webAdminRoutes.tenant.customerAccount(customer.account.id)}
              >
                <Icon aria-hidden icon={Link2} size={17} />
                <h2 className="text-sm font-semibold">{detail.accountTitle}</h2>
                <Icon
                  aria-hidden
                  className="ml-auto text-muted-foreground"
                  icon={ChevronRight}
                  size={14}
                />
              </Link>
              <Link
                className="mt-4 block text-sm font-semibold hover:underline"
                href={webAdminRoutes.tenant.customerAccount(customer.account.id)}
              >
                {customer.account.name}
              </Link>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.accountStatus}
                  </dt>
                  <dd className="mt-1">
                    <Badge
                      variant={
                        customer.account.status === "active"
                          ? "default"
                          : "outline"
                      }
                    >
                      {m.customers.statusLabels[customer.account.status]}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {m.customers.columns.phone}
                  </dt>
                  <dd className="mt-1 break-all font-medium">
                    {displayValue(
                      customer.account.phone,
                      m.customers.notProvided,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {m.customers.columns.email}
                  </dt>
                  <dd className="mt-1 break-all font-medium">
                    {displayValue(
                      customer.account.email,
                      m.customers.notProvided,
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Icon aria-hidden icon={FileText} size={17} />
                <h2 className="text-sm font-semibold">
                  {detail.recordDetailsTitle}
                </h2>
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.customerId}
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {customer.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.accountId}
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {customer.account.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.createdAt}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDateTime(customer.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.updatedAt}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDateTime(customer.updatedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {detail.accountCreatedAt}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDateTime(customer.account.createdAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

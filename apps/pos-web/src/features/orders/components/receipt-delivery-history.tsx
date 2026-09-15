"use client";

import type { PosReceiptDelivery } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cleanhub/ui";
import { useEffect, useState } from "react";

import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

const CHANNEL_LABELS: Record<PosReceiptDelivery["channel"], string> = {
  print: "本地打印",
  email: "电子邮件",
  sms: "短信",
  none: "无需小票",
};

const STATUS_LABELS: Record<PosReceiptDelivery["status"], string> = {
  pending: "等待发送",
  sent: "已送达",
  failed: "发送失败",
  skipped: "已跳过",
};

export function ReceiptDeliveryHistory({ orderId }: { orderId: string }) {
  const [deliveries, setDeliveries] = useState<PosReceiptDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void posApi.pos.orders
      .listReceiptDeliveries(orderId)
      .then((result) => {
        if (active) setDeliveries(result.data);
      })
      .catch((error) => {
        if (active) toast.error(getPosApiErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  async function retry(deliveryId: string) {
    setRetryingId(deliveryId);
    try {
      const result = await posApi.pos.orders.retryReceiptDelivery(
        orderId,
        deliveryId,
      );
      setDeliveries((current) =>
        current.map((delivery) =>
          delivery.id === result.id ? result : delivery,
        ),
      );
      if (result.status === "sent") toast.success("小票已重新发送。");
      else toast.error(result.failureReason ?? "小票重试仍然失败。");
    } catch (error) {
      toast.error(getPosApiErrorMessage(error));
    } finally {
      setRetryingId(null);
    }
  }

  if (loading || deliveries.length === 0) return null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle>小票发送记录</CardTitle>
        <CardDescription className="text-xs">
          失败的邮件或短信可使用原始小票快照重试。
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y px-0">
        {deliveries.map((delivery) => (
          <div
            className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm"
            key={delivery.id}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">
                  {CHANNEL_LABELS[delivery.channel]}
                </p>
                <Badge
                  variant={
                    delivery.status === "failed" ? "destructive" : "secondary"
                  }
                >
                  {STATUS_LABELS[delivery.status]}
                </Badge>
              </div>
              {delivery.destination ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {delivery.destination}
                </p>
              ) : null}
              {delivery.failureReason ? (
                <p className="mt-1 text-xs text-red-600">
                  {delivery.failureReason}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                已尝试 {delivery.attemptCount} 次
              </p>
            </div>
            {delivery.status === "failed" &&
            (delivery.channel === "email" || delivery.channel === "sms") ? (
              <Button
                disabled={retryingId !== null}
                onClick={() => void retry(delivery.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                {retryingId === delivery.id ? "重试中…" : "重新发送"}
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

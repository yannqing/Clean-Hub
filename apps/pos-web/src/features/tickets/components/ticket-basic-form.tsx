"use client";

import { posToast as toast } from "@/lib/pos-toast";
import {
  dateTimeLocalToUtc,
  toDateTimeLocalValue,
} from "@cleanhub/domain/timezone";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";

import { updateTicketAction } from "../actions";
import {
  TICKET_PRIORITY_OPTIONS,
  TICKET_SOURCE_OPTIONS,
  TICKET_TYPE_OPTIONS,
} from "../constants";
import { validateTicketForm } from "../validators";
import type { TicketBasicFormValues } from "../types";
import type { ServiceTicketDetail } from "@cleanhub/api-client";

type TicketBasicFormProps = {
  ticket: ServiceTicketDetail;
  onCancel: () => void;
};

/**
 * Inline editor for the ticket's basic info (type/priority/source/pickup/remark).
 * Status and items are edited through their own affordances, not here.
 */
export function TicketBasicForm({ ticket, onCancel }: TicketBasicFormProps) {
  const { timeZone } = usePosRuntimeConfig();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<TicketBasicFormValues>({
    ticketType: ticket.ticketType,
    priority: ticket.priority,
    sourceChannel: ticket.sourceChannel,
    // datetime-local expects yyyy-MM-ddTHH:mm (no timezone).
    expectedPickupAt: ticket.expectedPickupAt
      ? toDateTimeLocalValue(ticket.expectedPickupAt, timeZone)
      : "",
    remark: ticket.remark ?? "",
  });

  function update<K extends keyof TicketBasicFormValues>(
    key: K,
    value: TicketBasicFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateTicketForm(values);
    if (errors) {
      const first = Object.values(errors)[0];
      if (first) {
        toast.error(first);
      }
      return;
    }

    startTransition(async () => {
      const expectedPickupAt = values.expectedPickupAt
        ? dateTimeLocalToUtc(values.expectedPickupAt, timeZone)
        : null;
      if (values.expectedPickupAt && !expectedPickupAt) {
        toast.error("预计取件时间无效。");
        return;
      }
      const result = await updateTicketAction(ticket.id, {
        ticketType: values.ticketType,
        priority: values.priority,
        sourceChannel: values.sourceChannel,
        // Convert the local datetime-local value to an ISO string; clear when empty.
        expectedPickupAt: expectedPickupAt?.toISOString() ?? null,
        remark: values.remark.trim() || null,
      });
      if (result.ok) {
        toast.success("工单信息已保存");
        onCancel();
      } else if (result.code === "VERSION_CONFLICT") {
        toast.error("该工单已被他人修改，正在刷新…");
        onCancel();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="工单类型">
              <Select
                onValueChange={(value) =>
                  update(
                    "ticketType",
                    value as TicketBasicFormValues["ticketType"],
                  )
                }
                value={values.ticketType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="优先级">
              <Select
                onValueChange={(value) =>
                  update("priority", value as TicketBasicFormValues["priority"])
                }
                value={values.priority}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="来源渠道">
              <Select
                onValueChange={(value) =>
                  update(
                    "sourceChannel",
                    value as TicketBasicFormValues["sourceChannel"],
                  )
                }
                value={values.sourceChannel}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="预计取件时间">
              <Input
                onChange={(event) =>
                  update("expectedPickupAt", event.target.value)
                }
                type="datetime-local"
                value={values.expectedPickupAt}
              />
            </Field>
            <Field label="备注" wide>
              <Textarea
                className="min-h-[88px]"
                maxLength={1000}
                onChange={(event) => update("remark", event.target.value)}
                value={values.remark}
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button disabled={isPending} type="submit">
              <Icon className="h-4 w-4" name="save" />
              {isPending ? "保存中…" : "保存修改"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

"use client";

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { useSaasI18n } from "@/i18n";
import { createBackupJobAction } from "../actions";
import { backupJobScopeOptions } from "../constants";
import type { BackupJobListItem, BackupJobScope } from "../types";

type CreateBackupJobFormProps = {
  onCreated: (backupJob: BackupJobListItem) => void;
};

export function CreateBackupJobForm({ onCreated }: CreateBackupJobFormProps) {
  const { m } = useSaasI18n();
  const [scope, setScope] = useState<BackupJobScope>("platform");
  const [tenantId, setTenantId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await createBackupJobAction({
      scope,
      tenantId,
      reason,
    });

    if (result.ok) {
      toast.success(m.backups.backupCreated);
      setReason("");
      onCreated(result.data);
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">{m.backups.manualBackup}</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="backup-scope">{m.backups.scope}</Label>
          <Select
            onValueChange={(value) => setScope(value as BackupJobScope)}
            value={scope}
          >
            <SelectTrigger className="w-full" id="backup-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {backupJobScopeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {m.common.backupScopeLabels[option.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="backup-tenant-id">{m.systemLogs.tenantId}</Label>
          <Input
            disabled={scope === "platform"}
            id="backup-tenant-id"
            onChange={(event) => setTenantId(event.target.value)}
            placeholder={m.common.optionalTenantUlid}
            value={scope === "platform" ? "" : tenantId}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="backup-reason">{m.backups.reason}</Label>
        <Textarea
          id="backup-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={m.backups.backupReasonPlaceholder}
          value={reason}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting ? m.common.creating : m.backups.createBackupTask}
        </Button>
      </div>
    </form>
  );
}

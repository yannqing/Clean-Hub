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

import { createBackupJobAction } from "../actions";
import { backupJobScopeOptions } from "../constants";
import type { BackupJobListItem, BackupJobScope } from "../types";

type CreateBackupJobFormProps = {
  onCreated: (backupJob: BackupJobListItem) => void;
};

export function CreateBackupJobForm({ onCreated }: CreateBackupJobFormProps) {
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
      toast.success("Backup task record created.");
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
        <h2 className="text-base font-semibold">Manual Backup</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="backup-scope">Scope</Label>
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
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="backup-tenant-id">Tenant ID</Label>
          <Input
            disabled={scope === "platform"}
            id="backup-tenant-id"
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="Required for tenant backups"
            value={scope === "platform" ? "" : tenantId}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="backup-reason">Reason</Label>
        <Textarea
          id="backup-reason"
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional note for the backup task record"
          value={reason}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting ? "Creating..." : "Create backup task"}
        </Button>
      </div>
    </form>
  );
}

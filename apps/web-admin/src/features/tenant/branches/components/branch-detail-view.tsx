"use client";

import {
  Badge,
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { updateBranchAction, updateBranchStatusAction } from "../actions";
import { branchLanguageOptions } from "../constants";
import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
  BranchSummary,
} from "../types";

const branchStatusLabels: Record<BranchStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

const VERSION_CONFLICT_MESSAGE =
  "Branch was updated by another request. Refresh and try again.";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Branch request failed.";
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not updated";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function businessHoursToText(
  businessHours: BranchSummary["businessHours"],
): string {
  return businessHours ? JSON.stringify(businessHours, null, 2) : "";
}

function toFormValues(branch: BranchSummary): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    defaultLanguage: branch.defaultLanguage,
    defaultCurrency: branch.defaultCurrency,
    receiptName: branch.receiptName ?? "",
    receiptPhone: branch.receiptPhone ?? "",
    receiptAddress: branch.receiptAddress ?? "",
    logoUrl: branch.logoUrl ?? "",
    businessHoursJson: businessHoursToText(branch.businessHours),
    status: branch.status,
    version: branch.version,
  };
}

function isVersionConflict(result: { code?: string; status?: number }): boolean {
  return result.status === 409 || result.code === "BRANCH_VERSION_CONFLICT";
}

export type BranchDetailViewProps = {
  initialBranch: BranchSummary;
};

export function BranchDetailView({ initialBranch }: BranchDetailViewProps) {
  const [branch, setBranch] = useState(initialBranch);
  const [formValues, setFormValues] = useState<BranchFormValues>(
    toFormValues(initialBranch),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof BranchFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateForm<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K],
  ): void {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setMessage(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const result = await updateBranchAction(branch.id, {
        ...formValues,
        version: branch.version,
      });

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? VERSION_CONFLICT_MESSAGE
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      setBranch(result.data);
      setFormValues(toFormValues(result.data));
      setErrors({});
      toast.success("Branch updated.");
    } catch (saveError) {
      const nextMessage = getErrorMessage(saveError);
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status?: BranchStatus) {
    setSaving(true);
    setMessage(null);

    try {
      const nextStatus: BranchStatus =
        status ?? (branch.status === "active" ? "inactive" : "active");
      const result = await updateBranchStatusAction(
        branch.id,
        nextStatus,
        branch.version,
      );

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? VERSION_CONFLICT_MESSAGE
          : result.message;
        setErrors(result.errors);
        setMessage(nextMessage);
        toast.error(nextMessage);
        return;
      }

      setBranch(result.data);
      setFormValues(toFormValues(result.data));
      setErrors({});
      toast.success("Branch status updated.");
    } catch (statusError) {
      const nextMessage = getErrorMessage(statusError);
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  }
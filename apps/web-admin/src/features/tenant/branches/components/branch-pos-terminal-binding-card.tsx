"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { LoaderCircle, Plus, SquareTerminal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

import type { PointOfSaleDevice } from "../../point-of-sale/types";
import type { BranchSummary } from "../types";

type BranchPosTerminalBindingCardProps = {
  branch: BranchSummary;
};

function terminalName(terminal: PointOfSaleDevice): string {
  return terminal.label || terminal.deviceId;
}

export function BranchPosTerminalBindingCard({
  branch,
}: BranchPosTerminalBindingCardProps) {
  const { m } = useTenantI18n();
  const [terminals, setTerminals] = useState<PointOfSaleDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [binding, setBinding] = useState(false);

  const loadTerminals = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const result = await webAdminApi.tenant.posChannel.listDevices({ limit: 100 });
      setTerminals(result.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTerminals();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTerminals]);

  const boundTerminals = useMemo(
    () => terminals.filter((terminal) => terminal.branchId === branch.id),
    [branch.id, terminals],
  );
  const selectedTerminal = terminals.find(
    (terminal) => terminal.id === selectedTerminalId,
  );

  async function bindTerminal() {
    if (!selectedTerminal || binding) return;

    setBinding(true);
    try {
      await webAdminApi.pos.terminalAuth.updateDevice(selectedTerminal.deviceId, {
        branchId: branch.id,
        reason: `Bound from the branch details page to ${branch.name}.`,
      });
      toast.success(m.branches.detail.posTerminals.bound);
      setDialogOpen(false);
      setSelectedTerminalId("");
      await loadTerminals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.common.requestFailed);
    } finally {
      setBinding(false);
    }
  }

  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid gap-3 py-5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="font-medium">{m.branches.detail.posTerminals.title}</p>
            <p className="text-xs text-muted-foreground">
              {m.branches.detail.posTerminals.description}
            </p>
          </div>
          <Icon aria-hidden icon={SquareTerminal} size={17} />
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">
            {m.branches.detail.posTerminals.loading}
          </p>
        ) : loadError ? (
          <p className="text-xs text-destructive">
            {m.branches.detail.posTerminals.loadError}
          </p>
        ) : boundTerminals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {m.branches.detail.posTerminals.empty}
          </p>
        ) : (
          <div className="grid gap-2">
            {boundTerminals.map((terminal) => (
              <div
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2"
                key={terminal.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {terminalName(terminal)}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {terminal.deviceId}
                  </p>
                </div>
                <Badge variant={terminal.status === "active" ? "default" : "secondary"}>
                  {m.common.statusLabels[terminal.status] ?? terminal.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {m.branches.detail.posTerminals.bindHint}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-8 text-xs"
            disabled={loading || loadError}
            onClick={() => setDialogOpen(true)}
            size="sm"
            type="button"
          >
            <Icon aria-hidden icon={Plus} size={14} />
            {m.branches.detail.posTerminals.bind}
          </Button>
          <Button asChild className="h-8 text-xs" size="sm" type="button" variant="outline">
            <Link href={webAdminRoutes.tenant.pointOfSale.devices}>
              {m.branches.detail.posTerminals.manage}
            </Link>
          </Button>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.branches.detail.posTerminals.dialogTitle}</DialogTitle>
            <DialogDescription>
              {m.branches.detail.posTerminals.dialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="branch-terminal-select">
              {m.branches.detail.posTerminals.selectLabel}
            </Label>
            <Select onValueChange={setSelectedTerminalId} value={selectedTerminalId}>
              <SelectTrigger id="branch-terminal-select">
                <SelectValue
                  placeholder={m.branches.detail.posTerminals.selectPlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {terminals.map((terminal) => (
                  <SelectItem key={terminal.id} value={terminal.id}>
                    {terminalName(terminal)} · {m.branches.detail.posTerminals.currentBranch}
                    {terminal.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDialogOpen(false)} type="button" variant="outline">
              {m.common.cancel}
            </Button>
            <Button
              disabled={!selectedTerminalId || binding}
              onClick={() => void bindTerminal()}
              type="button"
            >
              {binding ? <Icon aria-hidden className="animate-spin" icon={LoaderCircle} size={14} /> : null}
              {binding
                ? m.branches.detail.posTerminals.binding
                : m.branches.detail.posTerminals.bind}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

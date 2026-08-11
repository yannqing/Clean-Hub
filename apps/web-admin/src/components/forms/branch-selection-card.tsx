"use client";

import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
} from "@cleanhub/ui";
import { Search, SlidersHorizontal, Store } from "lucide-react";
import { useMemo, useState } from "react";

export type BranchSelectionOption = {
  id: string;
  name: string;
  address?: string | null;
  badge?: string;
};

type BranchSelectionCardProps = {
  allBranchesLabel: string;
  branches: BranchSelectionOption[];
  cancelLabel: string;
  confirmLabel: string;
  dialogDescription: string;
  emptyLabel: string;
  errorMessage?: string;
  idPrefix: string;
  loadFailed?: boolean;
  loadFailedMessage: string;
  manageLabel: string;
  noMatchingBranchesLabel: string;
  onSelectionChange: (selectedBranchIds: string[]) => void;
  searchPlaceholder: string;
  selectedBranchIds: string[];
  selectedCountTemplate: string;
  title: string;
};

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function formatSelectedCount(
  template: string,
  selected: number,
  total: number,
) {
  return template
    .replace("{selected}", String(selected))
    .replace("{total}", String(total));
}

export function BranchSelectionCard({
  allBranchesLabel,
  branches,
  cancelLabel,
  confirmLabel,
  dialogDescription,
  emptyLabel,
  errorMessage,
  idPrefix,
  loadFailed = false,
  loadFailedMessage,
  manageLabel,
  noMatchingBranchesLabel,
  onSelectionChange,
  searchPlaceholder,
  selectedBranchIds,
  selectedCountTemplate,
  title,
}: BranchSelectionCardProps) {
  const selectedBranchIdSet = useMemo(
    () => new Set(selectedBranchIds),
    [selectedBranchIds],
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftSelectedBranchIds, setDraftSelectedBranchIds] = useState<
    Set<string>
  >(() => new Set(selectedBranchIds));
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim().toLowerCase();
  const filteredBranches = useMemo(
    () =>
      normalizedSearch
        ? branches.filter(
            (branch) =>
              branch.name.toLowerCase().includes(normalizedSearch) ||
              branch.address?.toLowerCase().includes(normalizedSearch),
          )
        : branches,
    [branches, normalizedSearch],
  );
  const selectedCount = selectedBranchIdSet.size;
  const draftSelectedCount = draftSelectedBranchIds.size;
  const allBranchesSelected =
    branches.length > 0 && selectedCount === branches.length;
  const draftAllBranchesSelected =
    branches.length > 0 && draftSelectedCount === branches.length;
  const draftSelectionState =
    draftSelectedCount === 0
      ? false
      : draftAllBranchesSelected
        ? true
        : "indeterminate";
  const selectedCountCopy = formatSelectedCount(
    selectedCountTemplate,
    selectedCount,
    branches.length,
  );

  function openDialog() {
    setDraftSelectedBranchIds(new Set(selectedBranchIds));
    setSearch("");
    setDialogOpen(true);
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      openDialog();
      return;
    }

    setDialogOpen(false);
  }

  function handleAllBranchesChange(checked: boolean | "indeterminate") {
    setDraftSelectedBranchIds(
      checked === true
        ? new Set(branches.map((branch) => branch.id))
        : new Set(),
    );
  }

  function handleBranchChange(
    branchId: string,
    checked: boolean | "indeterminate",
  ) {
    setDraftSelectedBranchIds((current) => {
      const next = new Set(current);

      if (checked === true) {
        next.add(branchId);
      } else {
        next.delete(branchId);
      }

      return next;
    });
  }

  function confirmSelection() {
    if (!setsEqual(selectedBranchIdSet, draftSelectedBranchIds)) {
      onSelectionChange(
        branches
          .filter((branch) => draftSelectedBranchIds.has(branch.id))
          .map((branch) => branch.id),
      );
    }

    setDialogOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      <Card className="gap-0 rounded-lg py-0 shadow-none">
        <CardContent className="grid gap-3 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{title}</p>
            {!loadFailed && branches.length > 0 ? (
              <Button
                aria-label={manageLabel}
                onClick={openDialog}
                size="icon-sm"
                title={manageLabel}
                type="button"
                variant="ghost"
              >
                <Icon aria-hidden icon={SlidersHorizontal} size={14} />
              </Button>
            ) : null}
          </div>

          {loadFailed ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {loadFailedMessage}
            </p>
          ) : branches.length === 0 ? (
            <p className="rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            <button
              className="flex w-full items-center gap-2 rounded-md py-1 text-left text-sm transition-colors hover:text-foreground"
              onClick={openDialog}
              type="button"
            >
              <Icon
                aria-hidden
                className="shrink-0 text-muted-foreground"
                icon={Store}
                size={15}
              />
              <span className="truncate font-medium">
                {allBranchesSelected ? allBranchesLabel : selectedCountCopy}
              </span>
            </button>
          )}

          {errorMessage ? (
            <p className="text-xs text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <DialogContent className="h-[min(620px,calc(100vh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="text-base">{manageLabel}</DialogTitle>
          <DialogDescription className="sr-only">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="relative mb-4">
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={15}
            />
            <Input
              aria-label={searchPlaceholder}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              value={search}
            />
          </div>

          <div className="overflow-hidden rounded-lg border">
            <label
              className="flex cursor-pointer items-center justify-between gap-3 bg-muted/50 px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
              htmlFor={`${idPrefix}-all-branches`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                  icon={Store}
                  size={15}
                />
                <span className="truncate">{allBranchesLabel}</span>
              </span>
              <Checkbox
                checked={draftSelectionState}
                id={`${idPrefix}-all-branches`}
                onCheckedChange={handleAllBranchesChange}
              />
            </label>

            <div className="max-h-[360px] overflow-y-auto">
              {filteredBranches.length > 0 ? (
                filteredBranches.map((branch) => (
                  <label
                    className="flex cursor-pointer items-center justify-between gap-3 border-t px-3 py-3 text-sm transition-colors hover:bg-muted/40"
                    htmlFor={`${idPrefix}-branch-${branch.id}`}
                    key={branch.id}
                  >
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                          {branch.name}
                        </span>
                        {branch.badge ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {branch.badge}
                          </span>
                        ) : null}
                      </span>
                      {branch.address ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {branch.address}
                        </span>
                      ) : null}
                    </span>
                    <Checkbox
                      checked={draftSelectedBranchIds.has(branch.id)}
                      id={`${idPrefix}-branch-${branch.id}`}
                      onCheckedChange={(checked) =>
                        handleBranchChange(branch.id, checked)
                      }
                    />
                  </label>
                ))
              ) : (
                <p className="border-t px-3 py-8 text-center text-sm text-muted-foreground">
                  {noMatchingBranchesLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {formatSelectedCount(
              selectedCountTemplate,
              draftSelectedCount,
              branches.length,
            )}
          </p>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {cancelLabel}
              </Button>
            </DialogClose>
            <Button
              disabled={draftSelectedCount === 0}
              onClick={confirmSelection}
              type="button"
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

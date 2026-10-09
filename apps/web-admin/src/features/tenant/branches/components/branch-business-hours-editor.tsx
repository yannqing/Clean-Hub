"use client";

import { Checkbox, Input, Label } from "@cleanhub/ui";

import { useTenantI18n } from "@/i18n";

import { branchWeekdays } from "../constants";
import type {
  BranchBusinessDayFormValues,
  BranchBusinessHoursFormValues,
  BranchWeekday,
} from "../types";

type BranchBusinessHoursEditorProps = {
  disabled?: boolean;
  error?: string;
  onChange: (value: BranchBusinessHoursFormValues) => void;
  value: BranchBusinessHoursFormValues;
};

export function BranchBusinessHoursEditor({
  disabled = false,
  error,
  onChange,
  value,
}: BranchBusinessHoursEditorProps) {
  const { m } = useTenantI18n();

  function updateDay(
    weekday: BranchWeekday,
    patch: Partial<BranchBusinessDayFormValues>,
  ) {
    onChange({
      ...value,
      [weekday]: { ...value[weekday], ...patch },
    });
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label>{m.branches.create.fields.businessHours}</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {m.branches.create.businessHoursDescription}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {branchWeekdays.map((weekday) => {
          const day = value[weekday];

          return (
            <div
              className="grid min-h-14 grid-cols-[minmax(7rem,1fr)_minmax(0,1.5fr)] items-center gap-3 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]"
              key={weekday}
            >
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={day.enabled}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    updateDay(weekday, { enabled: checked === true })
                  }
                />
                {m.branches.create.weekdayLabels[weekday]}
              </label>

              {day.enabled ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    aria-label={`${m.branches.create.weekdayLabels[weekday]} ${m.branches.create.opensAt}`}
                    disabled={disabled}
                    onChange={(event) =>
                      updateDay(weekday, { opensAt: event.target.value })
                    }
                    type="time"
                    value={day.opensAt}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    aria-label={`${m.branches.create.weekdayLabels[weekday]} ${m.branches.create.closesAt}`}
                    disabled={disabled}
                    onChange={(event) =>
                      updateDay(weekday, { closesAt: event.target.value })
                    }
                    type="time"
                    value={day.closesAt}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {m.branches.create.closed}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

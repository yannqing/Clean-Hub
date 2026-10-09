import type { BranchBusinessHours } from "@cleanhub/api-client";

import { branchWeekdays, createEmptyBranchBusinessHours } from "./constants";
import type { BranchBusinessHoursFormValues } from "./types";

export function toBranchBusinessHoursFormValues(
  businessHours: BranchBusinessHours | null,
): BranchBusinessHoursFormValues {
  const values = createEmptyBranchBusinessHours();

  for (const weekday of branchWeekdays) {
    const hours = businessHours?.[weekday];

    if (hours) {
      values[weekday] = {
        enabled: true,
        opensAt: hours.opensAt,
        closesAt: hours.closesAt,
      };
    }
  }

  return values;
}

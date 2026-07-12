"use client";

import { useTenantI18n } from "@/i18n";

type TemplateVariablesHintProps = {
  /** Variable tokens to surface for the row's event, e.g. `["{{order_code}}"]`. */
  variables: string[];
};

/**
 * Inline hint listing the variables a tenant may interpolate into the matching
 * provider template body. Rendered under each row of the templates table.
 */
export function TemplateVariablesHint({ variables }: TemplateVariablesHintProps) {
  const { m } = useTenantI18n();

  if (variables.length === 0) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      <span className="font-medium">{m.notifications.templateVariables.title}:</span>{" "}
      {m.notifications.templateVariables.availableVars}{" "}
      {variables.map((token) => (
        <code
          className="ml-1 rounded bg-muted px-1 py-0.5 font-mono"
          key={token}
        >
          {token}
        </code>
      ))}
    </p>
  );
}

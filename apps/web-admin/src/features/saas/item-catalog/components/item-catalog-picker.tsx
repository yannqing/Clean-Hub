"use client";

import type {
  PlatformServiceItemGroup,
  TenantItemCatalogSelection,
} from "@cleanhub/api-client";
import { serviceCatalogText } from "@cleanhub/domain/service-item-catalog";
import { Button, Checkbox } from "@cleanhub/ui";
import { itemCatalogCopy } from "../copy";

export function allActiveCatalogItems(
  groups: PlatformServiceItemGroup[],
): TenantItemCatalogSelection {
  const active = groups.filter(
    (group) => group.enabled && group.items.some((item) => item.enabled),
  );
  return {
    itemTypes: active.map((group) => group.itemType),
    itemIds: active.flatMap((group) =>
      group.items.filter((item) => item.enabled).map((item) => item.id),
    ),
  };
}
export function normalizeCatalogSelection(
  groups: PlatformServiceItemGroup[],
  selection: TenantItemCatalogSelection | null,
): TenantItemCatalogSelection {
  const active = allActiveCatalogItems(groups);
  if (!selection) return active;
  const itemIds = selection.itemIds.filter(
    (id) =>
      active.itemIds.includes(id) &&
      groups.some(
        (group) =>
          selection.itemTypes.includes(group.itemType) &&
          group.items.some((item) => item.id === id),
      ),
  );
  return {
    itemTypes: selection.itemTypes.filter((code) =>
      groups.some(
        (group) =>
          group.enabled &&
          group.itemType === code &&
          group.items.some((item) => itemIds.includes(item.id)),
      ),
    ),
    itemIds,
  };
}

export function ItemCatalogPicker({
  groups,
  selection,
  onChange,
  disabled = false,
  locale,
}: {
  groups: PlatformServiceItemGroup[];
  selection: TenantItemCatalogSelection;
  onChange: (next: TenantItemCatalogSelection) => void;
  disabled?: boolean;
  locale: string;
}) {
  const c = itemCatalogCopy(locale);
  function changeArticle(
    group: PlatformServiceItemGroup,
    itemId: string,
    checked: boolean,
  ) {
    const itemIds = checked
      ? [...new Set([...selection.itemIds, itemId])]
      : selection.itemIds.filter((id) => id !== itemId);
    const hasItems = group.items.some((item) => itemIds.includes(item.id));
    const itemTypes = hasItems
      ? [...new Set([...selection.itemTypes, group.itemType])]
      : selection.itemTypes.filter((code) => code !== group.itemType);
    onChange({ itemTypes, itemIds });
  }
  return (
    <div className="space-y-3" data-testid="item-catalog-picker">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(allActiveCatalogItems(groups))}
        >
          {c.all}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange({ itemTypes: [], itemIds: [] })}
        >
          {c.clear}
        </Button>
        <span className="text-xs text-muted-foreground">
          {c.selected}: {selection.itemIds.length}
        </span>
      </div>
      {groups.map((group) => {
        const articles = group.items.filter((item) => item.enabled);
        const count = articles.filter((item) =>
          selection.itemIds.includes(item.id),
        ).length;
        return (
          <div
            key={group.id}
            className="rounded-lg border p-4"
            data-testid={`catalog-group-${group.itemType}`}
          >
            <label className="flex min-h-9 items-center gap-3 font-medium">
              <Checkbox
                checked={
                  count > 0 && count < articles.length
                    ? "indeterminate"
                    : count > 0
                }
                disabled={disabled || !group.enabled || !articles.length}
                onCheckedChange={(value) => {
                  const rest = selection.itemIds.filter(
                    (id) => !group.items.some((item) => item.id === id),
                  );
                  onChange({
                    itemTypes:
                      value === true
                        ? [...new Set([...selection.itemTypes, group.itemType])]
                        : selection.itemTypes.filter(
                            (code) => code !== group.itemType,
                          ),
                    itemIds:
                      value === true
                        ? [...rest, ...articles.map((item) => item.id)]
                        : rest,
                  });
                }}
              />
              {serviceCatalogText(group.names, locale)}{" "}
              <span className="ml-auto text-xs text-muted-foreground">
                {group.enabled ? `${count}/${articles.length}` : c.inactive}
              </span>
            </label>
            {serviceCatalogText(group.descriptions, locale) ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {serviceCatalogText(group.descriptions, locale)}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {articles.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-10 items-start gap-2 rounded-md bg-muted/35 p-2 text-sm"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selection.itemIds.includes(item.id)}
                    disabled={disabled || !group.enabled}
                    onCheckedChange={(value) =>
                      changeArticle(group, item.id, value === true)
                    }
                  />
                  <span>
                    {serviceCatalogText(item.names, locale)}
                    {serviceCatalogText(item.descriptions, locale) ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {serviceCatalogText(item.descriptions, locale)}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {!selection.itemIds.length ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {c.none}
        </p>
      ) : null}
    </div>
  );
}

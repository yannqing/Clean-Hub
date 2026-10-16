"use client";

import type {
  CreateTenantProductCategoryAttribute,
  TenantProductCategoryAttributeDefinition,
  TenantProductCategoryAttributeOption,
} from "@cleanhub/api-client";
import {
  Button,
  Checkbox,
  Icon,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";
import { ChevronDown, LoaderCircle, Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useTenantI18n } from "@/i18n";

export type CategoryMetafieldsLoadState =
  | "idle"
  | "loading"
  | "loaded"
  | "error";

type CategoryMetafieldsEditorProps = {
  definitions: TenantProductCategoryAttributeDefinition[];
  disabled?: boolean;
  error?: string;
  invalidDefinitionIds?: ReadonlySet<string>;
  loadState: CategoryMetafieldsLoadState;
  onChange: (values: CreateTenantProductCategoryAttribute[]) => void;
  onRetry?: () => void;
  values: CreateTenantProductCategoryAttribute[];
};

function getTranslatedLabel(
  translations: Record<string, string>,
  code: string,
  fallback: string,
): string {
  return translations[code] || fallback;
}

function isTextAttribute(
  value: CreateTenantProductCategoryAttribute,
): value is Extract<
  CreateTenantProductCategoryAttribute,
  { textValue: string }
> {
  return typeof value.textValue === "string";
}

function createEmptyAttribute(
  definition: TenantProductCategoryAttributeDefinition,
): CreateTenantProductCategoryAttribute {
  return definition.valueType === "text"
    ? { definitionId: definition.id, textValue: "" }
    : { definitionId: definition.id, optionIds: [] };
}

export function CategoryMetafieldsEditor({
  definitions,
  disabled = false,
  error,
  invalidDefinitionIds = new Set<string>(),
  loadState,
  onChange,
  onRetry,
  values,
}: CategoryMetafieldsEditorProps) {
  const { m } = useTenantI18n();
  const [announcement, setAnnouncement] = useState("");
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const definitionById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );
  const selectedDefinitionIds = useMemo(
    () => new Set(values.map((value) => value.definitionId)),
    [values],
  );
  const availableDefinitions = definitions.filter(
    (definition) => !selectedDefinitionIds.has(definition.id),
  );

  function getDefinitionLabel(
    definition: TenantProductCategoryAttributeDefinition,
  ) {
    return getTranslatedLabel(
      m.products.create.taxonomy.attributes,
      definition.code,
      definition.name,
    );
  }

  function getOptionLabel(option: TenantProductCategoryAttributeOption) {
    return getTranslatedLabel(
      m.products.create.taxonomy.options,
      option.code,
      option.label,
    );
  }

  function replaceValue(
    definitionId: string,
    nextValue: CreateTenantProductCategoryAttribute,
  ) {
    onChange(
      values.map((value) =>
        value.definitionId === definitionId ? nextValue : value,
      ),
    );
  }

  function addAttribute(definition: TenantProductCategoryAttributeDefinition) {
    if (selectedDefinitionIds.has(definition.id) || values.length >= 30) {
      return;
    }

    const label = getDefinitionLabel(definition);
    onChange([...values, createEmptyAttribute(definition)]);
    setAnnouncement(
      m.products.create.categoryMetafields.added.replace("{name}", label),
    );
    window.requestAnimationFrame(() => {
      fieldsetRef.current
        ?.querySelector<HTMLElement>(
          `[data-category-attribute-control="${definition.id}"]`,
        )
        ?.focus();
    });
  }

  function removeAttribute(
    definition: TenantProductCategoryAttributeDefinition,
  ) {
    if (definition.required) {
      return;
    }

    const label = getDefinitionLabel(definition);
    onChange(values.filter((value) => value.definitionId !== definition.id));
    setAnnouncement(
      m.products.create.categoryMetafields.removed.replace("{name}", label),
    );
  }

  function toggleMultiSelectOption(
    definitionId: string,
    optionId: string,
    checked: boolean | "indeterminate",
  ) {
    const current = values.find((value) => value.definitionId === definitionId);
    const currentIds =
      current && !isTextAttribute(current) ? current.optionIds : [];
    const nextIds =
      checked === true
        ? [...new Set([...currentIds, optionId])]
        : currentIds.filter((id) => id !== optionId);

    replaceValue(definitionId, { definitionId, optionIds: nextIds });
  }

  function renderControl(
    definition: TenantProductCategoryAttributeDefinition,
    value: CreateTenantProductCategoryAttribute,
  ) {
    const label = getDefinitionLabel(definition);
    const invalid = invalidDefinitionIds.has(definition.id);
    const errorId = `category-attribute-${definition.id}-error`;

    if (definition.valueType === "text") {
      return (
        <Input
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid}
          data-category-attribute-control={definition.id}
          disabled={disabled}
          id={`category-attribute-${definition.id}`}
          maxLength={1_000}
          onChange={(event) =>
            replaceValue(definition.id, {
              definitionId: definition.id,
              textValue: event.target.value,
            })
          }
          placeholder={m.products.create.categoryMetafields.textPlaceholder}
          value={isTextAttribute(value) ? value.textValue : ""}
        />
      );
    }

    const selectedOptionIds = isTextAttribute(value) ? [] : value.optionIds;

    if (definition.valueType === "single_select") {
      return (
        <Select
          disabled={disabled}
          onValueChange={(optionId) =>
            replaceValue(definition.id, {
              definitionId: definition.id,
              optionIds: [optionId],
            })
          }
          value={selectedOptionIds[0]}
        >
          <SelectTrigger
            aria-describedby={invalid ? errorId : undefined}
            aria-invalid={invalid}
            aria-label={`${label} ${m.products.create.categoryMetafields.chooseValue}`}
            className="w-full"
            data-category-attribute-control={definition.id}
            id={`category-attribute-${definition.id}`}
          >
            <SelectValue
              placeholder={m.products.create.categoryMetafields.chooseValue}
            />
          </SelectTrigger>
          <SelectContent>
            {definition.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {getOptionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    const selectedOptions = definition.options.filter((option) =>
      selectedOptionIds.includes(option.id),
    );

    return (
      <div className="grid gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid}
              aria-label={`${label} ${m.products.create.categoryMetafields.chooseValues}`}
              className="h-auto min-h-9 w-full justify-between px-3 py-2 font-normal"
              data-category-attribute-control={definition.id}
              disabled={disabled}
              id={`category-attribute-${definition.id}`}
              type="button"
              variant="outline"
            >
              <span className="min-w-0 truncate text-left">
                {selectedOptions.length > 0
                  ? selectedOptions.map(getOptionLabel).join(", ")
                  : m.products.create.categoryMetafields.chooseValues}
              </span>
              <Icon
                aria-hidden
                className="shrink-0 text-muted-foreground"
                icon={ChevronDown}
                size={14}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <div
              aria-label={label}
              className="max-h-64 space-y-1 overflow-y-auto"
              role="group"
            >
              {definition.options.length > 0 ? (
                definition.options.map((option) => {
                  const optionLabel = getOptionLabel(option);
                  const checkboxId = `category-attribute-${definition.id}-option-${option.id}`;

                  return (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60"
                      htmlFor={checkboxId}
                      key={option.id}
                    >
                      <Checkbox
                        checked={selectedOptionIds.includes(option.id)}
                        id={checkboxId}
                        onCheckedChange={(checked) =>
                          toggleMultiSelectOption(
                            definition.id,
                            option.id,
                            checked,
                          )
                        }
                      />
                      <span className="min-w-0 truncate">{optionLabel}</span>
                    </label>
                  );
                })
              ) : (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {m.products.create.categoryMetafields.noOptions}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {selectedOptions.length > 0 ? (
          <div
            aria-label={m.products.create.categoryMetafields.selectedValues}
            className="flex flex-wrap gap-1.5"
          >
            {selectedOptions.map((option) => (
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                key={option.id}
              >
                {getOptionLabel(option)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <fieldset
      aria-describedby={error ? "category-attributes-error" : undefined}
      className="grid gap-4"
      disabled={disabled}
      ref={fieldsetRef}
    >
      <legend className="sr-only">
        {m.products.create.fields.categoryMetafields}
      </legend>

      {loadState === "loading" ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Icon
            aria-hidden
            className="animate-spin"
            icon={LoaderCircle}
            size={15}
          />
          {m.products.create.categoryMetafields.loading}
        </p>
      ) : loadState === "error" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive" role="alert">
            {m.products.create.categoryMetafields.loadFailed}
          </p>
          {onRetry ? (
            <Button
              disabled={disabled}
              onClick={onRetry}
              size="sm"
              type="button"
              variant="outline"
            >
              {m.products.create.categoryMetafields.retry}
            </Button>
          ) : null}
        </div>
      ) : loadState === "loaded" && definitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {m.products.create.categoryMetafields.noAttributes}
        </p>
      ) : (
        <>
          {values.length > 0 ? (
            <div className="grid gap-3">
              {values.map((value) => {
                const definition = definitionById.get(value.definitionId);

                if (!definition) {
                  return null;
                }

                const label = getDefinitionLabel(definition);
                const invalid = invalidDefinitionIds.has(definition.id);
                const errorId = `category-attribute-${definition.id}-error`;

                return (
                  <div
                    className="grid gap-2 rounded-md border p-3 sm:grid-cols-[140px_minmax(0,1fr)_32px] sm:items-start"
                    key={definition.id}
                  >
                    <Label
                      className="pt-2 text-sm"
                      htmlFor={`category-attribute-${definition.id}`}
                    >
                      {label}
                      {definition.required ? (
                        <>
                          <span aria-hidden className="text-destructive">
                            {" "}
                            *
                          </span>
                          <span className="sr-only">
                            {" "}
                            {m.products.create.categoryMetafields.required}
                          </span>
                        </>
                      ) : null}
                    </Label>

                    <div className="grid min-w-0 gap-1.5">
                      {renderControl(definition, value)}
                      {invalid ? (
                        <p
                          className="text-xs text-destructive"
                          id={errorId}
                          role="alert"
                        >
                          {
                            m.products.create.validation
                              .categoryAttributeValueRequired
                          }
                        </p>
                      ) : null}
                    </div>

                    {definition.required ? (
                      <span aria-hidden className="size-8" />
                    ) : (
                      <Button
                        aria-label={m.products.create.categoryMetafields.remove.replace(
                          "{name}",
                          label,
                        )}
                        disabled={disabled}
                        onClick={() => removeAttribute(definition)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Icon aria-hidden icon={X} size={14} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {availableDefinitions.length > 0 ? (
            <div className={values.length > 0 ? "border-t pt-4" : undefined}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {m.products.create.categoryMetafields.recommended}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableDefinitions.map((definition) => {
                  const label = getDefinitionLabel(definition);

                  return (
                    <button
                      aria-label={m.products.create.categoryMetafields.add.replace(
                        "{name}",
                        label,
                      )}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={disabled || values.length >= 30}
                      key={definition.id}
                      onClick={() => addAttribute(definition)}
                      type="button"
                    >
                      <Icon aria-hidden icon={Plus} size={12} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p
          className="text-xs text-destructive"
          id="category-attributes-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  );
}

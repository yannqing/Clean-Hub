"use client";

import { Button, Checkbox, Input, Label, toast } from "@cleanhub/ui";
import { useState, type FormEvent } from "react";

import { useSaasI18n } from "@/i18n";
import { updateSecuritySettingsAction } from "../actions";
import { securitySettingsDefaultValues } from "../constants";
import type {
  SecuritySettings,
  SecuritySettingsFormValues,
} from "../types";

type SecuritySettingsFormProps = {
  initialValues?: SecuritySettingsFormValues;
  onUpdated: (settings: SecuritySettings) => void;
};

function toNumber(value: string): number {
  return value === "" ? Number.NaN : Number(value);
}

export function SecuritySettingsForm({
  initialValues = securitySettingsDefaultValues,
  onUpdated,
}: SecuritySettingsFormProps) {
  const { m } = useSaasI18n();
  const [values, setValues] =
    useState<SecuritySettingsFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  function updateValue(
    key: keyof SecuritySettingsFormValues,
    value: number | boolean,
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const result = await updateSecuritySettingsAction(values);

    if (result.ok) {
      toast.success(m.security.settings.saveSuccess);
      setValues({
        passwordMinLength: result.data.passwordMinLength,
        passwordRequiresNumber: result.data.passwordRequiresNumber,
        passwordRequiresSymbol: result.data.passwordRequiresSymbol,
        loginMaxAttempts: result.data.loginMaxAttempts,
        lockoutMinutes: result.data.lockoutMinutes,
        refreshTokenDays: result.data.refreshTokenDays,
      });
      onUpdated(result.data);
    } else {
      toast.error(result.error);
    }

    setSubmitting(false);
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">{m.security.settings.title}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="password-min-length">
            {m.security.settings.passwordMinLength}
          </Label>
          <Input
            id="password-min-length"
            min={6}
            onChange={(event) =>
              updateValue("passwordMinLength", toNumber(event.target.value))
            }
            type="number"
            value={Number.isNaN(values.passwordMinLength)
              ? ""
              : values.passwordMinLength}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="login-max-attempts">
            {m.security.settings.loginMaxAttempts}
          </Label>
          <Input
            id="login-max-attempts"
            min={1}
            onChange={(event) =>
              updateValue("loginMaxAttempts", toNumber(event.target.value))
            }
            type="number"
            value={Number.isNaN(values.loginMaxAttempts)
              ? ""
              : values.loginMaxAttempts}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lockout-minutes">{m.security.settings.lockoutMinutes}</Label>
          <Input
            id="lockout-minutes"
            min={1}
            onChange={(event) =>
              updateValue("lockoutMinutes", toNumber(event.target.value))
            }
            type="number"
            value={Number.isNaN(values.lockoutMinutes)
              ? ""
              : values.lockoutMinutes}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="refresh-token-days">
            {m.security.settings.refreshTokenDays}
          </Label>
          <Input
            id="refresh-token-days"
            min={1}
            onChange={(event) =>
              updateValue("refreshTokenDays", toNumber(event.target.value))
            }
            type="number"
            value={Number.isNaN(values.refreshTokenDays)
              ? ""
              : values.refreshTokenDays}
          />
        </div>

        <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <Checkbox
            checked={values.passwordRequiresNumber}
            onCheckedChange={(checked) =>
              updateValue("passwordRequiresNumber", checked === true)
            }
          />
          {m.security.settings.requireNumber}
        </label>

        <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <Checkbox
            checked={values.passwordRequiresSymbol}
            onCheckedChange={(checked) =>
              updateValue("passwordRequiresSymbol", checked === true)
            }
          />
          {m.security.settings.requireSymbol}
        </label>
      </div>

      <div className="flex justify-end">
        <Button disabled={submitting} type="submit">
          {submitting ? m.common.saving : m.security.settings.saveSettings}
        </Button>
      </div>
    </form>
  );
}

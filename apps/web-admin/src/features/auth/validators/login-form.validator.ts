import { z } from "zod";

/**
 * Login form validation.
 *
 * The schema below is the single source of truth for the login form. It is
 * shared by the client (via `react-hook-form`'s `zodResolver`) and by the
 * server action (`loginAction` calls `loginFormSchema.safeParse`), so the same
 * rules run on both sides — which is the goal called out in AGENTS.md.
 *
 * Cross-field rule: `tenantCode` is only required when `loginMode === "tenant"`,
 * so it lives in a `superRefine` rather than on the field itself.
 */

export const LOGIN_MODES = ["platform", "tenant"] as const;
export type LoginMode = (typeof LOGIN_MODES)[number];

export type LoginValidationMessages = {
  identifierRequired: string;
  passwordRequired: string;
  tenantCodeRequired: string;
};

const defaultValidationMessages: LoginValidationMessages = {
  identifierRequired: "Email or phone is required.",
  passwordRequired: "Password is required.",
  tenantCodeRequired: "Store code is required for store login.",
};

export function createLoginFormSchema(
  messages: LoginValidationMessages = defaultValidationMessages,
) {
  return z
    .object({
      loginMode: z.enum(LOGIN_MODES),
      identifier: z.string().trim().min(1, messages.identifierRequired),
      password: z.string().min(1, messages.passwordRequired),
      tenantCode: z.string().trim(),
    })
    .superRefine((value, ctx) => {
      if (value.loginMode === "tenant" && !value.tenantCode) {
        ctx.addIssue({
          path: ["tenantCode"],
          code: z.ZodIssueCode.custom,
          message: messages.tenantCodeRequired,
        });
      }
    });
}

export const loginFormSchema = createLoginFormSchema();

/**
 * Form values derived from the schema. Components and the server action share
 * this type so the contract can never drift from the schema.
 */
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export type LoginFormField = keyof LoginFormValues;

/** Field-keyed error map, kept for the existing `{ ok, errors }` action shape. */
export type LoginFormFieldErrors = Partial<Record<LoginFormField, string>>;

/**
 * Parse the schema and collapse the result into the field-keyed error map used
 * by the rest of the auth feature. Returns `null` when there are no errors.
 *
 * This wraps `loginFormSchema.safeParse` so callers (the server action, and any
 * code path that is not a `react-hook-form` resolver) get the same
 * `LoginFormFieldErrors | null` shape they used to.
 */
export function validateLoginForm(
  values: LoginFormValues,
): LoginFormFieldErrors | null {
  const result = loginFormSchema.safeParse(values);

  if (result.success) {
    return null;
  }

  const errors: LoginFormFieldErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && field in values) {
      // Keep the first message per field; later issues for the same field lose.
      if (!errors[field as LoginFormField]) {
        errors[field as LoginFormField] = issue.message;
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

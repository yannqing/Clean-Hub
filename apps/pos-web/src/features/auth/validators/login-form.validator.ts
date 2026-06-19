export type LoginFormValues = {
  identifier: string;
  password: string;
};

export type LoginFormField = keyof LoginFormValues;

export type LoginFormFieldErrors = Partial<Record<LoginFormField, string>>;

export function validateLoginForm(
  values: LoginFormValues,
): LoginFormFieldErrors | null {
  const errors: LoginFormFieldErrors = {};

  if (!values.identifier.trim()) {
    errors.identifier = "请输入手机号或邮箱";
  }

  if (!values.password) {
    errors.password = "请输入密码";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export type TenantUserFormInput = {
  email: string;
  role: string;
  branchIds: string[];
};

export function validateTenantUserForm(
  input: TenantUserFormInput,
): TenantUserFormInput {
  return input;
}

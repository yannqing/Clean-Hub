export type TenantFormInput = {
  name: string;
  ownerEmail: string;
};

export function validateTenantForm(input: TenantFormInput): TenantFormInput {
  return input;
}

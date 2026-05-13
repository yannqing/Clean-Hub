export type SaasUserFormInput = {
  email: string;
  role: string;
};

export function validateSaasUserForm(
  input: SaasUserFormInput,
): SaasUserFormInput {
  return input;
}

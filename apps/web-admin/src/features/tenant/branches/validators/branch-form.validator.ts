export type BranchFormInput = {
  name: string;
  address?: string;
};

export function validateBranchForm(input: BranchFormInput): BranchFormInput {
  return input;
}

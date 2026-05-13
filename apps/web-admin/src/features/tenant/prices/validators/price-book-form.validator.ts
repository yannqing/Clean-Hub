export type PriceBookFormInput = {
  name: string;
  currency: string;
};

export function validatePriceBookForm(
  input: PriceBookFormInput,
): PriceBookFormInput {
  return input;
}

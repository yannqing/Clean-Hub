import { z } from "zod";

/**
 * A tax rate as the fraction every layer stores and displays: 0.18 is 18%.
 *
 * Bounded to [0, 1] rather than [0, 100]. The column allowed up to 100 and this
 * schema used to as well, which let a direct API call store `18` meaning 18% --
 * read back everywhere as 1800%.
 */
export const taxRateFractionSchema = z
  .string()
  .trim()
  .regex(/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/, {
    message: "Tax rate must be a fraction between 0 and 1, e.g. 0.18 for 18%.",
  });

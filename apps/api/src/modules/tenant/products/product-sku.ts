import { randomInt } from "node:crypto";

const SKU_CHARACTERS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateProductSkuCode(): string {
  return `SKU-${Array.from(
    { length: 10 },
    () => SKU_CHARACTERS[randomInt(SKU_CHARACTERS.length)],
  ).join("")}`;
}

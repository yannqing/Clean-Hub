import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              importNames: ["Table"],
              message:
                "Use DataTable from @cleanhub/ui/data-table so every admin table shares the same density and layout contract.",
              name: "@cleanhub/ui",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          message:
            "Use DataTable from @cleanhub/ui/data-table instead of a native table element.",
          selector: "JSXOpeningElement[name.name='table']",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;

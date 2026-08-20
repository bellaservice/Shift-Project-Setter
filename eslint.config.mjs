import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // DocMaker is the offline Electron builder this app's Arbetsdagbok is
    // ported from. It is vendored here as a reference, has its own toolchain,
    // and is not part of the Next.js app.
    "DocMaker/**",
  ]),
]);

export default eslintConfig;

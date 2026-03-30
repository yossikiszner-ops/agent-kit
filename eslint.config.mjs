import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  // ─── Ignore build output ─────────────────────────────────────────────────
  globalIgnores([".next/**", "out/**", "node_modules/**"]),

  // ─── JS baseline ─────────────────────────────────────────────────────────
  js.configs.recommended,

  // ─── Next.js + React + React Hooks rules ─────────────────────────────────
  ...nextVitals,

  // ─── Project rules ───────────────────────────────────────────────────────
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-var": "error",
      "prefer-const": "error",
      "no-duplicate-imports": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "@next/next/no-img-element": "error",
    },
  },

  // ─── Prettier last — disables conflicting format rules ───────────────────
  prettier,
]);

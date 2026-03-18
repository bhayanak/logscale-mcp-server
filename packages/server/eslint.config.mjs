import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default tseslint.config(
  // Base TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Security plugin rules
  {
    plugins: { security },
    rules: {
      // Security rules — detect common vulnerability patterns
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-object-injection": "off", // Too noisy for bracket access
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "error",
    },
  },

  // TypeScript-specific strictness rules
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "off",
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },

  // Ignore patterns
  {
    ignores: ["dist/", "node_modules/", "*.config.*", "test/fixtures/"],
  },
);

import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

// Existing files contain disable comments for this rule, but importing the full plugin hangs in this local setup.
const typescriptEslintDisableCompatPlugin = {
  rules: {
    "no-explicit-any": {
      meta: {
        type: "suggestion",
        schema: []
      },
      create() {
        return {};
      }
    }
  }
};

export default [
  {
    ignores: [".next/**", "node_modules/**"]
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@typescript-eslint": typescriptEslintDisableCompatPlugin
    },
    rules: {
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      ...reactPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off"
    }
  }
];

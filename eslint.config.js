import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default [
  {
    ignores: [
      "dist/",
      "node_modules/",
      "logs/",
      "worker-py/",
      ".tmp/",
      "*.config.js",
      "*.config.cjs",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        Bun: "readonly",
        File: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        Response: "readonly",
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
      jsdoc,
      "simple-import-sort": simpleImportSort,
    },

    rules: {
      ...tsPlugin.configs.recommended.rules,

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-duplicate-imports": "error",

      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "arrow-body-style": ["error", "as-needed"],
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
      ],

      "no-unused-expressions": "error",
      "no-implicit-coercion": "error",
      "no-throw-literal": "error",
      "no-useless-catch": "error",

      complexity: ["warn", 10],
      "max-lines-per-function": ["warn", 80],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
      "no-console": "warn",

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],

      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],

      "jsdoc/require-jsdoc": [
        "warn",
        {
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "ClassDeclaration",
            "MethodDefinition",
            "FunctionDeclaration",
          ],
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
          },
        },
      ],
      "jsdoc/require-description": "warn",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns-type": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];

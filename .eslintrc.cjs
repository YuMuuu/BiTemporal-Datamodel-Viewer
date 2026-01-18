module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended", "prettier"],
  plugins: ["@typescript-eslint"],
  ignorePatterns: ["node_modules/", "dist/", ".next/"],
  overrides: [
    {
      files: ["**/*.stories.@(ts|tsx|js|jsx)"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "import/no-anonymous-default-export": "off",
      },
    },
  ],
  rules: {
    // keep rules minimal; rely on presets
  },
};

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
    environment: "node",
    environmentMatchGlobs: [
      ["packages/dashboard/**", "jsdom"],
    ],
    globals: false,
  },
});

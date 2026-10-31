import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same meaning as "paths" in tsconfig.json, so "@/utils/date" works in tests.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Our first tests cover helpers and API routes, so no browser simulation is needed.
    environment: "node",
    // Only .test.ts files. The hook's .test.mjs file has its own runner.
    include: ["**/*.test.ts"],
  },
});

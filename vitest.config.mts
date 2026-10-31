import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { defineConfig } from "vitest/config";

// Finds a file relative to this config, wherever the command is run from.
const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Same meaning as "paths" in tsconfig.json, so "@/utils/date" works in tests.
    alias: { "@": fromRoot(".") },
  },
  test: {
    // Our first tests cover helpers and API routes, so no browser simulation is needed.
    environment: "node",
    // Only .test.ts files. The hook's .test.mjs file has its own runner.
    include: ["**/*.test.ts"],
    // Tests get the fake values from .env.test only. Do not use Vite's loadEnv here,
    // because it reads the real .env as well. parse() only reads the file it is given.
    env: parse(readFileSync(fromRoot(".env.test"))),
  },
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";

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
    // Tests get the fake values from .env.test only. Do not use Vite's loadEnv here,
    // because it reads the real .env as well. parse() only reads the file it is given.
    env: parse(readFileSync(fromRoot(".env.test"))),
    projects: [
      {
        // Needs no database, so "npm run test:unit" works without Docker.
        // Only .test.ts files: the hook's .test.mjs file has its own runner.
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.ts"],
          exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
        },
      },
      {
        // Files named .db.test.ts use the test database, after the guard in global setup.
        extends: true,
        test: {
          name: "db",
          include: ["**/*.db.test.ts"],
          globalSetup: ["test/global-setup.ts"],
        },
      },
    ],
  },
});

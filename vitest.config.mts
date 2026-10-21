import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // Importing src/lib/prisma.ts eagerly constructs a (lazily-connecting)
      // pg.Pool from DATABASE_URL — no real connection is attempted unless a
      // query actually runs, but the module throws at import time if the
      // var is entirely unset. Tests that need real query behavior mock
      // "@/lib/prisma" directly instead (see tests/messages.test.ts).
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The real package unconditionally throws outside Next.js's
      // "react-server" bundling condition, which Vitest doesn't set.
      // Server-only modules are exercised here with Prisma mocked (see
      // tests/messages.test.ts), not by actually running in a browser, so
      // the guard itself has nothing to protect in this context.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});

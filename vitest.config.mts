import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real "server-only" package throws outside RSC; unit tests stub it.
      "server-only": fileURLToPath(
        new URL("./tests/mocks/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Cold first runs load route handlers + Firebase Admin slowly.
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});

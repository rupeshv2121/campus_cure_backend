import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts"],
    // Tier 1 does no I/O; anything slower than this is a bug in the test.
    testTimeout: 10_000,
    restoreMocks: true,
  },
});

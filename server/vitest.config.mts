import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./tests/test-env.mts";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: TEST_ENV,
    globalSetup: ["tests/global-setup.ts"],
    // One database file, so test files run one after another.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});

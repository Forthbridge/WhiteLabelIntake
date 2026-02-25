import { defineConfig } from "@playwright/test";
import path from "path";

const authDir = path.resolve(__dirname, ".auth");

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["html"], ["list"]],
  globalSetup: path.resolve(__dirname, "global-setup.ts"),
  globalTeardown: path.resolve(__dirname, "global-teardown.ts"),
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "public",
      testMatch: /\/(global|auth)\/.+\.spec\.ts/,
      use: { browserName: "chromium" },
    },
    // Navigation tests run first (clean state, no form mutations)
    {
      name: "buyer-nav",
      testMatch: /\/onboarding\/navigation\/.+\.spec\.ts/,
      use: {
        browserName: "chromium",
        storageState: path.join(authDir, "buyer-admin.json"),
      },
    },
    // Form mutation tests run after nav tests
    {
      name: "buyer-admin",
      testMatch: /\/onboarding\/affiliate\/.+\.spec\.ts/,
      dependencies: ["buyer-nav"],
      use: {
        browserName: "chromium",
        storageState: path.join(authDir, "buyer-admin.json"),
      },
    },
    {
      name: "collaborator",
      testMatch: /\/collaborator\/.+\.spec\.ts/,
      use: {
        browserName: "chromium",
        storageState: path.join(authDir, "collaborator.json"),
      },
    },
    {
      name: "super-admin",
      testMatch: /\/admin\/.+\.spec\.ts/,
      use: {
        browserName: "chromium",
        storageState: path.join(authDir, "super-admin.json"),
      },
    },
    {
      name: "seller-admin",
      testMatch: /\/onboarding\/seller\/.+\.spec\.ts/,
      use: {
        browserName: "chromium",
        storageState: path.join(authDir, "seller-admin.json"),
      },
    },
    {
      name: "dual-role-admin",
      testMatch: /\/dual-role\/.+\.spec\.ts/,
      use: {
        browserName: "chromium",
        storageState: path.join(authDir, "dual-role-admin.json"),
      },
    },
  ],
});

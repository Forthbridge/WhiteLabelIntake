import { teardownTestData, disconnect } from "./fixtures/test-data";

async function globalTeardown() {
  console.log("[e2e] Running global teardown...");
  try {
    await teardownTestData();
  } finally {
    await disconnect();
  }
}

export default globalTeardown;

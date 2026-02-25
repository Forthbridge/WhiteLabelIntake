import { request } from "@playwright/test";
import { seedTestData, disconnect } from "./fixtures/test-data";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3000";

const PERSONAS = [
  { email: "e2e-superadmin@test.com", password: "TestPass123!", file: "super-admin.json" },
  { email: "e2e-buyer-admin@test.com", password: "TestPass123!", file: "buyer-admin.json" },
  { email: "e2e-collab@test.com", password: "TestPass123!", file: "collaborator.json" },
  { email: "e2e-seller-admin@test.com", password: "TestPass123!", file: "seller-admin.json" },
  { email: "e2e-dual@test.com", password: "TestPass123!", file: "dual-role-admin.json" },
];

async function authenticate(
  email: string,
  password: string,
  storageStatePath: string,
): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });

  // 1. Get CSRF token
  const csrfRes = await ctx.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // 2. Sign in via credentials callback
  await ctx.post("/api/auth/callback/credentials", {
    form: {
      email,
      password,
      csrfToken,
      json: "true",
    },
  });

  // 3. Save storage state (cookies)
  await ctx.storageState({ path: storageStatePath });
  await ctx.dispose();
}

async function globalSetup() {
  console.log("[e2e] Running global setup...");

  // Seed test data
  try {
    await seedTestData();
  } finally {
    await disconnect();
  }

  // Ensure .auth directory exists
  const authDir = path.resolve(__dirname, ".auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Authenticate all personas
  for (const persona of PERSONAS) {
    const storageStatePath = path.resolve(authDir, persona.file);
    await authenticate(persona.email, persona.password, storageStatePath);
    console.log(`[e2e] Authenticated ${persona.email} → ${persona.file}`);
  }
}

export default globalSetup;

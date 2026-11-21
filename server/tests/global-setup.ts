import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TEST_ENV } from "./test-env.mts";

const root = path.resolve(__dirname, "..");
const testDbFiles = ["test.db", "test.db-journal"].map((f) => path.join(root, "prisma", f));

/**
 * Builds a brand-new test database (prisma/test.db) by applying the real migrations to an empty file.
 * Only the test file is ever deleted; dev.db is never touched.
 */
export default function setup() {
  if (TEST_ENV.DATABASE_URL !== "file:./test.db") throw new Error("Refusing to use a database that isn't the test one");
  for (const f of testDbFiles) fs.rmSync(f, { force: true });
  execSync("npx prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_ENV.DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
  fs.mkdirSync(TEST_ENV.UPLOAD_DIR, { recursive: true });

  return () => {
    // Clean up uploaded test images and the test database after the run.
    fs.rmSync(TEST_ENV.UPLOAD_DIR, { recursive: true, force: true });
    for (const f of testDbFiles) fs.rmSync(f, { force: true });
  };
}

import os from "node:os";
import path from "node:path";

/** API tests run against a separate SQLite file (prisma/test.db), never the real dev.db. */
export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: "file:./test.db",
  JWT_SECRET: "test-secret-not-for-production",
  CLIENT_URL: "http://localhost:5173",
  UPLOAD_DIR: path.join(os.tmpdir(), "ppm-test-uploads"),
};

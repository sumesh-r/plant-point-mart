import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { badRequest } from "../lib/errors";

// UPLOAD_DIR can be overridden (the tests use a temporary folder).
export const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ALLOWED.get(file.mimetype)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(badRequest("Only JPG, PNG, WEBP or GIF images are allowed"));
  },
});

export const fileUrl = (filename: string) => `/uploads/${filename}`;

/** Delete a previously uploaded file given its public URL. Ignores remote URLs. */
export function removeUpload(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  fs.promises.unlink(file).catch(() => {});
}

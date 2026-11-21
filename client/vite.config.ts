import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Where the Express API runs in development. Override with API_URL if 4000 is taken.
const api = process.env.API_URL ?? "http://localhost:4000";
const proxy = { "/api": api, "/uploads": api };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});

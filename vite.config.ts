import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages trenger base-path = /repo-navn/
// Vi setter den via env i GitHub Actions (BASE_PATH)
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? "/",
});

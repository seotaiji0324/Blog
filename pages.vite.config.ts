import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "github-pages",
  base: "/Blog/",
  publicDir: "../public",
  resolve: {
    alias: {
      "next/image": fileURLToPath(new URL("./github-pages/next-image.tsx", import.meta.url)),
    },
  },
  plugins: [react()],
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve("github-pages/index.html"),
        admin: resolve("github-pages/admin/index.html"),
      },
    },
  },
});

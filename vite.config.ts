import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths + HashRouter: the build runs from any static host or sub-path without rewrites.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3020,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // The charts chunk (Recharts + lightweight-charts) is ~690 kB minified, ~205 kB gzipped.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          charts: ["recharts", "lightweight-charts"],
          web3: ["viem"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});

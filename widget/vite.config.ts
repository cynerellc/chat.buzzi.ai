import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

/**
 * Vite configuration for building the standalone chat widget
 *
 * Outputs:
 * - build/widget/embed.js (~2KB) - Tiny loader script for CDN
 * - build/widget/chat.js (~15KB gzipped) - Main Preact widget bundle
 * - build/widget/chat.css - Widget styles
 */
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // Map src paths
      "@": resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "../build/widget"),
    emptyOutDir: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: {
        embed: resolve(__dirname, "embed.ts"),
        chat: resolve(__dirname, "main.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name][extname]",
        manualChunks: undefined,
      },
    },
    target: "es2020",
    sourcemap: false,
  },
  css: {
    postcss: resolve(__dirname, "../postcss.config.mjs"),
  },
});

import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    // ─── Node.js ESM build (main entry) ────────────
    {
      format: "esm",
      source: {
        entry: {
          index: "./src/index.ts",
        },
      },
      output: {
        target: "node",
        distPath: {
          root: "./dist",
        },
        filename: {
          js: "[name].js",
        },
      },
      dts: {
        bundle: true,
      },
    },
    // ─── Node.js CJS build (main entry) ────────────
    {
      format: "cjs",
      source: {
        entry: {
          index: "./src/index.ts",
        },
      },
      output: {
        target: "node",
        distPath: {
          root: "./dist",
        },
        filename: {
          js: "[name].cjs",
        },
      },
      dts: {
        bundle: true,
      },
    },
    // ─── Browser ESM build (browser entry) ─────────
    {
      format: "esm",
      source: {
        entry: {
          browser: "./src/browser.ts",
        },
      },
      output: {
        target: "web",
        distPath: {
          root: "./dist",
        },
        filename: {
          js: "[name].js",
        },
      },
      dts: {
        bundle: true,
      },
    },
    // ─── CLI build ─────────────────────────────────
    {
      format: "esm",
      source: {
        entry: {
          "cli/generate-schema": "./src/cli/generate-schema.ts",
        },
      },
      output: {
        target: "node",
        distPath: {
          root: "./dist",
        },
        filename: {
          js: "[name].js",
        },
      },
    },
  ],
});

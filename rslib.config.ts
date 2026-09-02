import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    // ─── ESM build (main entry) ────────────
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
    // ─── CJS build (main entry) ────────────
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
  ],
});

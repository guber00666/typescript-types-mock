import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      output: {
        distPath: {
          root: "./dist",
        },
      },
      dts: {
        bundle: true,
      },
    },
    {
      format: "cjs",
      output: {
        distPath: {
          root: "./dist",
        },
      },
      dts: {
        bundle: true,
      },
    },
  ],
  source: {
    entry: {
      index: "./src/index.ts",
    },
  },
  output: {
    target: "node",
  },
});

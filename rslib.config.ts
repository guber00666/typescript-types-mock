import { defineConfig } from "@rslib/core";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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
      tools: {
        rspack: {
          plugins: [
            {
              name: "make-bin-executable",
              apply(compiler) {
                compiler.hooks.afterEmit.tap("MakeBinExecutable", () => {
                  const binPath = path.resolve("./dist/cli/generate-schema.js");
                  if (fs.existsSync(binPath)) {
                    // Add shebang if missing
                    const content = fs.readFileSync(binPath, "utf-8");
                    if (!content.startsWith("#!/usr/bin/env node")) {
                      fs.writeFileSync(binPath, "#!/usr/bin/env node\n" + content);
                    }
                    // Make executable
                    try {
                      execSync(`chmod +x "${binPath}"`, { stdio: "ignore" });
                    } catch {
                      // Ignore errors on Windows
                    }
                  }
                });
              },
            },
          ],
        },
      },
    },
  ],
});

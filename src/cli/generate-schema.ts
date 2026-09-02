#!/usr/bin/env node
/**
 * CLI tool for generating type schemas from TypeScript files.
 *
 * Usage:
 *   npx typescript-types-mock generate <input.ts> [-o output.json]
 *
 * This tool parses a .ts file using ts-morph and outputs a JSON schema
 * that can be used with the browser-safe API:
 *
 * ```bash
 * # Generate schema
 * npx typescript-types-mock generate ./types.ts -o ./types.schema.json
 *
 * # Use in browser code
 * import schema from "./types.schema.json";
 * import { createMockFromSchema } from "typescript-types-mock/browser";
 * const user = createMockFromSchema(schema, "User");
 * ```
 */

import { TypeResolver } from "../core/type-resolver.js";
import * as fs from "fs";
import * as path from "path";

function printHelp(): void {
  console.log(`
typescript-types-mock generate

Generate a JSON type schema from a TypeScript file for browser usage.

Usage:
  typescript-types-mock generate <input.ts> [options]

Options:
  -o, --output <file>   Output file path (default: <input>.schema.json)
  -h, --help            Show this help message
  --pretty              Pretty-print JSON output (default: minified)

Examples:
  typescript-types-mock generate ./src/types.ts
  typescript-types-mock generate ./src/types.ts -o ./public/types.schema.json
  typescript-types-mock generate ./src/types.ts --pretty
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  // Skip "generate" subcommand if present
  let fileArgs = args;
  if (fileArgs[0] === "generate") {
    fileArgs = fileArgs.slice(1);
  }

  if (fileArgs.length === 0) {
    printHelp();
    process.exit(0);
  }

  const inputFile = fileArgs[0]!;
  let outputFile: string | undefined;
  let pretty = false;

  for (let i = 1; i < fileArgs.length; i++) {
    const arg = fileArgs[i]!;
    if (arg === "-o" || arg === "--output") {
      outputFile = fileArgs[i + 1];
      i++;
    } else if (arg === "--pretty") {
      pretty = true;
    }
  }

  if (!outputFile) {
    const ext = path.extname(inputFile);
    outputFile = inputFile.replace(ext, "") + ".schema.json";
  }

  console.log(`📄 Input:  ${path.resolve(inputFile)}`);
  console.log(`📦 Output: ${path.resolve(outputFile)}`);

  try {
    const resolver = new TypeResolver(inputFile);
    const resolvedTypes = resolver.resolveAllTypes();
    const typeNames = Object.keys(resolvedTypes);

    console.log(`\n🔍 Found ${typeNames.length} type(s): ${typeNames.join(", ")}`);

    const json = pretty
      ? JSON.stringify(resolvedTypes, null, 2)
      : JSON.stringify(resolvedTypes);

    fs.writeFileSync(outputFile, json, "utf-8");
    console.log(`\n✅ Schema written to ${path.resolve(outputFile)}`);
    console.log(`   Size: ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
    console.log(`\n💡 Usage in browser:`);
    console.log(`   import schema from "./${path.basename(outputFile)}";`);
    console.log(`   import { createMockFromSchema } from "typescript-types-mock/browser";`);
    console.log(`   const mock = createMockFromSchema(schema, "${typeNames[0] ?? "TypeName"}");`);
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();

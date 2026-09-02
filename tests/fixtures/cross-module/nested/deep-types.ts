/**
 * Cross-module test fixture: types in a deeply nested directory.
 */

export interface NestedConfig {
  host: string;
  port: number;
  debug: boolean;
}

export type Environment = "dev" | "staging" | "production";

/**
 * Cross-module test fixture: circular dependency B.
 */
import { TypeA } from "./circular-a";

export interface TypeB {
  id: number;
  ref?: TypeA;
}

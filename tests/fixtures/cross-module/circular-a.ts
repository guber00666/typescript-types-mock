/**
 * Cross-module test fixture: circular dependency A.
 */
import { TypeB } from "./circular-b";

export interface TypeA {
  name: string;
  ref?: TypeB;
}

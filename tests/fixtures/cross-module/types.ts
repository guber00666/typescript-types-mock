/**
 * Cross-module test fixture: main entry file.
 * Imports types from local modules, re-exports, and nested directories.
 */

import { Address, Company, Priority } from "./models";
import { Address as ReExportedAddress } from "./reexport";
import { NestedConfig, Environment } from "./nested/deep-types";
import { TypeA } from "./circular-a";

// Uses imported types in properties
export interface Employee {
  name: string;
  age: number;
  company: Company;
  address: Address;
  priority: Priority;
}

// Uses type imported through re-export
export interface Office {
  location: ReExportedAddress;
  config: NestedConfig;
  env: Environment;
}

// Uses circular dependency type
export interface Project {
  title: string;
  owner: TypeA;
}

// Local type in the entry file
export interface LocalType {
  value: string;
  count: number;
}

/**
 * Cross-module test fixture: local model types.
 */

export interface Address {
  street: string;
  city: string;
  country: string;
  zipCode: string;
}

export interface Company {
  name: string;
  address: Address;
  employees: number;
}

export type Priority = "low" | "medium" | "high";

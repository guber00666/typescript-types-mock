/**
 * Sample TypeScript types used for testing the mock generator.
 */

// Simple interface
export interface User {
  name: string;
  age: number;
  isActive: boolean;
  email: string;
}

// Interface with optional properties
export interface Profile {
  username: string;
  bio?: string;
  avatar?: string;
  followers: number;
}

// Nested interface
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

// Interface extending another
export interface Admin extends User {
  role: string;
  permissions: string[];
}

// Type aliases
export type UserId = string;
export type Status = "active" | "inactive" | "pending";
export type Priority = 1 | 2 | 3;
export type Result = "pass" | "fail" | null;

// Union types
export type StringOrNumber = string | number;
export type NullableString = string | null;

// Array types
export type StringList = string[];
export type UserList = User[];

// Tuple types
export type Coordinate = [number, number];
export type NamedValue = [string, number, boolean];

// Intersection types
export type Timestamped = { createdAt: string; updatedAt: string };
export type TimestampedUser = User & Timestamped;

// Enum
export enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE",
}

export enum HttpStatus {
  OK = 200,
  NotFound = 404,
  ServerError = 500,
}

// Literal types
export interface Config {
  mode: "development" | "production" | "test";
  maxRetries: 3 | 5 | 10;
  verbose: true;
}

// Utility types
export type PartialUser = Partial<User>;
export type UserKeys = keyof User;
export type UserPick = Pick<User, "name" | "email">;
export type UserOmit = Omit<User, "isActive">;

// Record type
export type UserMap = Record<string, User>;
export type StatusCounts = Record<Status, number>;

// Complex nested type
export interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: User;
  tags: string[];
  metadata: {
    views: number;
    likes: number;
    comments: Comment[];
  };
  status: Status;
  publishedAt: string | null;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

// Type with Map and Set
export interface DataStore {
  cache: Map<string, string>;
  tags: Set<string>;
  data: Record<string, number>;
}

// Class
export class Vehicle {
  public make: string = "";
  public model: string = "";
  public year: number = 0;
  public isElectric?: boolean;
}

// Recursive type (tree structure)
export interface TreeNode {
  value: string;
  children: TreeNode[];
}

// Generics (simplified - the library resolves concrete types)
export interface ApiResponse<T> {
  data: T;
  error: string | null;
  status: number;
}

// Interface with readonly properties
export interface ImmutableConfig {
  readonly apiUrl: string;
  readonly version: string;
  readonly features: string[];
}

// Type with Date and RegExp
export interface Event {
  name: string;
  date: Date;
  pattern: RegExp;
  attendees: string[];
}

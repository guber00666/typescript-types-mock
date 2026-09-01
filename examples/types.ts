/**
 * Пример: типы для интернет-магазина
 */

export type UserRole = "admin" | "manager" | "customer";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export enum PaymentMethod {
  CreditCard = "CREDIT_CARD",
  PayPal = "PAYPAL",
  BankTransfer = "BANK_TRANSFER",
}

export interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: UserRole;
  address: Address;
  phone?: string;
  avatar?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  inStock: boolean;
  tags: string[];
  category: "electronics" | "clothing" | "books" | "food";
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  user: User;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  error: string | null;
  status: number;
  timestamp: string;
}

export type UserResponse = ApiResponse<User>;
export type OrderResponse = ApiResponse<Order>;

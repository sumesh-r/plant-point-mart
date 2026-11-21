export type Role = "CUSTOMER" | "ADMIN";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  /** true after an admin resets the password; the user should pick a new one */
  mustChangePassword: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  productCount?: number;
}

export interface ProductImage {
  id: number;
  url: string;
  sortOrder: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  mrp: number | null;
  stock: number;
  careLevel: string | null;
  light: string | null;
  water: string | null;
  isActive: boolean;
  createdAt: string;
  categoryId: number;
  category: Pick<Category, "id" | "name" | "slug">;
  images: ProductImage[];
}

export interface ProductList {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CartItem {
  id: number;
  quantity: number;
  productId: number;
  product: Product;
}

export interface Cart {
  items: CartItem[];
  count: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  freeShippingAbove: number;
}

export type OrderStatus = "PLACED" | "CONFIRMED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export interface StatusHistory<S extends string> {
  id: number;
  status: S;
  note: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  productId: number | null;
}

export interface Order {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "COD";
  paymentStatus: "PENDING" | "PAID";
  subtotal: number;
  shippingFee: number;
  total: number;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  createdAt: string;
  items: OrderItem[];
  history: StatusHistory<OrderStatus>[];
  user?: Pick<User, "id" | "name" | "email" | "phone">;
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: number;
  durationMinutes: number;
  image: string | null;
  isActive: boolean;
  _count?: { bookings: number };
}

export type SlotStatus = "AVAILABLE" | "BOOKED" | "BLOCKED";

export interface Slot {
  id: number;
  startsAt: string;
  endsAt: string;
  status?: SlotStatus;
  serviceId?: number | null;
}

export interface AdminSlot extends Slot {
  status: SlotStatus;
  service: { id: number; name: string } | null;
  bookings: { id: number; bookingNumber: string; status: BookingStatus; fullName: string; service: { name: string } }[];
}

export type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface BookingImage {
  id: number;
  url: string;
  uploadedBy: "CUSTOMER" | "ADMIN";
  caption: string | null;
  createdAt: string;
}

export interface Booking {
  id: number;
  bookingNumber: string;
  status: BookingStatus;
  price: number;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  pincode: string;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  service: Service;
  slot: Slot;
  images: BookingImage[];
  history: StatusHistory<BookingStatus>[];
  user?: Pick<User, "id" | "name" | "email" | "phone">;
}

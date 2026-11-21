import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../context/auth";
import { api, errorMessage } from "./api";
import type { Cart, Product } from "./types";

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<Cart>("/cart"),
    enabled: !!user,
  });
}

/** Add to cart from anywhere. Asks guests to sign in first, then adds. */
export function useAddToCart() {
  const qc = useQueryClient();
  const { requireAuth } = useAuth();
  const mutation = useMutation({
    mutationFn: (v: { product: Product; quantity: number }) =>
      api.post<Cart>("/cart", { productId: v.product.id, quantity: v.quantity }),
    onSuccess: (cart, v) => {
      qc.setQueryData(["cart"], cart);
      toast.success(`${v.product.name} added to cart`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return {
    add: (product: Product, quantity = 1) =>
      requireAuth(() => mutation.mutate({ product, quantity }), "Sign in to add plants to your cart"),
    isPending: mutation.isPending,
    pendingId: mutation.isPending ? mutation.variables?.product.id : undefined,
  };
}

export function useUpdateCart() {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (v: { productId: number; quantity: number }) => api.patch<Cart>(`/cart/${v.productId}`, { quantity: v.quantity }),
    onSuccess: (cart) => qc.setQueryData(["cart"], cart),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (productId: number) => api.del<Cart>(`/cart/${productId}`),
    onSuccess: (cart) => qc.setQueryData(["cart"], cart),
    onError: (err) => toast.error(errorMessage(err)),
  });
  return { update, remove };
}

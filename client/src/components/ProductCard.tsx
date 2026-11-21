import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useAddToCart } from "../lib/cart";
import { imageUrl, money } from "../lib/format";
import type { Product } from "../lib/types";
import { Button, Skeleton } from "./ui";

export function ProductCard({ product }: { product: Product }) {
  const { add, pendingId } = useAddToCart();
  const out = product.stock === 0;
  const discount = product.mrp && product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-sand-200/70 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/plants/${product.slug}`} className="relative block aspect-square overflow-hidden bg-sand-100">
        <img
          src={imageUrl(product.images[0]?.url)}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-clay-500 px-2 py-0.5 text-[11px] font-bold text-white">{discount}% OFF</span>
          )}
          {out ? (
            <span className="rounded-full bg-forest-950/75 px-2 py-0.5 text-[11px] font-bold text-white">Sold out</span>
          ) : product.stock < 5 ? (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-clay-600">Only {product.stock} left</span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-forest-600 sm:text-[11px]">{product.category.name}</p>
        <Link to={`/plants/${product.slug}`} className="mt-1 line-clamp-2 text-sm font-semibold leading-snug hover:text-forest-700 sm:text-base">
          {product.name}
        </Link>
        {/* Phones: price, then a full-width button that's easy to tap. Larger screens: side by side. */}
        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold sm:text-lg">{money(product.price)}</span>
            {discount > 0 && <span className="text-xs text-forest-950/40 line-through">{money(product.mrp!)}</span>}
          </div>
          <Button
            size="sm"
            variant={out ? "outline" : "primary"}
            className="h-9 w-full sm:h-8 sm:w-auto"
            disabled={out}
            loading={pendingId === product.id}
            onClick={() => add(product)}
            aria-label={`Add ${product.name} to cart`}
          >
            {pendingId !== product.id && <ShoppingBag className="size-3.5" />}
            {out ? "Sold out" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-sand-200/70 bg-white">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-4 h-6 w-20" />
      </div>
    </div>
  );
}

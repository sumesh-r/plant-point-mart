import clsx from "clsx";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { api, qs } from "../lib/api";
import type { Category, ProductList } from "../lib/types";

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

const priceRanges = [
  { label: "Under ₹200", min: undefined, max: 199 },
  { label: "₹200 – ₹499", min: 200, max: 499 },
  { label: "₹500 – ₹999", min: 500, max: 999 },
  { label: "₹1000 & above", min: 1000, max: undefined },
];

export default function Plants() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page") ?? 1);
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const inStock = params.get("inStock") === "true";

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.get<{ categories: Category[] }>("/categories") });
  const query = qs({ q, category, sort, page, minPrice, maxPrice, inStock: inStock || undefined, pageSize: 12 });
  const products = useQuery({
    queryKey: ["products", query],
    queryFn: () => api.get<ProductList>(`/products${query}`),
    placeholderData: keepPreviousData,
  });

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  }

  const activeCategory = categories.data?.categories.find((c) => c.slug === category);
  const hasFilters = !!(q || category || minPrice || maxPrice || inStock);

  const filters = (
    <div className="space-y-7">
      <div>
        <h3 className="mb-3 font-sans text-xs font-bold uppercase tracking-wider text-forest-950/50">Category</h3>
        <div className="space-y-0.5">
          <FilterOption active={!category} onClick={() => update({ category: undefined })}>
            All plants
          </FilterOption>
          {categories.data?.categories.map((c) => (
            <FilterOption key={c.id} active={category === c.slug} onClick={() => update({ category: c.slug })} count={c.productCount}>
              {c.name}
            </FilterOption>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-sans text-xs font-bold uppercase tracking-wider text-forest-950/50">Price</h3>
        <div className="space-y-0.5">
          {priceRanges.map((r) => {
            const active = minPrice === String(r.min ?? "") && maxPrice === String(r.max ?? "");
            return (
              <FilterOption
                key={r.label}
                active={active}
                onClick={() =>
                  active
                    ? update({ minPrice: undefined, maxPrice: undefined })
                    : update({ minPrice: r.min?.toString(), maxPrice: r.max?.toString() })
                }
              >
                {r.label}
              </FilterOption>
            );
          })}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => update({ inStock: e.target.checked ? "true" : undefined })}
          className="size-4 rounded accent-forest-700"
        />
        In stock only
      </label>
    </div>
  );

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">{activeCategory?.name ?? (q ? `Results for "${q}"` : "Shop all plants")}</h1>
        <p className="mt-2 text-forest-950/60">{activeCategory?.description ?? "Healthy, nursery-fresh plants and garden essentials."}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="size-4" /> Filters
            </Button>
            <p className="text-sm text-forest-950/60">{products.data ? `${products.data.total} items` : "Loading…"}</p>
            {hasFilters && (
              <button
                className="flex items-center gap-1 text-sm font-medium text-forest-700 hover:underline"
                onClick={() => setParams(sort !== "newest" ? { sort } : {})}
              >
                <X className="size-3.5" /> Clear filters
              </button>
            )}
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="input ml-auto h-9 w-40 py-0 pr-8 sm:w-auto" aria-label="Sort by">
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {products.isError ? (
            <ErrorState message="Couldn't load plants." onRetry={() => products.refetch()} />
          ) : products.data && products.data.products.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No plants found"
              description="Try a different search or remove some filters."
              action={<Button variant="outline" onClick={() => setParams({})}>Clear all filters</Button>}
            />
          ) : (
            <div className={clsx("grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3", products.isPlaceholderData && "opacity-60 transition")}>
              {products.data
                ? products.data.products.map((p) => <ProductCard key={p.id} product={p} />)
                : Array.from({ length: 9 }, (_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          )}

          {products.data && products.data.totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <span className="px-3 text-sm font-medium">
                Page {page} of {products.data.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= products.data.totalPages} onClick={() => update({ page: String(page + 1) })}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-forest-950/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-6 shadow-lift animate-fade-in">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="rounded-lg p-1.5 hover:bg-sand-100" aria-label="Close filters">
                <X className="size-5" />
              </button>
            </div>
            <div onClick={(e) => (e.target as HTMLElement).closest("button") && setFiltersOpen(false)}>{filters}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterOption({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
        active ? "bg-forest-700 font-semibold text-white" : "text-forest-900 hover:bg-forest-50",
      )}
    >
      {children}
      {count !== undefined && <span className={clsx("text-xs", active ? "text-white/70" : "text-forest-950/40")}>{count}</span>}
    </button>
  );
}

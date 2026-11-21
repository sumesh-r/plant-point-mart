import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Droplets, HandCoins, Leaf, ShoppingBag, Sun, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { Button, ButtonLink, EmptyState, PageLoader, QuantityStepper } from "../components/ui";
import { useAuth } from "../context/auth";
import { api, ApiError } from "../lib/api";
import { useAddToCart } from "../lib/cart";
import { imageUrl, money } from "../lib/format";
import type { Product } from "../lib/types";

export default function PlantDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api.get<{ product: Product; related: Product[] }>(`/products/${slug}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const { add, isPending } = useAddToCart();

  useEffect(() => {
    setImgIdx(0);
    setQty(1);
  }, [slug]);

  if (isLoading) return <PageLoader />;
  if (error || !data)
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<Leaf className="size-6" />}
          title="Plant not found"
          description="This plant may have been removed or is no longer available."
          action={<ButtonLink to="/plants">Browse plants</ButtonLink>}
        />
      </div>
    );

  const { product, related } = data;
  const out = product.stock === 0;
  const discount = product.mrp && product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;
  const images = product.images.length ? product.images : [{ id: 0, url: imageUrl(null), sortOrder: 0 }];

  return (
    <div className="container-page py-5 sm:py-8">
      <nav className="mb-4 flex min-w-0 items-center gap-1.5 text-sm text-forest-950/50 sm:mb-6">
        <Link to="/" className="shrink-0 hover:text-forest-800">Home</Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link to={`/plants?category=${product.category.slug}`} className="shrink-0 whitespace-nowrap hover:text-forest-800">{product.category.name}</Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="truncate text-forest-950/80">{product.name}</span>
      </nav>

      <div className="grid gap-6 sm:gap-10 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-3xl bg-sand-100">
            <img src={imageUrl(images[imgIdx]?.url)} alt={product.name} className="aspect-square w-full object-cover animate-fade-in" key={imgIdx} />
          </div>
          {images.length > 1 && (
            <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 py-1 sm:mt-4">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIdx(i)}
                  className={clsx("size-16 shrink-0 overflow-hidden sm:size-20 rounded-xl ring-2 ring-offset-2 ring-offset-cream transition", i === imgIdx ? "ring-forest-600" : "ring-transparent opacity-70 hover:opacity-100")}
                >
                  <img src={imageUrl(img.url)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-forest-600">{product.category.name}</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{money(product.price)}</span>
            {discount > 0 && (
              <>
                <span className="text-lg text-forest-950/40 line-through">{money(product.mrp!)}</span>
                <span className="rounded-full bg-clay-500/10 px-2 py-0.5 text-sm font-bold text-clay-600">{discount}% off</span>
              </>
            )}
          </div>
          <p className="mt-2 text-sm">
            {out ? (
              <span className="font-semibold text-red-600">Out of stock</span>
            ) : product.stock < 5 ? (
              <span className="font-semibold text-clay-600">Hurry, only {product.stock} left</span>
            ) : (
              <span className="font-semibold text-forest-600">In stock</span>
            )}
          </p>

          <p className="mt-6 leading-relaxed text-forest-950/70">{product.description}</p>

          {(product.careLevel || product.light || product.water) && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: Leaf, label: "Care", value: product.careLevel },
                { icon: Sun, label: "Light", value: product.light },
                { icon: Droplets, label: "Water", value: product.water },
              ]
                .filter((x) => x.value)
                .map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-2xl bg-white p-3 shadow-soft">
                    <Icon className="size-4 text-forest-600" />
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-forest-950/45">{label}</p>
                    <p className="text-sm font-medium leading-snug">{value}</p>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, product.stock)} disabled={out} />
            <Button size="lg" className="flex-1 sm:flex-none" disabled={out} loading={isPending} onClick={() => add(product, qty)}>
              <ShoppingBag className="size-4" /> Add to cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={out}
              onClick={() => requireAuth(() => { add(product, qty); navigate("/cart"); }, "Sign in to buy this plant")}
            >
              Buy now
            </Button>
          </div>

          <div className="mt-8 space-y-3 rounded-2xl border border-sand-200 p-4 text-sm">
            <p className="flex items-center gap-3"><Truck className="size-4 text-forest-600" /> Free delivery on orders above ₹499</p>
            <p className="flex items-center gap-3"><HandCoins className="size-4 text-forest-600" /> Cash on delivery available</p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-semibold">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

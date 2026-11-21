import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, HandCoins, Leaf, Sprout, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { ButtonLink } from "../components/ui";
import { api } from "../lib/api";
import { fmtDuration, imageUrl, money } from "../lib/format";
import type { Category, ProductList, Service } from "../lib/types";

export default function Home() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.get<{ categories: Category[] }>("/categories") });
  const latest = useQuery({ queryKey: ["products", "home"], queryFn: () => api.get<ProductList>("/products?pageSize=8") });
  const hero = useQuery({ queryKey: ["products", "hero"], queryFn: () => api.get<ProductList>("/products?category=indoor-plants&pageSize=4") });
  const services = useQuery({ queryKey: ["services"], queryFn: () => api.get<{ services: Service[] }>("/services") });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -right-32 -top-32 size-[520px] rounded-full bg-forest-100/70 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-[380px] rounded-full bg-sand-200/60 blur-3xl" />
        <div className="container-page relative grid items-center gap-8 py-10 sm:gap-10 sm:py-14 md:grid-cols-2 md:py-20">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-forest-700 shadow-soft">
              <Sprout className="size-3.5" /> Nursery-fresh plants, delivered
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-forest-900 sm:text-5xl lg:text-6xl">
              Bring nature <em className="font-medium text-forest-600">home</em>, one plant at a time.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-forest-950/65 sm:text-lg">
              Shop indoor, outdoor, flowering and medicinal plants, plus everything your garden needs. Book a trained gardener to care for them at home.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <ButtonLink to="/plants" size="lg">
                Shop plants <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink to="/services" size="lg" variant="outline">
                <CalendarCheck className="size-4" /> Book a service
              </ButtonLink>
            </div>
          </div>
          <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3 pb-6 sm:gap-4 sm:pb-0">
            {(hero.data?.products ?? []).slice(0, 4).map((p, i) => (
              <Link
                key={p.id}
                to={`/plants/${p.slug}`}
                className={`overflow-hidden rounded-3xl bg-white shadow-lift transition hover:-translate-y-1 ${i % 2 ? "translate-y-6 sm:translate-y-8" : ""} ${i >= 2 ? "hidden sm:block" : ""}`}
              >
                <img src={imageUrl(p.images[0]?.url)} alt={p.name} className="aspect-square w-full object-cover sm:aspect-[4/5]" />
              </Link>
            ))}
            {!hero.data && [0, 1, 2, 3].map((i) => <div key={i} className={`aspect-square rounded-3xl bg-sand-100 sm:aspect-[4/5] ${i % 2 ? "translate-y-6 sm:translate-y-8" : ""} ${i >= 2 ? "hidden sm:block" : ""}`} />)}
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="container-page">
        <div className="grid gap-4 rounded-2xl bg-forest-800 p-6 text-forest-50 sm:grid-cols-3 sm:p-8">
          {[
            { icon: Truck, title: "Free delivery above ₹499", text: "Carefully packed so plants arrive healthy" },
            { icon: HandCoins, title: "Cash on delivery", text: "Pay when your plants reach your door" },
            { icon: Leaf, title: "Expert plant care", text: "Book gardeners for care, repotting & more" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-forest-100/70">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page mt-20">
        <SectionHeading title="Shop by category" link="/categories" linkLabel="All categories" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(categories.data?.categories ?? Array.from({ length: 6 }, () => null)).map((c, i) =>
            c ? (
              <Link key={c.id} to={`/plants?category=${c.slug}`} className="group text-center">
                <div className="overflow-hidden rounded-2xl bg-sand-100">
                  <img src={imageUrl(c.image)} alt={c.name} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <p className="mt-3 text-sm font-semibold group-hover:text-forest-700">{c.name}</p>
                <p className="text-xs text-forest-950/50">{c.productCount} items</p>
              </Link>
            ) : (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-sand-100" />
            ),
          )}
        </div>
      </section>

      {/* New arrivals */}
      <section className="container-page mt-20">
        <SectionHeading title="New arrivals" link="/plants" linkLabel="View all plants" />
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {latest.data
            ? latest.data.products.map((p) => <ProductCard key={p.id} product={p} />)
            : Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </section>

      {/* Services */}
      <section className="container-page mt-20">
        <div className="overflow-hidden rounded-3xl bg-sand-100">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-clay-600">Plant care services</span>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Gardeners at your doorstep</h2>
              <p className="mt-3 text-forest-950/65">
                Pick a service, choose a free slot on the calendar and we'll be there. Track every booking from your account.
              </p>
              <ButtonLink to="/services" className="mt-6">
                Explore services <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(services.data?.services ?? []).slice(0, 4).map((s) => (
                <Link key={s.id} to={`/services/${s.slug}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:shadow-lift">
                  <img src={imageUrl(s.image)} alt="" className="size-16 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-sm text-forest-950/55">
                      {money(s.price)} · {fmtDuration(s.durationMinutes)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, link, linkLabel }: { title: string; link: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
      <Link to={link} className="flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline">
        {linkLabel} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { imageUrl } from "../lib/format";
import type { Category } from "../lib/types";

export default function Categories() {
  const { data } = useQuery({ queryKey: ["categories"], queryFn: () => api.get<{ categories: Category[] }>("/categories") });
  return (
    <div className="container-page py-10">
      <PageHeader title="Plant categories" subtitle="Find the right plant for every corner of your home and garden." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data
          ? data.categories.map((c) => (
              <Link key={c.id} to={`/plants?category=${c.slug}`} className="group flex overflow-hidden rounded-2xl bg-white shadow-soft transition hover:shadow-lift">
                <img src={imageUrl(c.image)} alt={c.name} className="w-36 shrink-0 object-cover transition duration-500 group-hover:scale-105" />
                <div className="flex flex-col p-5">
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-forest-950/60">{c.description}</p>
                  <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-forest-700">
                    {c.productCount} items <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))
          : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    </div>
  );
}

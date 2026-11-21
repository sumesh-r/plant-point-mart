import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ClipboardList, IndianRupee, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, ErrorState, PageHeader, PageLoader } from "../../components/ui";
import { api } from "../../lib/api";
import { bookingStatusLabel, bookingStatusTone, fmtDate, fmtSlot, imageUrl, money, orderStatusLabel, orderStatusTone } from "../../lib/format";
import type { BookingStatus, OrderStatus } from "../../lib/types";
import { StatCard } from "./shared";

interface Stats {
  productCount: number;
  customerCount: number;
  orderCount: number;
  pendingOrders: number;
  revenue: number;
  bookingCount: number;
  pendingBookings: number;
  freeSlotsThisWeek: number;
  lowStock: { id: number; name: string; stock: number; images: { url: string }[] }[];
  recentOrders: { id: number; orderNumber: string; status: OrderStatus; total: number; createdAt: string; user: { name: string }; _count: { items: number } }[];
  upcomingBookings: { id: number; bookingNumber: string; status: BookingStatus; fullName: string; service: { name: string }; slot: { startsAt: string; endsAt: string } }[];
}

export default function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get<Stats>("/admin/stats") });
  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState message="Couldn't load dashboard." onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Here's what's happening at Plant Point Mart" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Revenue (delivered)" value={money(data.revenue)} icon={<IndianRupee className="size-4" />} hint={`${data.orderCount} orders in total`} />
        <StatCard label="Orders to process" value={data.pendingOrders} icon={<Package className="size-4" />} tone="clay" hint="Placed or confirmed" />
        <StatCard label="Pending bookings" value={data.pendingBookings} icon={<ClipboardList className="size-4" />} tone="violet" hint={`${data.bookingCount} bookings in total`} />
        <StatCard label="Free slots (next 7 days)" value={data.freeSlotsThisWeek} icon={<CalendarDays className="size-4" />} tone="sky" hint={`${data.customerCount} customers · ${data.productCount} products`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-semibold text-forest-700 hover:underline">View all</Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-forest-950/50">No orders yet</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders?open=${o.id}`} className="flex items-center gap-3 py-3 hover:bg-sand-100/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{o.orderNumber} <span className="font-normal text-forest-950/50">· {o.user.name}</span></p>
                      <p className="text-xs text-forest-950/50">{fmtDate(o.createdAt)} · {o._count.items} items</p>
                    </div>
                    <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
                    <p className="w-20 text-right text-sm font-semibold">{money(o.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming service visits</h2>
            <Link to="/admin/bookings" className="text-sm font-semibold text-forest-700 hover:underline">View all</Link>
          </div>
          {data.upcomingBookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-forest-950/50">No upcoming bookings</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {data.upcomingBookings.map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/bookings?open=${b.id}`} className="flex items-center gap-3 py-3 hover:bg-sand-100/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.service.name} <span className="font-normal text-forest-950/50">· {b.fullName}</span></p>
                      <p className="text-xs text-forest-950/50">{fmtSlot(b.slot.startsAt, b.slot.endsAt)}</p>
                    </div>
                    <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-clay-500" /> Low stock</h2>
        {data.lowStock.length === 0 ? (
          <p className="text-sm text-forest-950/50">All products are well stocked.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.lowStock.map((p) => (
              <Link key={p.id} to={`/admin/products?edit=${p.id}`} className="flex items-center gap-3 rounded-xl border border-sand-200 p-3 hover:border-forest-300">
                <img src={imageUrl(p.images[0]?.url)} alt="" className="size-11 rounded-lg object-cover" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</p>
                <Badge tone={p.stock === 0 ? "red" : "amber"}>{p.stock === 0 ? "Out" : `${p.stock} left`}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

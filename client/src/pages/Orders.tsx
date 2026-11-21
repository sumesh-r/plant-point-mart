import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronRight, HandCoins, MapPin, Package } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { StatusTimeline } from "../components/StatusTimeline";
import { Badge, Button, ButtonLink, EmptyState, ErrorState, PageHeader, PageLoader } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { fmtDate, imageUrl, money, ORDER_FLOW, orderStatusLabel, orderStatusTone } from "../lib/format";
import type { Order } from "../lib/types";

export function MyOrders() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["orders"], queryFn: () => api.get<{ orders: Order[] }>("/orders") });

  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader title="My orders" subtitle="Track and manage your plant orders" />
      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState message="Couldn't load your orders." onRetry={() => refetch()} />
      ) : !data?.orders.length ? (
        <EmptyState icon={<Package className="size-6" />} title="No orders yet" description="When you place an order, it'll show up here." action={<ButtonLink to="/plants">Shop plants</ButtonLink>} />
      ) : (
        <div className="space-y-3">
          {data.orders.map((o) => (
            <Link key={o.id} to={`/account/orders/${o.orderNumber}`} className="card flex items-center gap-4 p-4 transition hover:shadow-lift">
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((i) => (
                  <img key={i.id} src={imageUrl(i.image)} alt="" className="size-14 rounded-xl border-2 border-white object-cover" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{o.orderNumber}</p>
                  <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-forest-950/55">
                  {fmtDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items · {money(o.total)}
                </p>
              </div>
              <ChevronRight className="size-5 text-forest-950/30" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetail() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders", orderNumber],
    queryFn: () => api.get<{ order: Order }>(`/orders/${orderNumber}`),
  });
  const cancel = useMutation({
    mutationFn: () => api.post<{ order: Order }>(`/orders/${orderNumber}/cancel`),
    onSuccess: (res) => {
      qc.setQueryData(["orders", orderNumber], res);
      qc.invalidateQueries({ queryKey: ["orders"], exact: true });
      toast.success("Order cancelled");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data)
    return (
      <div className="container-page py-16">
        <EmptyState icon={<Package className="size-6" />} title="Order not found" action={<ButtonLink to="/account/orders">My orders</ButtonLink>} />
      </div>
    );
  const o = data.order;
  const canCancel = o.status === "PLACED" || o.status === "CONFIRMED";

  return (
    <div className="container-page max-w-5xl py-10">
      <Link to="/account/orders" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="size-4" /> All orders
      </Link>

      {params.get("placed") && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-forest-700 p-5 text-white animate-fade-in">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
          <div>
            <p className="text-lg font-semibold">Thank you! Your order has been placed.</p>
            <p className="text-sm text-forest-100/80">Please keep {money(o.total)} ready to pay on delivery. We'll keep you updated here.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold sm:text-3xl">Order {o.orderNumber}</h1>
            <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-forest-950/55">Placed on {fmtDate(o.createdAt)}</p>
        </div>
        {canCancel && (
          <Button
            variant="outline"
            loading={cancel.isPending}
            onClick={() => confirm("Cancel this order?") && cancel.mutate()}
            className="text-red-600 hover:border-red-200 hover:bg-red-50"
          >
            Cancel order
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 font-semibold">Items</h2>
            <ul className="divide-y divide-sand-100">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <img src={imageUrl(i.image)} alt="" className="size-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-sm text-forest-950/55">
                      {money(i.price)} × {i.quantity}
                    </p>
                  </div>
                  <p className="font-semibold">{money(i.price * i.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-sand-200 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-forest-950/60">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-forest-950/60">Delivery</dt><dd>{o.shippingFee ? money(o.shippingFee) : "Free"}</dd></div>
              <div className="flex justify-between text-base"><dt className="font-semibold">Total</dt><dd className="font-bold">{money(o.total)}</dd></div>
            </dl>
          </section>
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="card p-6">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="size-4 text-forest-600" /> Delivery address</h2>
              <p className="text-sm font-medium">{o.fullName}</p>
              <p className="text-sm text-forest-950/65">{o.addressLine}</p>
              <p className="text-sm text-forest-950/65">{o.city}, {o.state} – {o.pincode}</p>
              <p className="mt-1 text-sm text-forest-950/65">{o.phone}</p>
            </section>
            <section className="card p-6">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><HandCoins className="size-4 text-forest-600" /> Payment</h2>
              <p className="text-sm">Cash on Delivery</p>
              <Badge tone={o.paymentStatus === "PAID" ? "green" : "amber"} className="mt-2">
                {o.paymentStatus === "PAID" ? "Paid" : "To be paid on delivery"}
              </Badge>
            </section>
          </div>
        </div>
        <section className="card h-fit p-6">
          <h2 className="mb-5 font-semibold">Order tracking</h2>
          <StatusTimeline flow={ORDER_FLOW} current={o.status} history={o.history} labels={orderStatusLabel} cancelled="CANCELLED" />
        </section>
      </div>
    </div>
  );
}

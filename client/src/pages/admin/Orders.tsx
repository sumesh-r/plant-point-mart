import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigation, Package, Phone } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { StatusTimeline } from "../../components/StatusTimeline";
import { Badge, Button, buttonClass, EmptyState, Field, Modal, PageHeader, PageLoader } from "../../components/ui";
import { api, errorMessage, qs } from "../../lib/api";
import { fmtDateTime, imageUrl, money, ORDER_FLOW, orderStatusLabel, orderStatusTone } from "../../lib/format";
import type { Order, OrderStatus } from "../../lib/types";
import { FilterTabs, MobileCard, MobileList, SearchInput, Table, Td, Th } from "./shared";

const ALL: OrderStatus[] = [...ORDER_FLOW, "CANCELLED"];

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [q, setQ] = useState("");
  const query = qs({ status, q });
  const { data, isLoading } = useQuery({ queryKey: ["admin", "orders", query], queryFn: () => api.get<{ orders: Order[] }>(`/admin/orders${query}`) });
  const openId = params.get("open");

  return (
    <div>
      <PageHeader title="Orders" subtitle="Process and track customer orders (Cash on Delivery)" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs value={status} onChange={setStatus} options={[{ value: "", label: "All" }, ...ALL.map((s) => ({ value: s, label: orderStatusLabel[s] }))]} />
        <SearchInput value={q} onChange={setQ} placeholder="Order no., name or phone" />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : !data?.orders.length ? (
        <EmptyState icon={<Package className="size-6" />} title="No orders found" />
      ) : (
        <>
        <MobileList>
          {data.orders.map((o) => (
            <MobileCard key={o.id} onClick={() => setParams({ open: String(o.id) })}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-forest-950/50">{fmtDateTime(o.createdAt)}</p>
                </div>
                <Badge tone={orderStatusTone[o.status]} className="shrink-0">{orderStatusLabel[o.status]}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-forest-950/65">{o.items.reduce((n, i) => n + i.quantity, 0)} items · <b className="text-forest-950">{money(o.total)}</b></span>
                <Badge tone={o.paymentStatus === "PAID" ? "green" : "gray"}>{o.paymentStatus === "PAID" ? "Paid" : "COD due"}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-sand-100 pt-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{o.fullName}</p>
                  <p className="truncate text-xs text-forest-950/55">{o.city} – {o.pincode}</p>
                </div>
                <a
                  href={`tel:${o.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-forest-50 px-3 text-sm font-semibold text-forest-800 active:bg-forest-100"
                  aria-label={`Call ${o.fullName}`}
                >
                  <Phone className="size-4" /> Call
                </a>
              </div>
            </MobileCard>
          ))}
        </MobileList>
        <Table mobile={false}>
          <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Date</Th><Th>Items</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th></tr></thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} onClick={() => setParams({ open: String(o.id) })} className="cursor-pointer hover:bg-sand-100/40">
                <Td className="font-semibold">{o.orderNumber}</Td>
                <Td><p className="font-medium">{o.fullName}</p><p className="text-xs text-forest-950/50">{o.phone}</p></Td>
                <Td className="whitespace-nowrap text-forest-950/65">{fmtDateTime(o.createdAt)}</Td>
                <Td>{o.items.reduce((n, i) => n + i.quantity, 0)}</Td>
                <Td className="font-semibold">{money(o.total)}</Td>
                <Td><Badge tone={o.paymentStatus === "PAID" ? "green" : "gray"}>{o.paymentStatus === "PAID" ? "Paid" : "COD due"}</Badge></Td>
                <Td><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </>
      )}
      {openId && <OrderPanel id={Number(openId)} onClose={() => setParams({})} />}
    </div>
  );
}

function OrderPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api.get<{ order: Order }>(`/admin/orders/${id}`) });
  const [next, setNext] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");

  const update = useMutation({
    mutationFn: () => api.patch<{ order: Order }>(`/admin/orders/${id}/status`, { status: next, note }),
    onSuccess: (res) => {
      qc.setQueryData(["admin", "order", id], res);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      setNext("");
      setNote("");
      toast.success("Order status updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const o = data?.order;
  return (
    <Modal open onClose={onClose} size="lg" title={o ? `Order ${o.orderNumber}` : "Order"}>
      {isLoading || !o ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
            <Badge tone={o.paymentStatus === "PAID" ? "green" : "gray"}>{o.paymentStatus === "PAID" ? "Cash collected" : "Cash on delivery – due"}</Badge>
            <span className="text-sm text-forest-950/50">Placed {fmtDateTime(o.createdAt)}</span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-semibold">Deliver to</p>
              <p className="text-sm">{o.fullName} · {o.phone}</p>
              <p className="text-sm text-forest-950/65">{o.addressLine}, {o.city}, {o.state} – {o.pincode}</p>
              {o.user && <p className="mt-2 text-xs text-forest-950/50">Account: {o.user.name} ({o.user.email})</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`tel:${o.phone}`} className={buttonClass("secondary", "md")}>
                  <Phone className="size-4" /> Call
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.addressLine}, ${o.city}, ${o.state} ${o.pincode}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("outline", "md")}
                >
                  <Navigation className="size-4" /> Directions
                </a>
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Tracking</p>
              <StatusTimeline flow={ORDER_FLOW} current={o.status} history={o.history} labels={orderStatusLabel} cancelled="CANCELLED" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Items</p>
            <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-3">
                  <img src={imageUrl(i.image)} alt="" className="size-10 rounded-lg object-cover" />
                  <p className="flex-1 text-sm">{i.name} <span className="text-forest-950/50">× {i.quantity}</span></p>
                  <p className="text-sm font-semibold">{money(i.price * i.quantity)}</p>
                </li>
              ))}
              <li className="flex justify-between p-3 text-sm"><span className="text-forest-950/60">Delivery</span><span>{o.shippingFee ? money(o.shippingFee) : "Free"}</span></li>
              <li className="flex justify-between p-3 font-semibold"><span>Total</span><span>{money(o.total)}</span></li>
            </ul>
          </div>

          {o.status !== "CANCELLED" && o.status !== "DELIVERED" && (
            <div className="rounded-xl bg-sand-100/70 p-4">
              <p className="mb-3 text-sm font-semibold">Update status</p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {ALL.filter((s) => s !== o.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNext(s)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition sm:py-1.5 sm:text-xs ${next === s ? (s === "CANCELLED" ? "border-red-600 bg-red-600 text-white" : "border-forest-700 bg-forest-700 text-white") : "border-sand-200 bg-white hover:border-forest-400"}`}
                  >
                    {orderStatusLabel[s]}
                  </button>
                ))}
              </div>
              {next && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Note (optional, visible to customer)" className="min-w-56 flex-1">
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={next === "SHIPPED" ? "e.g. Sent via local courier" : ""} />
                  </Field>
                  <Button className="w-full sm:w-auto" variant={next === "CANCELLED" ? "danger" : "primary"} loading={update.isPending} onClick={() => update.mutate()}>
                    Mark as {orderStatusLabel[next]}
                  </Button>
                </div>
              )}
              {next === "CANCELLED" && <p className="mt-2 text-xs text-red-700">Cancelling puts the items back into stock.</p>}
              {next === "DELIVERED" && <p className="mt-2 text-xs text-forest-700">Marking as delivered also records the cash payment as collected.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Copy, KeyRound, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Modal, PageHeader, PageLoader } from "../../components/ui";
import { api, errorMessage, qs } from "../../lib/api";
import { bookingStatusLabel, bookingStatusTone, fmtDate, fmtSlot, money, orderStatusLabel, orderStatusTone } from "../../lib/format";
import type { BookingStatus, OrderStatus } from "../../lib/types";
import { MobileCard, MobileList, SearchInput, Table, Td, Th } from "./shared";

interface CustomerRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  isBlocked: boolean;
  mustChangePassword: boolean;
  _count: { orders: number; bookings: number };
}

interface CustomerDetail extends Omit<CustomerRow, "_count"> {
  orders: { id: number; orderNumber: string; status: OrderStatus; total: number; createdAt: string; _count: { items: number } }[];
  bookings: { id: number; bookingNumber: string; status: BookingStatus; service: { name: string }; slot: { startsAt: string; endsAt: string } }[];
}

function AccountBadge({ c }: { c: Pick<CustomerRow, "isBlocked" | "mustChangePassword"> }) {
  if (c.isBlocked) return <Badge tone="red"><Ban className="size-3" /> Blocked</Badge>;
  if (c.mustChangePassword) return <Badge tone="amber"><KeyRound className="size-3" /> Temporary password</Badge>;
  return <Badge tone="green">Active</Badge>;
}

export default function AdminCustomers() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "customers", q], queryFn: () => api.get<{ customers: CustomerRow[] }>(`/admin/customers${qs({ q })}`) });

  return (
    <div>
      <PageHeader title="Customers" subtitle="People who have registered. Open a customer to reset their password, block or delete the account." />
      <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Name, email or phone" /></div>
      {isLoading ? (
        <PageLoader />
      ) : !data?.customers.length ? (
        <EmptyState icon={<Users className="size-6" />} title="No customers found" />
      ) : (
        <>
        <MobileList>
          {data.customers.map((c) => (
            <MobileCard key={c.id} onClick={() => setOpen(c.id)}>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">{c.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-forest-950/55">{c.email}</p>
                </div>
                <AccountBadge c={c} />
              </div>
              <p className="mt-3 border-t border-sand-100 pt-3 text-xs text-forest-950/55">
                {c.phone ?? "No phone"} · {c._count.orders} orders · {c._count.bookings} bookings · joined {fmtDate(c.createdAt)}
              </p>
            </MobileCard>
          ))}
        </MobileList>
        <Table mobile={false}>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Joined</Th><Th>Orders</Th><Th>Bookings</Th><Th>Account</Th></tr></thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer hover:bg-sand-100/40">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-forest-100 text-xs font-bold text-forest-800">{c.name.charAt(0).toUpperCase()}</span>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </Td>
                <Td className="text-forest-950/70">{c.email}</Td>
                <Td className="text-forest-950/70">{c.phone ?? "—"}</Td>
                <Td className="text-forest-950/70">{fmtDate(c.createdAt)}</Td>
                <Td>{c._count.orders}</Td>
                <Td>{c._count.bookings}</Td>
                <Td><span className="whitespace-nowrap"><AccountBadge c={c} /></span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </>
      )}
      {open && <CustomerPanel id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CustomerPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "customer", id], queryFn: () => api.get<{ customer: CustomerDetail }>(`/admin/customers/${id}`) });
  const c = data?.customer;
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "customer", id] });
    qc.invalidateQueries({ queryKey: ["admin", "customers"] });
  };

  const resetPw = useMutation({
    mutationFn: () => api.post<{ temporaryPassword: string }>(`/admin/customers/${id}/reset-password`),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setBlocked = useMutation({
    mutationFn: (isBlocked: boolean) => api.patch(`/admin/customers/${id}`, { isBlocked }),
    onSuccess: (_r, isBlocked) => {
      toast.success(isBlocked ? "Account blocked" : "Account unblocked");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/admin/customers/${id}`),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const hasHistory = !!c && (c.orders.length > 0 || c.bookings.length > 0);

  return (
    <Modal open onClose={onClose} size="lg" title={c?.name ?? "Customer"}>
      {isLoading || !c ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
            <div>
              <p>{c.email}</p>
              <p className="text-forest-950/60">{c.phone ?? "No phone"} · joined {fmtDate(c.createdAt)}</p>
            </div>
            <AccountBadge c={c} />
          </div>

          {/* Account actions */}
          <div className="rounded-xl border border-sand-200 p-4">
            <p className="text-sm font-semibold">Account</p>
            <p className="mt-0.5 text-xs text-forest-950/55">
              Forgot their password? Reset it and share the temporary password with them. They'll be asked to choose a new one after signing in.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={resetPw.isPending}
                disabled={c.isBlocked}
                title={c.isBlocked ? "Unblock the account first" : undefined}
                onClick={() => confirm(`Reset the password for ${c.name}? Their current password will stop working and they'll be signed out.`) && resetPw.mutate()}
              >
                <KeyRound className="size-3.5" /> Reset password
              </Button>
              {c.isBlocked ? (
                <Button size="sm" variant="outline" loading={setBlocked.isPending} onClick={() => setBlocked.mutate(false)}>
                  <ShieldCheck className="size-3.5" /> Unblock
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  loading={setBlocked.isPending}
                  onClick={() => confirm(`Block ${c.name}? They'll be signed out and can't sign in until you unblock them.`) && setBlocked.mutate(true)}
                >
                  <Ban className="size-3.5" /> Block
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                loading={remove.isPending}
                disabled={hasHistory}
                title={hasHistory ? "Customers with orders or bookings can't be deleted. Block them instead." : undefined}
                onClick={() => confirm(`Delete ${c.name}'s account permanently? This can't be undone.`) && remove.mutate()}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
            {hasHistory && <p className="mt-2 text-xs text-forest-950/45">This customer has orders or bookings, so the account can't be deleted. Block it instead.</p>}
            {tempPassword && <TemporaryPassword password={tempPassword} email={c.email} onDone={() => setTempPassword(null)} />}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Orders ({c.orders.length})</p>
            {c.orders.length === 0 ? <p className="text-sm text-forest-950/50">No orders yet.</p> : (
              <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <Link to={`/admin/orders?open=${o.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-sand-100/40">
                      <span className="flex-1 font-medium">{o.orderNumber} <span className="font-normal text-forest-950/50">· {fmtDate(o.createdAt)}</span></span>
                      <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
                      <span className="w-20 text-right font-semibold">{money(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Service bookings ({c.bookings.length})</p>
            {c.bookings.length === 0 ? <p className="text-sm text-forest-950/50">No bookings yet.</p> : (
              <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
                {c.bookings.map((b) => (
                  <li key={b.id}>
                    <Link to={`/admin/bookings?open=${b.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-sand-100/40">
                      <span className="flex-1"><span className="font-medium">{b.service.name}</span> <span className="text-forest-950/50">· {fmtSlot(b.slot.startsAt, b.slot.endsAt)}</span></span>
                      <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Shown once, right after a reset. The password isn't stored anywhere the admin can see later. */
function TemporaryPassword({ password, email, onDone }: { password: string; email: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-xl bg-forest-50 p-4 animate-scale-in">
      <p className="text-sm font-semibold text-forest-900">Temporary password</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-lg tracking-widest text-forest-900 ring-1 ring-forest-200">{password}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Couldn't copy. Select the password and copy it instead.");
            }
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-forest-950/60">
        Share this with the customer (phone or WhatsApp). They sign in as <b>{email}</b> with it, then set their own password under My account. It's only shown now.
      </p>
      <button className="mt-2 text-xs font-semibold text-forest-700 hover:underline" onClick={onDone}>Done</button>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Clock, MapPin, Navigation, Phone, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ImagePicker } from "../../components/ImagePicker";
import { StatusTimeline } from "../../components/StatusTimeline";
import { Badge, Button, buttonClass, EmptyState, Field, Modal, PageHeader, PageLoader } from "../../components/ui";
import { api, errorMessage, qs } from "../../lib/api";
import { BOOKING_FLOW, bookingStatusLabel, bookingStatusTone, fmtDateTime, fmtSlot, money } from "../../lib/format";
import type { Booking, BookingStatus, Service } from "../../lib/types";
import { PhotoGrid } from "../Bookings";
import { FilterTabs, MobileCard, MobileList, SearchInput, Table, Td, Th } from "./shared";

const ALL: BookingStatus[] = [...BOOKING_FLOW, "CANCELLED"];

export default function AdminBookings() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [serviceId, setServiceId] = useState("");
  const [q, setQ] = useState("");
  const query = qs({ status, q, serviceId });
  const { data, isLoading } = useQuery({ queryKey: ["admin", "bookings", query], queryFn: () => api.get<{ bookings: Booking[] }>(`/admin/bookings${query}`) });
  const services = useQuery({ queryKey: ["admin", "services"], queryFn: () => api.get<{ services: Service[] }>("/admin/services") });
  const openId = params.get("open");

  return (
    <div>
      <PageHeader title="Service bookings" subtitle="Confirm visits, update progress and share photos with customers" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs value={status} onChange={setStatus} options={[{ value: "", label: "All" }, ...ALL.map((s) => ({ value: s, label: bookingStatusLabel[s] }))]} />
        <select className="input w-full sm:w-auto" aria-label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">All services</option>
          {services.data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <SearchInput value={q} onChange={setQ} placeholder="Booking no., name or phone" />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : !data?.bookings.length ? (
        <EmptyState icon={<ClipboardList className="size-6" />} title="No bookings found" />
      ) : (
        <>
        <MobileList>
          {data.bookings.map((b) => (
            <MobileCard key={b.id} onClick={() => setParams({ open: String(b.id) })}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="size-4 shrink-0 text-forest-600" /> {fmtSlot(b.slot.startsAt, b.slot.endsAt)}</p>
                <Badge tone={bookingStatusTone[b.status]} className="shrink-0">{bookingStatusLabel[b.status]}</Badge>
              </div>
              <p className="mt-2 font-semibold">{b.service.name}</p>
              <p className="text-xs text-forest-950/50">{b.bookingNumber}{b.images.length ? ` · ${b.images.length} photo${b.images.length > 1 ? "s" : ""}` : ""}</p>
              <div className="mt-3 flex items-center gap-3 border-t border-sand-100 pt-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{b.fullName}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-forest-950/55"><MapPin className="size-3 shrink-0" /> {b.city} – {b.pincode}</p>
                </div>
                <a
                  href={`tel:${b.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-forest-50 px-3 text-sm font-semibold text-forest-800 active:bg-forest-100"
                  aria-label={`Call ${b.fullName}`}
                >
                  <Phone className="size-4" /> Call
                </a>
              </div>
            </MobileCard>
          ))}
        </MobileList>
        <Table mobile={false}>
          <thead><tr><Th>Booking</Th><Th>Service</Th><Th>Appointment</Th><Th>Customer</Th><Th>Photos</Th><Th>Status</Th></tr></thead>
          <tbody>
            {data.bookings.map((b) => (
              <tr key={b.id} onClick={() => setParams({ open: String(b.id) })} className="cursor-pointer hover:bg-sand-100/40">
                <Td className="font-semibold">{b.bookingNumber}</Td>
                <Td>{b.service.name}</Td>
                <Td className="whitespace-nowrap text-forest-950/70">{fmtSlot(b.slot.startsAt, b.slot.endsAt)}</Td>
                <Td><p className="font-medium">{b.fullName}</p><p className="text-xs text-forest-950/50">{b.phone} · {b.city}</p></Td>
                <Td>{b.images.length || "—"}</Td>
                <Td><Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </>
      )}
      {openId && <BookingPanel id={Number(openId)} onClose={() => setParams({})} />}
    </div>
  );
}

function BookingPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["admin", "booking", id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<{ booking: Booking }>(`/admin/bookings/${id}`) });
  const b = data?.booking;
  const [next, setNext] = useState<BookingStatus | "">("");
  const [note, setNote] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (b) setAdminNotes(b.adminNotes ?? "");
  }, [b?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSaved = (res: { booking: Booking }) => {
    qc.setQueryData(key, res);
    qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
    qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    qc.invalidateQueries({ queryKey: ["admin", "slots"] });
  };
  const update = useMutation({
    mutationFn: (body: { status?: BookingStatus; note?: string; adminNotes?: string }) => api.patch<{ booking: Booking }>(`/admin/bookings/${id}`, body),
    onSuccess: (res, body) => {
      onSaved(res);
      if (body.status) { setNext(""); setNote(""); toast.success("Status updated"); } else toast.success("Notes saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      if (caption) fd.set("caption", caption);
      return api.post<{ booking: Booking }>(`/admin/bookings/${id}/images`, fd);
    },
    onSuccess: (res) => { onSaved(res); setFiles([]); setCaption(""); toast.success("Photos uploaded"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeImg = useMutation({
    mutationFn: (imageId: number) => api.del<{ booking: Booking }>(`/admin/bookings/${id}/images/${imageId}`),
    onSuccess: onSaved,
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} size="lg" title={b ? `${b.service.name} · ${b.bookingNumber}` : "Booking"}>
      {isLoading || !b ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
            <span className="text-sm text-forest-950/55">{fmtSlot(b.slot.startsAt, b.slot.endsAt)} · {money(b.price)}</span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold">Customer</p>
                <p>{b.fullName} · <a href={`tel:${b.phone}`} className="text-forest-700 hover:underline">{b.phone}</a></p>
                <p className="text-forest-950/65">{b.addressLine}, {b.city} – {b.pincode}</p>
                {b.user && <p className="mt-1 text-xs text-forest-950/50">Account: {b.user.email}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`tel:${b.phone}`} className={buttonClass("secondary", "md")}>
                    <Phone className="size-4" /> Call
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.addressLine}, ${b.city} ${b.pincode}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass("outline", "md")}
                  >
                    <Navigation className="size-4" /> Directions
                  </a>
                </div>
              </div>
              {b.notes && (
                <div>
                  <p className="font-semibold">Customer notes</p>
                  <p className="text-forest-950/70">{b.notes}</p>
                </div>
              )}
              <p className="text-xs text-forest-950/45">Booked {fmtDateTime(b.createdAt)}</p>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Progress</p>
              <StatusTimeline flow={BOOKING_FLOW} current={b.status} history={b.history} labels={bookingStatusLabel} cancelled="CANCELLED" />
            </div>
          </div>

          {b.status !== "CANCELLED" && (
            <div className="rounded-xl bg-sand-100/70 p-4">
              <p className="mb-3 text-sm font-semibold">Update status</p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {ALL.filter((s) => s !== b.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNext(s)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition sm:py-1.5 sm:text-xs ${next === s ? (s === "CANCELLED" ? "border-red-600 bg-red-600 text-white" : "border-forest-700 bg-forest-700 text-white") : "border-sand-200 bg-white hover:border-forest-400"}`}
                  >
                    {bookingStatusLabel[s]}
                  </button>
                ))}
              </div>
              {next && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Note for the customer (optional)" className="min-w-56 flex-1">
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={next === "CONFIRMED" ? "e.g. Gardener Ravi will visit" : ""} />
                  </Field>
                  <Button className="w-full sm:w-auto" variant={next === "CANCELLED" ? "danger" : "primary"} loading={update.isPending && !!update.variables?.status} onClick={() => update.mutate({ status: next, note })}>
                    Mark as {bookingStatusLabel[next]}
                  </Button>
                </div>
              )}
              {next === "CANCELLED" && <p className="mt-2 text-xs text-red-700">Cancelling frees the time slot for other customers.</p>}
            </div>
          )}

          <div>
            <Field label="Notes / work report" hint="Shown to the customer on their booking page">
              <textarea className="input min-h-20" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="e.g. Repotted 4 plants, treated mealybugs on the hibiscus. Water every 2 days." />
            </Field>
            <Button size="sm" variant="outline" className="mt-2" loading={update.isPending && update.variables?.adminNotes !== undefined} disabled={adminNotes === (b.adminNotes ?? "")} onClick={() => update.mutate({ adminNotes })}>
              Save notes
            </Button>
          </div>

          <div>
            <p className="label">Photos</p>
            {b.images.length > 0 ? (
              <PhotoGrid images={b.images} onDelete={(img) => confirm("Delete this photo?") && removeImg.mutate(img.id)} />
            ) : (
              <p className="text-sm text-forest-950/50">No photos yet.</p>
            )}
            <div className="mt-4 rounded-xl border border-dashed border-sand-300 p-4">
              <p className="mb-3 text-sm font-medium">Upload photos (e.g. before / after)</p>
              <ImagePicker files={files} onChange={setFiles} max={8} />
              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Caption (optional)" className="min-w-48 flex-1">
                    <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="After repotting" />
                  </Field>
                  <Button className="w-full sm:w-auto" loading={upload.isPending} onClick={() => upload.mutate()}><Upload className="size-4" /> Upload {files.length}</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

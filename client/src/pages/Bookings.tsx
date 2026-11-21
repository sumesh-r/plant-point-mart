import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarCheck, CheckCircle2, ChevronRight, Clock, ImageIcon, MapPin } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { StatusTimeline } from "../components/StatusTimeline";
import { Badge, Button, ButtonLink, EmptyState, ErrorState, Modal, PageHeader, PageLoader } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { BOOKING_FLOW, bookingStatusLabel, bookingStatusTone, fmtDate, fmtSlot, imageUrl, money } from "../lib/format";
import type { Booking, BookingImage } from "../lib/types";

export function MyBookings() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["bookings"], queryFn: () => api.get<{ bookings: Booking[] }>("/bookings") });

  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader title="My bookings" subtitle="Your plant care service appointments" action={<ButtonLink to="/services" variant="outline">Book a service</ButtonLink>} />
      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState message="Couldn't load your bookings." onRetry={() => refetch()} />
      ) : !data?.bookings.length ? (
        <EmptyState icon={<CalendarCheck className="size-6" />} title="No bookings yet" description="Book a gardener for plant care, repotting, pest treatment and more." action={<ButtonLink to="/services">Explore services</ButtonLink>} />
      ) : (
        <div className="space-y-3">
          {data.bookings.map((b) => (
            <Link key={b.id} to={`/account/bookings/${b.bookingNumber}`} className="card flex items-center gap-4 p-4 transition hover:shadow-lift">
              <img src={imageUrl(b.service.image)} alt="" className="size-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{b.service.name}</p>
                  <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-forest-950/55">
                  <Clock className="size-3.5" /> {fmtSlot(b.slot.startsAt, b.slot.endsAt)}
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

export function PhotoGrid({ images, onDelete }: { images: BookingImage[]; onDelete?: (img: BookingImage) => void }) {
  const [open, setOpen] = useState<BookingImage | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img) => (
          <div key={img.id} className="group relative">
            <button onClick={() => setOpen(img)} className="block aspect-square w-full overflow-hidden rounded-xl bg-sand-100">
              <img src={imageUrl(img.url)} alt={img.caption ?? ""} className="size-full object-cover transition group-hover:scale-105" />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(img)}
                className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 opacity-0 shadow transition group-hover:opacity-100"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} size="lg" title={open?.caption ?? (open?.uploadedBy === "ADMIN" ? "From our team" : "Your photo")}>
        {open && <img src={imageUrl(open.url)} alt="" className="w-full rounded-xl" />}
      </Modal>
    </>
  );
}

export function BookingDetail() {
  const { bookingNumber } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["bookings", bookingNumber],
    queryFn: () => api.get<{ booking: Booking }>(`/bookings/${bookingNumber}`),
  });
  const cancel = useMutation({
    mutationFn: () => api.post<{ booking: Booking }>(`/bookings/${bookingNumber}/cancel`),
    onSuccess: (res) => {
      qc.setQueryData(["bookings", bookingNumber], res);
      qc.invalidateQueries({ queryKey: ["bookings"], exact: true });
      qc.invalidateQueries({ queryKey: ["slots"] });
      toast.success("Booking cancelled");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data)
    return (
      <div className="container-page py-16">
        <EmptyState icon={<CalendarCheck className="size-6" />} title="Booking not found" action={<ButtonLink to="/account/bookings">My bookings</ButtonLink>} />
      </div>
    );
  const b = data.booking;
  const canCancel = b.status === "PENDING" || b.status === "CONFIRMED";
  const yours = b.images.filter((i) => i.uploadedBy === "CUSTOMER");
  const team = b.images.filter((i) => i.uploadedBy === "ADMIN");

  return (
    <div className="container-page max-w-5xl py-10">
      <Link to="/account/bookings" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="size-4" /> All bookings
      </Link>

      {params.get("booked") && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-forest-700 p-5 text-white animate-fade-in">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
          <div>
            <p className="text-lg font-semibold">Booking received!</p>
            <p className="text-sm text-forest-100/80">We'll confirm your slot shortly. You can follow the status here.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold sm:text-3xl">{b.service.name}</h1>
            <Badge tone={bookingStatusTone[b.status]}>{bookingStatusLabel[b.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-forest-950/55">Booking {b.bookingNumber} · made on {fmtDate(b.createdAt)}</p>
        </div>
        {canCancel && (
          <Button variant="outline" loading={cancel.isPending} onClick={() => confirm("Cancel this booking?") && cancel.mutate()} className="text-red-600 hover:border-red-200 hover:bg-red-50">
            Cancel booking
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4 text-forest-600" /> Appointment</p>
              <p className="text-sm">{fmtSlot(b.slot.startsAt, b.slot.endsAt)}</p>
              <p className="mt-2 text-sm text-forest-950/60">Service charge: <span className="font-semibold text-forest-950">{money(b.price)}</span> (pay after service)</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-forest-600" /> Address</p>
              <p className="text-sm">{b.fullName} · {b.phone}</p>
              <p className="text-sm text-forest-950/65">{b.addressLine}, {b.city} – {b.pincode}</p>
            </div>
            {b.notes && (
              <div className="sm:col-span-2">
                <p className="mb-1 text-sm font-semibold">Your notes</p>
                <p className="text-sm text-forest-950/70">{b.notes}</p>
              </div>
            )}
            {b.adminNotes && (
              <div className="rounded-xl bg-forest-50 p-4 sm:col-span-2">
                <p className="mb-1 text-sm font-semibold text-forest-800">Note from our team</p>
                <p className="whitespace-pre-line text-sm text-forest-900/80">{b.adminNotes}</p>
              </div>
            )}
          </section>

          {team.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><ImageIcon className="size-4 text-forest-600" /> Photos from our team</h2>
              <PhotoGrid images={team} />
            </section>
          )}
          {yours.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><ImageIcon className="size-4 text-forest-600" /> Your photos</h2>
              <PhotoGrid images={yours} />
            </section>
          )}
        </div>
        <section className="card h-fit p-6">
          <h2 className="mb-5 font-semibold">Booking status</h2>
          <StatusTimeline flow={BOOKING_FLOW} current={b.status} history={b.history} labels={bookingStatusLabel} cancelled="CANCELLED" />
        </section>
      </div>
    </div>
  );
}

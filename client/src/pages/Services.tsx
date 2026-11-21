import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarCheck, CalendarX, Check, Clock, IndianRupee, Leaf, MapPin } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImagePicker } from "../components/ImagePicker";
import { dayKey, MonthCalendar } from "../components/MonthCalendar";
import { Button, ButtonLink, EmptyState, Field, PageLoader, Skeleton } from "../components/ui";
import { useAuth } from "../context/auth";
import { api, ApiError, errorMessage, qs } from "../lib/api";
import { fmtDuration, fmtSlot, fmtTime, imageUrl, money } from "../lib/format";
import type { Booking, Service, Slot } from "../lib/types";
import { BOOKING_FIELDS, hasErrors, rules, validate, type FieldErrors } from "../lib/validation";
import { focusFirstError, scrollToId } from "../lib/dom";

export function ServicesPage() {
  const { data } = useQuery({ queryKey: ["services"], queryFn: () => api.get<{ services: Service[] }>("/services") });
  return (
    <div>
      <section className="bg-sand-100">
        <div className="container-page py-10 text-center sm:py-14">
          <span className="text-xs font-semibold uppercase tracking-wider text-clay-600">Plant care services</span>
          <h1 className="mx-auto mt-2 max-w-2xl text-3xl font-semibold sm:text-5xl">Expert gardeners, booked in a minute</h1>
          <p className="mx-auto mt-4 max-w-xl text-forest-950/65">
            Choose a service, pick a free slot on the calendar, and our trained gardener visits your home.
          </p>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-3 gap-2 sm:mt-8 sm:gap-4 sm:text-left">
            {[
              { n: 1, t: "Pick a service", d: "Care visit, repotting, pest control and more" },
              { n: 2, t: "Choose a slot", d: "See available dates and times instantly" },
              { n: 3, t: "We'll be there", d: "Track status and photos in My Bookings" },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-soft sm:flex-row sm:items-start sm:gap-3 sm:p-4">
                <span className="flex size-7 shrink-0 sm:size-8 items-center justify-center rounded-full bg-forest-700 text-sm font-bold text-white">{s.n}</span>
                <div>
                  <p className="text-xs font-semibold leading-tight sm:text-base">{s.t}</p>
                  <p className="hidden text-sm text-forest-950/55 sm:block">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-8 sm:py-14">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {data
            ? data.services.map((s) => (
                <Link key={s.id} to={`/services/${s.slug}`} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="aspect-[16/10] overflow-hidden bg-sand-100">
                    <img src={imageUrl(s.image)} alt={s.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-xl font-semibold">{s.name}</h2>
                    <p className="mt-1.5 text-sm text-forest-950/60">{s.shortDescription}</p>
                    <div className="mt-auto flex items-center justify-between pt-5">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-bold">{money(s.price)}</span>
                        <span className="flex items-center gap-1 text-forest-950/50"><Clock className="size-3.5" /> {fmtDuration(s.durationMinutes)}</span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-semibold text-forest-700">
                        Book <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80" />)}
        </div>
      </section>
    </div>
  );
}

export function ServiceDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, requireAuth } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["service", slug],
    queryFn: () => api.get<{ service: Service }>(`/services/${slug}`),
  });

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState<Date | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({ fullName: "", phone: "", addressLine: "", city: "", pincode: "", notes: "" });

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, fullName: f.fullName || user.name, phone: f.phone || user.phone || "" }));
  }, [user]);

  const range = qs({ from: month.toISOString(), to: addMonths(month, 1).toISOString() });
  const slots = useQuery({
    queryKey: ["slots", slug, range],
    queryFn: () => api.get<{ slots: Slot[] }>(`/services/${slug}/slots${range}`),
    enabled: !!data,
  });

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots.data?.slots ?? []) {
      const k = dayKey(s.startsAt);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [slots.data]);
  const marks = useMemo(() => new Map([...byDay].map(([k, v]) => [k, v.length])), [byDay]);

  // Auto-select the first available day when the month's slots load
  useEffect(() => {
    if (!slots.data) return;
    if (day && byDay.has(dayKey(day))) return;
    const first = slots.data.slots[0];
    setDay(first ? new Date(first.startsAt) : null);
    setSlotId(null);
  }, [slots.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const daySlots = day ? (byDay.get(dayKey(day)) ?? []) : [];
  const selectedSlot = slots.data?.slots.find((s) => s.id === slotId);

  const book = useMutation({
    mutationFn: (payload: FormData) => api.post<{ booking: Booking }>("/bookings", payload),
    onSuccess: ({ booking }) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
      navigate(`/account/bookings/${booking.bookingNumber}?booked=1`, { replace: true });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        // Someone else just took this slot: only now drop the choice and refresh the free times.
        setError(e.message);
        setSlotId(null);
        qc.invalidateQueries({ queryKey: ["slots"] });
        scrollToId("times");
        return;
      }
      if (e instanceof ApiError && hasErrors(e.fields)) {
        // A detail the server rejected: keep the chosen slot and point at the field.
        setFieldErrors(e.fields);
        setError("");
        focusFirstError(e.fields);
        return;
      }
      setError(errorMessage(e));
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data)
    return (
      <div className="container-page py-16">
        <EmptyState icon={<Leaf className="size-6" />} title="Service not found" action={<ButtonLink to="/services">All services</ButtonLink>} />
      </div>
    );
  const service = data.service;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problems = validate(form, BOOKING_FIELDS);
    setFieldErrors(problems);
    if (!slotId) {
      setError("Please choose a time slot");
      scrollToId("times");
      return;
    }
    if (hasErrors(problems)) {
      focusFirstError(problems);
      return;
    }
    const fd = new FormData();
    fd.set("serviceId", String(service.id));
    fd.set("slotId", String(slotId));
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    files.forEach((f) => fd.append("images", f));
    requireAuth(() => book.mutate(fd), "Sign in to confirm your booking");
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    // Clear a field's message as soon as what's typed is acceptable.
    if (fieldErrors[k] && !rules[k](value)) setFieldErrors(({ [k]: _fixed, ...rest }) => rest);
  };

  return (
    <div className="container-page py-8">
      <Link to="/services" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="size-4" /> All services
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        {/* Service info */}
        <div>
          <div className="overflow-hidden rounded-3xl bg-sand-100">
            <img src={imageUrl(service.image)} alt={service.name} className="aspect-[16/10] w-full object-cover" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">{service.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-soft"><IndianRupee className="size-3.5" /> {money(service.price).replace("₹", "")}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium shadow-soft"><Clock className="size-3.5" /> {fmtDuration(service.durationMinutes)}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium shadow-soft">Pay after service</span>
          </div>
          <p className="mt-5 leading-relaxed text-forest-950/70">{service.description}</p>
        </div>

        {/* Booking */}
        <form onSubmit={submit} className="space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><CalendarCheck className="size-5 text-forest-600" /> 1. Pick a date</h2>
            <p className="mb-5 text-sm text-forest-950/55">Highlighted dates have free slots.</p>
            <MonthCalendar
              month={month}
              onMonthChange={(m) => { setMonth(m); setDay(null); setSlotId(null); }}
              selected={day}
              onSelect={(d) => {
                setDay(d);
                setSlotId(null);
                // On phones the times are below the calendar, so bring them into view.
                if (window.matchMedia("(max-width: 1023px)").matches) {
                  setTimeout(() => document.getElementById("times")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }
              }}
              marks={marks}
              minDate={new Date()}
              loading={slots.isFetching}
            />
            {slots.data && slots.data.slots.length === 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-sand-100 p-3 text-sm text-forest-950/70">
                <CalendarX className="size-4" /> No free slots this month. Try the next month.
              </div>
            )}
          </section>

          <section id="times" className="card scroll-mt-20 p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Clock className="size-5 text-forest-600" /> 2. Choose a time {day && <span className="text-sm font-normal text-forest-950/50">· {format(day, "EEE, d MMM")}</span>}</h2>
            {!day ? (
              <p className="text-sm text-forest-950/55">Select a date to see available times.</p>
            ) : daySlots.length === 0 ? (
              <p className="text-sm text-forest-950/55">No free slots on this day.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {daySlots.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSlotId(s.id)}
                    className={clsx(
                      "relative flex min-h-14 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition",
                      slotId === s.id ? "border-forest-700 bg-forest-700 text-white" : "border-sand-200 bg-white hover:border-forest-400",
                    )}
                  >
                    {slotId === s.id && <Check className="absolute right-2 top-2 size-4" />}
                    <span className="whitespace-nowrap text-sm font-semibold">{fmtTime(s.startsAt)}</span>
                    <span className={clsx("whitespace-nowrap text-xs", slotId === s.id ? "text-forest-100" : "text-forest-950/50")}>until {fmtTime(s.endsAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><MapPin className="size-5 text-forest-600" /> 3. Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={fieldErrors.fullName}><input name="fullName" className="input" value={form.fullName} onChange={set("fullName")} autoComplete="name" /></Field>
              <Field label="Phone" error={fieldErrors.phone}><input name="phone" className="input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" /></Field>
              <Field label="Address" error={fieldErrors.addressLine} hint="House no., street, area, landmark" className="sm:col-span-2">
                <textarea name="addressLine" className="input min-h-20" value={form.addressLine} onChange={set("addressLine")} placeholder="e.g. 12, Gandhi Nagar, near bus stand" autoComplete="street-address" />
              </Field>
              <Field label="City" error={fieldErrors.city}><input name="city" className="input" value={form.city} onChange={set("city")} autoComplete="address-level2" /></Field>
              <Field label="Pincode" error={fieldErrors.pincode}><input name="pincode" className="input" inputMode="numeric" maxLength={6} value={form.pincode} onChange={set("pincode")} autoComplete="postal-code" /></Field>
              <Field label="Notes for the gardener" error={fieldErrors.notes} hint="Optional – number of plants, problems you've noticed, etc." className="sm:col-span-2">
                <textarea name="notes" className="input min-h-20" value={form.notes} onChange={set("notes")} />
              </Field>
              <Field label="Photos of your plants" hint="Optional – up to 4 images, 5 MB each" className="sm:col-span-2">
                <ImagePicker files={files} onChange={setFiles} />
              </Field>
            </div>
          </section>

          <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <p className="text-sm text-forest-950/55">{selectedSlot ? fmtSlot(selectedSlot.startsAt, selectedSlot.endsAt) : "No slot selected"}</p>
              <p className="text-xl font-bold">{money(service.price)} <span className="text-sm font-normal text-forest-950/50">· pay after service</span></p>
            </div>
            {/* Never silently disabled: pressing it explains what's missing (time slot or a field). */}
            <Button type="submit" size="lg" className="w-full sm:w-auto" loading={book.isPending}>
              Confirm booking
            </Button>
            {error && <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            {!error && hasErrors(fieldErrors) && (
              <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                Please fix the highlighted details above.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

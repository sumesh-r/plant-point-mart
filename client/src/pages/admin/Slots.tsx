import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMinutes, addMonths, eachDayOfInterval, format, isAfter, parse, startOfDay, startOfMonth } from "date-fns";
import { Ban, CalendarPlus, Lock, Trash2, Unlock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { dayKey, MonthCalendar } from "../../components/MonthCalendar";
import { Badge, Button, Field, Modal, PageHeader } from "../../components/ui";
import { api, errorMessage, qs } from "../../lib/api";
import { bookingStatusLabel, bookingStatusTone, fmtTime } from "../../lib/format";
import type { AdminSlot, Service } from "../../lib/types";

export default function AdminSlots() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState<Date | null>(() => startOfDay(new Date()));
  const [adding, setAdding] = useState(false);

  const range = qs({ from: month.toISOString(), to: addMonths(month, 1).toISOString() });
  const { data, isFetching } = useQuery({ queryKey: ["admin", "slots", range], queryFn: () => api.get<{ slots: AdminSlot[] }>(`/admin/slots${range}`) });

  const byDay = useMemo(() => {
    const m = new Map<string, AdminSlot[]>();
    for (const s of data?.slots ?? []) {
      const k = dayKey(s.startsAt);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [data]);
  const marks = useMemo(() => new Map([...byDay].map(([k, v]) => [k, v.length])), [byDay]);
  const daySlots = day ? (byDay.get(dayKey(day)) ?? []) : [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "slots"] });
    qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    qc.invalidateQueries({ queryKey: ["slots"] });
  };
  const setStatus = useMutation({
    mutationFn: (v: { id: number; status: "AVAILABLE" | "BLOCKED" }) => api.patch(`/admin/slots/${v.id}`, { status: v.status }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del<{ blocked?: boolean }>(`/admin/slots/${id}`),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.blocked ? "Slot has past bookings, so it was blocked instead" : "Slot removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const clearDay = useMutation({
    mutationFn: (d: Date) => api.post<{ deleted: number }>("/admin/slots/clear", { from: startOfDay(d).toISOString(), to: addDays(startOfDay(d), 1).toISOString() }),
    onSuccess: (r) => { invalidate(); toast.success(`${r.deleted} free slot(s) removed`); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Free slots"
        subtitle="Open the times when customers can book a service visit"
        action={<Button onClick={() => setAdding(true)}><CalendarPlus className="size-4" /> Add free slots</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-5 sm:p-6">
          <MonthCalendar
            month={month}
            onMonthChange={(m) => { setMonth(m); setDay(null); }}
            selected={day}
            onSelect={(d) => {
              setDay(d);
              // On phones the day's slots are below the calendar, so bring them into view.
              if (window.matchMedia("(max-width: 1023px)").matches) {
                setTimeout(() => document.getElementById("day-slots")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }
            }}
            marks={marks}
            allowUnmarked
            loading={isFetching}
            renderMark={(_, d) => {
              const list = byDay.get(dayKey(d)) ?? [];
              const free = list.filter((s) => s.status === "AVAILABLE").length;
              const booked = list.filter((s) => s.status === "BOOKED").length;
              return (
                <span className="flex items-center gap-1">
                  {free > 0 && <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-forest-500" />{free}</span>}
                  {booked > 0 && <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-clay-500" />{booked}</span>}
                </span>
              );
            }}
          />
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-forest-950/60">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-forest-500" /> Free</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-clay-500" /> Booked</span>
          </div>
        </section>

        <section id="day-slots" className="card scroll-mt-20 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{day ? format(day, "EEEE, d MMMM") : "Select a day"}</h2>
            {day && daySlots.some((s) => s.status !== "BOOKED") && (
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" loading={clearDay.isPending} onClick={() => confirm("Remove all free slots on this day?") && clearDay.mutate(day)}>
                <X className="size-3.5" /> Clear free slots
              </Button>
            )}
          </div>
          {!day ? (
            <p className="text-sm text-forest-950/55">Pick a date on the calendar to see and manage its slots.</p>
          ) : daySlots.length === 0 ? (
            <div className="rounded-xl bg-sand-100/70 p-6 text-center">
              <p className="text-sm text-forest-950/60">No slots on this day.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdding(true)}><CalendarPlus className="size-3.5" /> Add slots</Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {daySlots.map((s) => {
                const booking = s.bookings[0];
                const past = !isAfter(new Date(s.startsAt), new Date());
                return (
                  <li key={s.id} className={clsx("flex flex-wrap items-center gap-3 rounded-xl border p-3", s.status === "BOOKED" ? "border-clay-400/40 bg-orange-50/40" : s.status === "BLOCKED" ? "border-sand-200 bg-sand-100/60" : "border-forest-200 bg-forest-50/40")}>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-nowrap text-sm font-semibold">{fmtTime(s.startsAt)} – {fmtTime(s.endsAt)}</p>
                      <p className="text-xs text-forest-950/55">{s.service ? `Only for ${s.service.name}` : "Any service"}</p>
                    </div>
                    {s.status === "BOOKED" && booking ? (
                      <Link to={`/admin/bookings?open=${booking.id}`} className="flex items-center gap-2 text-xs font-medium hover:underline">
                        {booking.fullName} · {booking.service.name}
                        <Badge tone={bookingStatusTone[booking.status]}>{bookingStatusLabel[booking.status]}</Badge>
                      </Link>
                    ) : (
                      <>
                        <Badge tone={s.status === "AVAILABLE" ? "green" : "gray"}>{s.status === "AVAILABLE" ? (past ? "Expired" : "Free") : "Blocked"}</Badge>
                        {!past && (
                          <div className="flex gap-1">
                            {s.status === "AVAILABLE" ? (
                              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "BLOCKED" })} title="Block this slot"><Lock className="size-3.5" /></Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "AVAILABLE" })} title="Make available"><Unlock className="size-3.5" /></Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove.mutate(s.id)} title="Delete slot"><Trash2 className="size-3.5" /></Button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {adding && <AddSlots initialDate={day ?? new Date()} onClose={() => setAdding(false)} onDone={invalidate} />}
    </div>
  );
}

const WEEKDAYS = [
  { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" }, { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" },
];
const PRESET_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

function AddSlots({ initialDate, onClose, onDone }: { initialDate: Date; onClose: () => void; onDone: () => void }) {
  const services = useQuery({ queryKey: ["admin", "services"], queryFn: () => api.get<{ services: Service[] }>("/admin/services") });
  const [repeat, setRepeat] = useState(false);
  const [from, setFrom] = useState(format(isAfter(initialDate, new Date()) ? initialDate : addDays(new Date(), 1), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(addDays(new Date(from), 13), "yyyy-MM-dd"));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [times, setTimes] = useState<string[]>(["09:00", "11:00", "14:00", "16:00"]);
  const [customTime, setCustomTime] = useState("");
  const [duration, setDuration] = useState("120");
  const [serviceId, setServiceId] = useState("");

  const slots = useMemo(() => {
    const start = parse(from, "yyyy-MM-dd", new Date());
    const end = repeat ? parse(to, "yyyy-MM-dd", new Date()) : start;
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const days = eachDayOfInterval({ start, end }).filter((d) => !repeat || weekdays.includes(d.getDay()));
    const now = new Date();
    const out: { startsAt: string; endsAt: string }[] = [];
    for (const d of days) {
      for (const t of [...times].sort()) {
        const s = parse(t, "HH:mm", d);
        if (s > now) out.push({ startsAt: s.toISOString(), endsAt: addMinutes(s, Number(duration) || 60).toISOString() });
      }
    }
    return out;
  }, [from, to, repeat, weekdays, times, duration]);

  const create = useMutation({
    mutationFn: () => api.post<{ created: number; skipped: number }>("/admin/slots", { serviceId: serviceId ? Number(serviceId) : null, slots }),
    onSuccess: (r) => {
      onDone();
      toast.success(`${r.created} slot(s) added${r.skipped ? `, ${r.skipped} already existed` : ""}`);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (active: boolean) =>
    clsx("rounded-lg border px-3 py-2 text-sm font-semibold transition sm:py-1.5 sm:text-xs", active ? "border-forest-700 bg-forest-700 text-white" : "border-sand-200 bg-white hover:border-forest-400");

  return (
    <Modal open onClose={onClose} size="lg" title="Add free slots">
      <div className="space-y-5">
        <div className="inline-flex rounded-xl bg-sand-100 p-1">
          <button className={clsx("rounded-lg px-4 py-1.5 text-sm font-semibold", !repeat && "bg-white shadow-sm")} onClick={() => setRepeat(false)}>Single day</button>
          <button className={clsx("rounded-lg px-4 py-1.5 text-sm font-semibold", repeat && "bg-white shadow-sm")} onClick={() => setRepeat(true)}>Repeat over dates</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={repeat ? "From date" : "Date"}>
            <input type="date" className="input" value={from} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          {repeat && (
            <Field label="To date">
              <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
          )}
        </div>

        {repeat && (
          <Field label="On these days">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w) => (
                <button type="button" key={w.v} className={chip(weekdays.includes(w.v))} onClick={() => setWeekdays(toggle(weekdays, w.v))}>{w.l}</button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Start times">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...PRESET_TIMES, ...times])].sort().map((t) => (
              <button type="button" key={t} className={chip(times.includes(t))} onClick={() => setTimes(toggle(times, t))}>
                {format(parse(t, "HH:mm", new Date()), "h:mm a")}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input type="time" className="input h-8 w-28 py-0 text-xs" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
              <Button type="button" size="sm" variant="outline" disabled={!customTime} onClick={() => { setTimes((ts) => [...new Set([...ts, customTime])]); setCustomTime(""); }}>Add</Button>
            </div>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slot length">
            <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`}</option>)}
            </select>
          </Field>
          <Field label="For service" hint="'Any service' slots can be booked for every service">
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Any service</option>
              {services.data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-forest-50 p-4">
          <p className="text-sm text-forest-900">
            {slots.length ? <><span className="font-bold">{slots.length}</span> slot{slots.length > 1 && "s"} will be created</> : <span className="flex items-center gap-1.5"><Ban className="size-4" /> No future slots match these settings</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!slots.length || slots.length > 500} loading={create.isPending} onClick={() => create.mutate()}>Add slots</Button>
          </div>
        </div>
        {slots.length > 500 && <p className="text-xs text-red-600">That's more than 500 slots. Please choose a shorter date range.</p>}
      </div>
    </Modal>
  );
}

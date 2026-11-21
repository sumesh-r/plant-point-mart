import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ImagePicker } from "../../components/ImagePicker";
import { Badge, Button, Field, Modal, PageHeader, PageLoader } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { fmtDuration, imageUrl, money } from "../../lib/format";
import type { Service } from "../../lib/types";

export default function AdminServices() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "services"], queryFn: () => api.get<{ services: Service[] }>("/admin/services") });
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "services"] });
    qc.invalidateQueries({ queryKey: ["services"] });
    qc.invalidateQueries({ queryKey: ["service"] });
  };
  const del = useMutation({
    mutationFn: (id: number) => api.del(`/admin/services/${id}`),
    onSuccess: () => { invalidate(); toast.success("Service deleted"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="Services" subtitle="Plant care services customers can book" action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add service</Button>} />
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data?.services.map((s) => (
            <div key={s.id} className="card overflow-hidden">
              <img src={imageUrl(s.image)} alt="" className="aspect-[16/9] w-full object-cover" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{s.name}</p>
                  {s.isActive ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-forest-950/60">{s.shortDescription}</p>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="font-bold">{money(s.price)}</span>
                  <span className="flex items-center gap-1 text-forest-950/50"><Clock className="size-3.5" /> {fmtDuration(s.durationMinutes)}</span>
                  <span className="text-forest-950/50">· {s._count?.bookings ?? 0} bookings</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}><Pencil className="size-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => confirm(`Delete "${s.name}"?`) && del.mutate(s.id)}><Trash2 className="size-3.5" /> Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <ServiceEditor service={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={invalidate} />}
    </div>
  );
}

function ServiceEditor({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: service?.name ?? "",
    shortDescription: service?.shortDescription ?? "",
    description: service?.description ?? "",
    price: service ? String(service.price) : "",
    durationMinutes: service ? String(service.durationMinutes) : "60",
    isActive: service?.isActive ?? true,
  });
  const [files, setFiles] = useState<File[]>([]);
  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)));
      if (files[0]) fd.set("image", files[0]);
      return service ? api.patch(`/admin/services/${service.id}`, fd) : api.post("/admin/services", fd);
    },
    onSuccess: () => { onSaved(); toast.success("Service saved"); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open onClose={onClose} size="lg" title={service ? "Edit service" : "Add service"}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><input className="input" value={form.name} onChange={set("name")} required /></Field>
          <Field label="Price (₹)"><input className="input" type="number" min={1} value={form.price} onChange={set("price")} required /></Field>
          <Field label="Duration (minutes)"><input className="input" type="number" min={15} step={15} value={form.durationMinutes} onChange={set("durationMinutes")} required /></Field>
          <Field label="Short description" className="sm:col-span-2"><input className="input" value={form.shortDescription} onChange={set("shortDescription")} required minLength={5} /></Field>
          <Field label="Full description" className="sm:col-span-2"><textarea className="input min-h-28" value={form.description} onChange={set("description")} required minLength={10} /></Field>
          <Field label="Image" className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {service?.image && !files.length && <img src={imageUrl(service.image)} alt="" className="h-20 w-32 rounded-xl object-cover" />}
              <ImagePicker files={files} onChange={setFiles} max={1} label={service?.image ? "Replace" : "Choose"} />
            </div>
          </Field>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-forest-700" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Visible to customers
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-sand-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save service</Button>
        </div>
      </form>
    </Modal>
  );
}

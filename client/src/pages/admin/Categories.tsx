import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ImagePicker } from "../../components/ImagePicker";
import { Button, Field, Modal, PageHeader, PageLoader } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { imageUrl } from "../../lib/format";
import type { Category } from "../../lib/types";

type AdminCategory = Category & { _count: { products: number } };

export default function AdminCategories() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api.get<{ categories: AdminCategory[] }>("/admin/categories") });
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };
  const del = useMutation({
    mutationFn: (id: number) => api.del(`/admin/categories/${id}`),
    onSuccess: () => { invalidate(); toast.success("Category deleted"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="Categories" subtitle="Group your plants so customers can find them" action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add category</Button>} />
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data?.categories.map((c) => (
            <div key={c.id} className="card flex items-center gap-4 p-4">
              <img src={imageUrl(c.image)} alt="" className="size-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-forest-950/55">{c._count.products} products</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label="Edit"><Pencil className="size-3.5" /></Button>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => confirm(`Delete "${c.name}"?`) && del.mutate(c.id)} aria-label="Delete"><Trash2 className="size-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
      {editing && <CategoryEditor category={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={invalidate} />}
    </div>
  );
}

function CategoryEditor({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("description", description);
      if (files[0]) fd.set("image", files[0]);
      return category ? api.patch(`/admin/categories/${category.id}`, fd) : api.post("/admin/categories", fd);
    },
    onSuccess: () => { onSaved(); toast.success("Category saved"); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={category ? "Edit category" : "Add category"}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Description"><textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Image" hint={category?.image ? "Choose a new image to replace the current one" : undefined}>
          <div className="flex items-center gap-3">
            {category?.image && !files.length && <img src={imageUrl(category.image)} alt="" className="size-20 rounded-xl object-cover" />}
            <ImagePicker files={files} onChange={setFiles} max={1} label="Choose" />
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

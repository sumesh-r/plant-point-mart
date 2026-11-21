import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flower2, Pencil, Plus, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ImagePicker } from "../../components/ImagePicker";
import { Badge, Button, EmptyState, Field, Modal, PageHeader, PageLoader } from "../../components/ui";
import { api, errorMessage, qs } from "../../lib/api";
import { imageUrl, money } from "../../lib/format";
import type { Category, Product } from "../../lib/types";
import { MobileCard, MobileList, SearchInput, Table, Td, Th } from "./shared";

export default function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const qc = useQueryClient();
  const query = qs({ q, category });
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", query],
    queryFn: () => api.get<{ products: Product[] }>(`/admin/products${query}`),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.get<{ categories: Category[] }>("/categories") });

  const editId = params.get("edit");
  const editing = editId === "new" ? "new" : editId ? Number(editId) : null;
  const close = () => setParams({});

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/admin/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Plants & products"
        subtitle="Add, edit and remove items in your store"
        action={<Button onClick={() => setParams({ edit: "new" })}><Plus className="size-4" /> Add product</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name" />
        <select className="input w-full sm:w-auto" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data?.products.length ? (
        <EmptyState icon={<Flower2 className="size-6" />} title="No products" description="Add your first plant to start selling." />
      ) : (
        <>
        <MobileList>
          {data.products.map((p) => (
            <MobileCard key={p.id} onClick={() => setParams({ edit: String(p.id) })}>
              <div className="flex items-center gap-3">
                <img src={imageUrl(p.images[0]?.url)} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-forest-950/50">{p.category.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold">{money(p.price)}</span>
                    <Badge tone={p.stock === 0 ? "red" : p.stock < 5 ? "amber" : "gray"}>{p.stock === 0 ? "Sold out" : `${p.stock} in stock`}</Badge>
                    {!p.isActive && <Badge>Hidden</Badge>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-10 shrink-0 p-0 text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${p.name}"? This also deletes its images.`)) del.mutate(p.id);
                  }}
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </MobileCard>
          ))}
        </MobileList>
        <Table mobile={false}>
          <thead>
            <tr><Th>Product</Th><Th>Category</Th><Th>Price</Th><Th>Stock</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className="hover:bg-sand-100/30">
                <Td>
                  <div className="flex items-center gap-3">
                    <img src={imageUrl(p.images[0]?.url)} alt="" className="size-11 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="max-w-64 truncate font-medium">{p.name}</p>
                      <p className="text-xs text-forest-950/45">{p.images.length} image{p.images.length !== 1 && "s"}</p>
                    </div>
                  </div>
                </Td>
                <Td className="text-forest-950/70">{p.category.name}</Td>
                <Td className="font-semibold">{money(p.price)}</Td>
                <Td>
                  <Badge tone={p.stock === 0 ? "red" : p.stock < 5 ? "amber" : "gray"}>{p.stock}</Badge>
                </Td>
                <Td>{p.isActive ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setParams({ edit: String(p.id) })}><Pencil className="size-3.5" /> Edit</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => confirm(`Delete "${p.name}"? This also deletes its images.`) && del.mutate(p.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        </>
      )}

      {editing !== null && <ProductEditor id={editing} categories={categories.data?.categories ?? []} onClose={close} onCreated={(id) => setParams({ edit: String(id) })} />}
    </div>
  );
}

const empty = { name: "", description: "", price: "", mrp: "", stock: "10", categoryId: "", careLevel: "", light: "", water: "", isActive: true };

function ProductEditor({ id, categories, onClose, onCreated }: { id: number | "new"; categories: Category[]; onClose: () => void; onCreated: (id: number) => void }) {
  const qc = useQueryClient();
  const isNew = id === "new";
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => api.get<{ product: Product }>(`/admin/products/${id}`),
    enabled: !isNew,
  });
  const product = data?.product;
  const [form, setForm] = useState(empty);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product)
      setForm({
        name: product.name,
        description: product.description,
        price: String(product.price),
        mrp: product.mrp ? String(product.mrp) : "",
        stock: String(product.stock),
        categoryId: String(product.categoryId),
        careLevel: product.careLevel ?? "",
        light: product.light ?? "",
        water: product.water ?? "",
        isActive: product.isActive,
      });
    else if (isNew) setForm({ ...empty, categoryId: categories[0] ? String(categories[0].id) : "" });
  }, [product, isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = (p: Product) => {
    qc.setQueryData(["admin", "product", p.id], { product: p });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        categoryId: Number(form.categoryId),
        mrp: form.mrp ? Number(form.mrp) : null,
      };
      let { product: saved } = isNew
        ? await api.post<{ product: Product }>("/admin/products", body)
        : await api.patch<{ product: Product }>(`/admin/products/${id}`, body);
      if (isNew && newFiles.length) {
        const fd = new FormData();
        newFiles.forEach((f) => fd.append("images", f));
        saved = (await api.post<{ product: Product }>(`/admin/products/${saved.id}/images`, fd)).product;
      }
      return saved;
    },
    onSuccess: (p) => {
      refresh(p);
      toast.success(isNew ? "Product created" : "Product saved");
      if (isNew) onCreated(p.id);
      else onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      return api.post<{ product: Product }>(`/admin/products/${id}/images`, fd);
    },
    onSuccess: ({ product }) => { refresh(product); toast.success("Images uploaded"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeImg = useMutation({
    mutationFn: (imageId: number) => api.del<{ product: Product }>(`/admin/products/${id}/images/${imageId}`),
    onSuccess: ({ product }) => refresh(product),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const makePrimary = useMutation({
    mutationFn: (imageId: number) => api.post<{ product: Product }>(`/admin/products/${id}/images/${imageId}/primary`),
    onSuccess: ({ product }) => refresh(product),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? "Add product" : "Edit product"}>
      {!isNew && isLoading ? (
        <PageLoader />
      ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><input className="input" value={form.name} onChange={set("name")} required /></Field>
            <Field label="Category">
              <select className="input" value={form.categoryId} onChange={set("categoryId")} required>
                <option value="" disabled>Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Stock"><input className="input" type="number" min={0} value={form.stock} onChange={set("stock")} required /></Field>
            <Field label="Selling price (₹)"><input className="input" type="number" min={1} value={form.price} onChange={set("price")} required /></Field>
            <Field label="MRP (₹)" hint="Optional – shows a discount"><input className="input" type="number" min={1} value={form.mrp} onChange={set("mrp")} /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea className="input min-h-24" value={form.description} onChange={set("description")} required minLength={10} /></Field>
            <Field label="Care level">
              <select className="input" value={form.careLevel} onChange={set("careLevel")}>
                <option value="">—</option><option>Easy</option><option>Moderate</option><option>Expert</option>
              </select>
            </Field>
            <Field label="Light"><input className="input" value={form.light} onChange={set("light")} placeholder="e.g. Bright indirect" /></Field>
            <Field label="Water"><input className="input" value={form.water} onChange={set("water")} placeholder="e.g. Once a week" /></Field>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-forest-700" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Visible to customers
            </label>
          </div>

          <div>
            <p className="label">Images</p>
            {isNew ? (
              <ImagePicker files={newFiles} onChange={setNewFiles} max={8} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {product?.images.map((img, i) => (
                  <div key={img.id} className="group relative size-24 overflow-hidden rounded-xl bg-sand-100">
                    <img src={imageUrl(img.url)} alt="" className="size-full object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-forest-700 px-1.5 py-0.5 text-[10px] font-bold text-white">Main</span>}
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                      {i !== 0 && (
                        <button type="button" onClick={() => makePrimary.mutate(img.id)} className="rounded-md bg-white/90 p-1 text-forest-800" title="Make main image">
                          <Star className="size-3.5" />
                        </button>
                      )}
                      <button type="button" onClick={() => confirm("Delete this image?") && removeImg.mutate(img.id)} className="rounded-md bg-white/90 p-1 text-red-600" title="Delete image">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={upload.isPending}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-300 text-xs font-medium text-forest-950/50 hover:border-forest-400 hover:text-forest-700"
                >
                  <Upload className="size-5" /> {upload.isPending ? "Uploading…" : "Upload"}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) upload.mutate(files);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            <p className="mt-1.5 text-xs text-forest-950/50">JPG, PNG or WEBP up to 5 MB. The first image is shown in the shop.</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-sand-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{isNew ? "Create product" : "Save changes"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

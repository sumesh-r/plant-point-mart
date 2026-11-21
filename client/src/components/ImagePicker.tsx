import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

/** Local file picker with previews. Files are uploaded by the parent form. */
export function ImagePicker({
  files,
  onChange,
  max = 4,
  label = "Add photos",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="flex flex-wrap gap-3">
      {previews.map((src, i) => (
        <div key={src} className="relative size-20 overflow-hidden rounded-xl bg-sand-100">
          <img src={src} alt="" className="size-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute right-1 top-1 rounded-full bg-forest-950/70 p-0.5 text-white hover:bg-forest-950"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {files.length < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-sand-300 text-xs font-medium text-forest-950/50 transition hover:border-forest-400 hover:text-forest-700"
        >
          <ImagePlus className="size-5" />
          {label}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).filter((f) => f.size <= 5 * 1024 * 1024);
          onChange([...files, ...picked].slice(0, max));
          e.target.value = "";
        }}
      />
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, ShoppingBag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ButtonLink, EmptyState, Field, PageHeader, PageLoader } from "../components/ui";
import { useAuth } from "../context/auth";
import { api, ApiError, errorMessage } from "../lib/api";
import { useCart } from "../lib/cart";
import { imageUrl, money } from "../lib/format";
import type { Order } from "../lib/types";
import { ADDRESS_FIELDS, hasErrors, rules, validate, type FieldErrors } from "../lib/validation";
import { focusFirstError } from "../lib/dom";

const ADDRESS_KEY = "ppm:lastAddress";

function loadAddress() {
  try {
    return JSON.parse(localStorage.getItem(ADDRESS_KEY) ?? "null");
  } catch {
    return null;
  }
}

export default function Checkout() {
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    fullName: user?.name ?? "",
    phone: user?.phone ?? "",
    addressLine: "",
    city: "",
    state: "Tamil Nadu",
    pincode: "",
    ...loadAddress(),
  }));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const place = useMutation({
    mutationFn: () => api.post<{ order: Order }>("/orders", form),
    onSuccess: ({ order }) => {
      try {
        localStorage.setItem(ADDRESS_KEY, JSON.stringify(form));
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate(`/account/orders/${order.orderNumber}?placed=1`, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && hasErrors(err.fields)) {
        setFieldErrors(err.fields);
        focusFirstError(err.fields);
        return;
      }
      setError(errorMessage(err));
    },
  });

  const set = (k: (typeof ADDRESS_FIELDS)[number]) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f: typeof form) => ({ ...f, [k]: value }));
    if (fieldErrors[k] && !rules[k](value)) setFieldErrors(({ [k]: _fixed, ...rest }) => rest);
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problems = validate(form, ADDRESS_FIELDS);
    setFieldErrors(problems);
    if (hasErrors(problems)) return focusFirstError(problems);
    place.mutate();
  }

  if (isLoading) return <PageLoader />;
  if (!cart || cart.items.length === 0)
    return (
      <div className="container-page py-16">
        <EmptyState icon={<ShoppingBag className="size-6" />} title="Your cart is empty" action={<ButtonLink to="/plants">Shop plants</ButtonLink>} />
      </div>
    );

  return (
    <div className="container-page py-10">
      <PageHeader title="Checkout" subtitle="Where should we deliver your plants?" />
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-semibold">Delivery address</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={fieldErrors.fullName}>
                <input name="fullName" className="input" value={form.fullName} onChange={set("fullName")} autoComplete="name" />
              </Field>
              <Field label="Phone number" error={fieldErrors.phone}>
                <input name="phone" className="input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </Field>
              <Field label="Address" error={fieldErrors.addressLine} hint="House no., street, area, landmark" className="sm:col-span-2">
                <textarea name="addressLine" className="input min-h-20" value={form.addressLine} onChange={set("addressLine")} placeholder="e.g. 12, Gandhi Nagar, near bus stand" autoComplete="street-address" />
              </Field>
              <Field label="City" error={fieldErrors.city}>
                <input name="city" className="input" value={form.city} onChange={set("city")} autoComplete="address-level2" />
              </Field>
              <Field label="State" error={fieldErrors.state}>
                <input name="state" className="input" value={form.state} onChange={set("state")} autoComplete="address-level1" />
              </Field>
              <Field label="Pincode" error={fieldErrors.pincode}>
                <input name="pincode" className="input" inputMode="numeric" maxLength={6} value={form.pincode} onChange={set("pincode")} autoComplete="postal-code" />
              </Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">Payment</h2>
            <label className="mt-4 flex items-start gap-3 rounded-xl border-2 border-forest-600 bg-forest-50/50 p-4">
              <input type="radio" checked readOnly className="mt-1 accent-forest-700" />
              <div className="flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <HandCoins className="size-4 text-forest-700" /> Cash on Delivery
                </p>
                <p className="mt-0.5 text-sm text-forest-950/60">Pay in cash or UPI to the delivery partner when your order arrives.</p>
              </div>
            </label>
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Your order</h2>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {cart.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <div className="relative">
                  <img src={imageUrl(i.product.images[0]?.url)} alt="" className="size-14 rounded-lg object-cover" />
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-forest-800 text-[10px] font-bold text-white">{i.quantity}</span>
                </div>
                <p className="flex-1 text-sm font-medium leading-snug">{i.product.name}</p>
                <p className="text-sm font-semibold">{money(i.product.price * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2.5 border-t border-sand-200 pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-forest-950/60">Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-forest-950/60">Delivery</dt><dd>{cart.shippingFee ? money(cart.shippingFee) : "Free"}</dd></div>
            <div className="flex justify-between pt-2 text-base"><dt className="font-semibold">Total to pay on delivery</dt><dd className="font-bold">{money(cart.total)}</dd></div>
          </dl>
          {(error || hasErrors(fieldErrors)) && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error || "Please fix the highlighted address details."}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-6 w-full" loading={place.isPending}>
            Place order
          </Button>
        </aside>
      </form>
    </div>
  );
}

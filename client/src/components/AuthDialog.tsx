import { Leaf } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/auth";
import { api, errorMessage } from "../lib/api";
import type { User } from "../lib/types";
import { Button, Field, Modal } from "./ui";

export function AuthDialog() {
  const { dialog, closeAuth, setMode, onAuthenticated } = useAuth();
  const isLogin = dialog.mode === "login";
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dialog.open) setError("");
  }, [dialog.open, dialog.mode]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = isLogin
        ? await api.post<{ user: User }>("/auth/login", { email: form.email, password: form.password })
        : await api.post<{ user: User }>("/auth/register", form);
      setForm({ name: "", email: "", phone: "", password: "" });
      onAuthenticated(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={dialog.open} onClose={closeAuth} size="sm">
      <div className="-mt-4 mb-6 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-forest-700 text-forest-100">
          <Leaf className="size-6" />
        </div>
        <h2 className="text-2xl font-semibold">{isLogin ? "Welcome back" : "Create your account"}</h2>
        <p className="mt-1 text-sm text-forest-950/60">
          {dialog.reason ?? (isLogin ? "Sign in to continue to Plant Point Mart" : "Join to shop plants and book services")}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {!isLogin && (
          <Field label="Full name">
            <input className="input" value={form.name} onChange={set("name")} required autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
        </Field>
        {!isLogin && (
          <Field label="Phone" hint="Optional – used for delivery and service updates">
            <input className="input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
          </Field>
        )}
        <Field label="Password">
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={isLogin ? 1 : 6}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <Button type="submit" className="w-full" size="lg" loading={busy}>
          {isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-forest-950/60">
        {isLogin ? "New to Plant Point Mart?" : "Already have an account?"}{" "}
        <button className="font-semibold text-forest-700 hover:underline" onClick={() => setMode(isLogin ? "register" : "login")}>
          {isLogin ? "Create an account" : "Sign in"}
        </button>
      </p>
    </Modal>
  );
}

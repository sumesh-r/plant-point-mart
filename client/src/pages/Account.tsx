import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarCheck, KeyRound, Package, ShieldAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button, ButtonLink, EmptyState, Field, PageHeader } from "../components/ui";
import { useAuth } from "../context/auth";
import { api, errorMessage } from "../lib/api";
import type { User } from "../lib/types";

export function Account() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ name: user!.name, phone: user!.phone ?? "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const mismatch = pw.confirm.length > 0 && pw.confirm !== pw.newPassword;
  const resetByAdmin = !!user?.mustChangePassword;
  const location = useLocation();

  // Coming from the "temporary password" banner: jump to the form.
  useEffect(() => {
    if (location.hash === "#password") document.getElementById("password")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [location.hash]);

  const saveProfile = useMutation({
    mutationFn: () => api.patch<{ user: User }>("/auth/me", profile),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res);
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const savePw = useMutation({
    mutationFn: () => api.post<{ user: User }>("/auth/me/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res);
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password changed. You've been signed out on other devices.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader title="My account" subtitle={user!.email} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Link to="/account/orders" className="card flex items-center gap-3 p-5 transition hover:shadow-lift">
          <span className="flex size-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700"><Package className="size-5" /></span>
          <div><p className="font-semibold">My orders</p><p className="text-sm text-forest-950/55">Track deliveries</p></div>
        </Link>
        <Link to="/account/bookings" className="card flex items-center gap-3 p-5 transition hover:shadow-lift">
          <span className="flex size-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700"><CalendarCheck className="size-5" /></span>
          <div><p className="font-semibold">My bookings</p><p className="text-sm text-forest-950/55">Service appointments</p></div>
        </Link>
      </div>

      <form
        className="card space-y-4 p-6"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          saveProfile.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></Field>
          <Field label="Phone"><input className="input" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
        </div>
        <Button type="submit" loading={saveProfile.isPending}>Save changes</Button>
      </form>

      <form
        id="password"
        className={clsx("card mt-6 scroll-mt-24 space-y-4 p-6", resetByAdmin && "ring-2 ring-clay-400")}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (mismatch) return;
          savePw.mutate();
        }}
      >
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="size-5 text-forest-700" /> Change password
          </h2>
          <p className="mt-1 text-sm text-forest-950/60">Enter your current password, then choose a new one.</p>
        </div>
        {resetByAdmin && (
          <div className="flex gap-3 rounded-xl bg-clay-50 p-4 text-sm text-clay-800">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <p>
              Your password was reset by Plant Point Mart. Type the <b>temporary password</b> you were given as your current password, then choose
              your own new password.
            </p>
          </div>
        )}
        <Field label={resetByAdmin ? "Temporary password" : "Current password"}>
          <input className="input sm:max-w-[calc(50%-0.5rem)]" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required autoComplete="current-password" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" hint="At least 6 characters">
            <input className="input" type="password" minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" error={mismatch ? "Passwords don't match" : undefined}>
            <input className="input" type="password" minLength={6} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" />
          </Field>
        </div>
        <Button type="submit" variant={resetByAdmin ? "primary" : "outline"} loading={savePw.isPending} disabled={mismatch}>
          Update password
        </Button>
      </form>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState title="Page not found" description="The page you're looking for doesn't exist." action={<ButtonLink to="/">Back to home</ButtonLink>} />
    </div>
  );
}

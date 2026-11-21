import { Lock, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/auth";
import { Button, ButtonLink, EmptyState, PageLoader } from "./ui";

/**
 * Guards account pages. Instead of redirecting, it shows a friendly prompt
 * and opens the sign-in dialog; the page renders as soon as the user signs in.
 */
export function RequireUser({ admin }: { admin?: boolean }) {
  const { user, loading, openAuth } = useAuth();

  useEffect(() => {
    if (!loading && !user) openAuth("login");
  }, [loading, user, openAuth]);

  if (loading) return <PageLoader />;
  if (!user)
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<Lock className="size-6" />}
          title="Please sign in"
          description="You need to be signed in to view this page."
          action={<Button onClick={() => openAuth("login")}>Sign in</Button>}
        />
      </div>
    );
  if (admin && user.role !== "ADMIN")
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title="Admins only"
          description="This area is only for Plant Point Mart staff."
          action={<ButtonLink to="/">Go to home</ButtonLink>}
        />
      </div>
    );
  return <Outlet />;
}

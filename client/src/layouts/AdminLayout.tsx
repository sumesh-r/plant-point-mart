import clsx from "clsx";
import { CalendarDays, ClipboardList, FolderTree, Flower2, KeyRound, LayoutDashboard, LogOut, Menu, Package, Store, Users, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { Logo } from "./SiteLayout";

type NavItem = { to: string; label: string; short?: string; icon: typeof Package; end?: boolean };

const groups: { title: string; items: NavItem[] }[] = [
  { title: "", items: [{ to: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard, end: true }] },
  {
    title: "Shop",
    items: [
      { to: "/admin/orders", label: "Orders", icon: Package },
      { to: "/admin/products", label: "Plants & products", icon: Flower2 },
      { to: "/admin/categories", label: "Categories", icon: FolderTree },
      { to: "/admin/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Services",
    items: [
      { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
      { to: "/admin/slots", label: "Free slots", short: "Slots", icon: CalendarDays },
      { to: "/admin/services", label: "Services", icon: Wrench },
    ],
  },
];
const allItems = groups.flatMap((g) => g.items);

/** The pages staff use most, one tap away at the bottom of the screen on phones. */
const tabs = ["/admin", "/admin/bookings", "/admin/slots", "/admin/orders"].map((to) => allItems.find((i) => i.to === to)!);

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const current = [...allItems].sort((a, b) => b.to.length - a.to.length).find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button onClick={() => setOpen(false)} className="-mr-2 rounded-lg p-2 hover:bg-sand-100 lg:hidden" aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title}>
            {g.title && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-forest-950/40">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:py-2",
                      isActive ? "bg-forest-700 text-white shadow-sm" : "text-forest-900/75 hover:bg-forest-50 hover:text-forest-900",
                    )
                  }
                >
                  <Icon className="size-4" /> {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-sand-200 p-3">
        <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-900/75 hover:bg-forest-50 lg:py-2">
          <Store className="size-4" /> View store
        </NavLink>
        <NavLink to="/account#password" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-900/75 hover:bg-forest-50 lg:py-2">
          <KeyRound className="size-4" /> Change password
        </NavLink>
        <button
          onClick={async () => {
            await logout();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 lg:py-2"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <p className="truncate px-3 pt-2 text-xs text-forest-950/45">Signed in as {user?.email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand-100/50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sand-200 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-forest-950/40 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-lift animate-slide-in-left">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-sand-200 bg-white/90 px-2 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2.5 hover:bg-sand-100" aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <Logo />
          <span className="ml-auto mr-2 rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-700">Admin</span>
        </header>
        {/* Bottom padding on phones keeps content clear of the tab bar. */}
        <main className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sand-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map(({ to, label, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", isActive ? "text-forest-700" : "text-forest-950/50")
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full transition", isActive && "bg-forest-100")}>
                  <Icon className="size-5" />
                </span>
                {short ?? label}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setOpen(true)}
          className={clsx(
            "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
            !tabs.includes(current!) && current ? "text-forest-700" : "text-forest-950/50",
          )}
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <Menu className="size-5" />
          </span>
          More
        </button>
      </nav>
    </div>
  );
}

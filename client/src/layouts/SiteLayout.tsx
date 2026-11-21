import clsx from "clsx";
import { CalendarCheck, ChevronDown, KeyRound, Leaf, LogOut, Menu, Package, Search, Settings, ShieldCheck, ShoppingBag, User as UserIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useCart } from "../lib/cart";
import { buttonClass } from "../components/ui";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/plants", label: "Shop Plants" },
  { to: "/categories", label: "Categories" },
  { to: "/services", label: "Services" },
];

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 max-[359px]:gap-1.5">
      <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9", light ? "bg-forest-100 text-forest-800" : "bg-forest-700 text-forest-100")}>
        <Leaf className="size-5" />
      </span>
      <span className={clsx("whitespace-nowrap font-display text-base font-semibold leading-none max-[359px]:text-sm sm:text-lg", light ? "text-white" : "text-forest-900")}>
        Plant Point <span className={light ? "text-forest-300" : "text-forest-600"}>Mart</span>
      </span>
    </Link>
  );
}

function SearchBox({ className, onDone }: { className?: string; onDone?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    navigate(`/plants${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
    onDone?.();
  }
  return (
    <form onSubmit={submit} className={clsx("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-forest-950/40" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search plants, pots, seeds…"
        className="h-10 w-full rounded-full border border-sand-200 bg-sand-100/60 pl-10 pr-4 text-sm outline-none transition focus:border-forest-400 focus:bg-white focus:ring-4 focus:ring-forest-500/10"
      />
    </form>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user) return null;
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-forest-900 hover:bg-forest-50";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-sand-100">
        <span className="flex size-8 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate text-sm font-medium lg:block">{user.name.split(" ")[0]}</span>
        <ChevronDown className="hidden size-4 text-forest-950/50 lg:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-sand-200 bg-white p-1.5 shadow-lift animate-scale-in" onClick={() => setOpen(false)}>
          <div className="border-b border-sand-100 px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-forest-950/50">{user.email}</p>
          </div>
          <div className="pt-1">
            {user.role === "ADMIN" && (
              <Link to="/admin" className={item}>
                <ShieldCheck className="size-4" /> Admin panel
              </Link>
            )}
            <Link to="/account/orders" className={item}>
              <Package className="size-4" /> My orders
            </Link>
            <Link to="/account/bookings" className={item}>
              <CalendarCheck className="size-4" /> My bookings
            </Link>
            <Link to="/account" className={item}>
              <Settings className="size-4" /> Profile
            </Link>
            <button
              className={clsx(item, "text-red-600 hover:bg-red-50")}
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user, openAuth, requireAuth } = useAuth();
  const { data: cart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx("whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition", isActive ? "bg-forest-50 text-forest-800" : "text-forest-950/70 hover:text-forest-900");

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200/70 bg-cream/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
        <button className="-ml-2 rounded-lg p-2 lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 lg:flex xl:ml-4">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchBox className="hidden w-44 lg:block xl:w-64" />
          <button
            onClick={() => requireAuth(() => navigate("/cart"), "Sign in to see your cart")}
            className="relative rounded-full p-2 text-forest-900 transition hover:bg-sand-100 sm:p-2.5"
            aria-label="Cart"
          >
            <ShoppingBag className="size-5" />
            {!!cart?.count && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-clay-500 px-1 text-[11px] font-bold leading-5 text-white">
                {cart.count}
              </span>
            )}
          </button>
          {user ? (
            <UserMenu />
          ) : (
            <>
              {/* Phones: one compact button; the dialog switches to Register. */}
              <button className={buttonClass("primary", "sm", "h-9 px-3 max-[359px]:px-2.5 sm:hidden")} onClick={() => openAuth("login")}>
                <UserIcon className="size-4 max-[380px]:hidden" /> Sign in
              </button>
              <button className={buttonClass("ghost", "md", "hidden sm:inline-flex")} onClick={() => openAuth("login")}>
                Sign in
              </button>
              {/* Hidden between lg and xl where the nav and search need the room; the sign-in dialog links to Register. */}
              <button className={buttonClass("primary", "md", "hidden sm:inline-flex lg:hidden xl:inline-flex")} onClick={() => openAuth("register")}>
                Register
              </button>
            </>
          )}
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-sand-200 bg-cream px-4 pb-4 pt-3 lg:hidden animate-fade-in">
          <SearchBox className="mb-3" onDone={() => setMobileOpen(false)} />
          <nav className="flex flex-col">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx("rounded-lg px-3 py-2.5 text-sm font-medium", isActive ? "bg-forest-50 text-forest-800" : "text-forest-900")}>
                {n.label}
              </NavLink>
            ))}
            {!user && (
              <button className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-forest-900" onClick={() => openAuth("login")}>
                Sign in
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 bg-forest-900 text-forest-100/80">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:py-14 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Healthy plants delivered to your door, and expert gardeners at your service. Grow a greener home with us.
          </p>
        </div>
        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/plants?category=indoor-plants">Indoor plants</Link></li>
            <li><Link className="hover:text-white" to="/plants?category=outdoor-plants">Outdoor plants</Link></li>
            <li><Link className="hover:text-white" to="/plants?category=flowering-plants">Flowering plants</Link></li>
            <li><Link className="hover:text-white" to="/plants?category=garden-accessories">Garden accessories</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Services</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/services">Book a gardener</Link></li>
            <li><Link className="hover:text-white" to="/services/repotting-service">Repotting</Link></li>
            <li><Link className="hover:text-white" to="/services/pest-disease-treatment">Pest treatment</Link></li>
            <li><Link className="hover:text-white" to="/account/bookings">My bookings</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white">Why us</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li>Cash on delivery</li>
            <li>Free delivery above ₹499</li>
            <li>Nursery-fresh, healthy plants</li>
            <li>Trained gardeners</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-forest-100/50">© {new Date().getFullYear()} Plant Point Mart. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <TemporaryPasswordBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** Shown after an admin resets the user's password, until they choose a new one. */
function TemporaryPasswordBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user?.mustChangePassword || pathname === "/account") return null;
  return (
    <div className="bg-clay-50 text-clay-800">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
        <KeyRound className="size-4 shrink-0" />
        <span className="flex-1">You're signed in with a temporary password. Please choose your own password.</span>
        <Link to="/account#password" className="font-semibold underline underline-offset-2 hover:text-clay-600">
          Set a new password
        </Link>
      </div>
    </div>
  );
}

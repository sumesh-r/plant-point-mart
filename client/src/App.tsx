import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthDialog } from "./components/AuthDialog";
import { RequireUser } from "./components/RequireUser";
import { PageLoader } from "./components/ui";
import { AdminLayout } from "./layouts/AdminLayout";
import { SiteLayout } from "./layouts/SiteLayout";
import { Account, NotFound } from "./pages/Account";
import { BookingDetail, MyBookings } from "./pages/Bookings";
import CartPage from "./pages/Cart";
import Categories from "./pages/Categories";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import { MyOrders, OrderDetail } from "./pages/Orders";
import PlantDetail from "./pages/PlantDetail";
import Plants from "./pages/Plants";
import { ServiceDetail, ServicesPage } from "./pages/Services";

// Admin screens are split into their own bundle
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminCustomers = lazy(() => import("./pages/admin/Customers"));
const AdminServices = lazy(() => import("./pages/admin/Services"));
const AdminSlots = lazy(() => import("./pages/admin/Slots"));
const AdminBookings = lazy(() => import("./pages/admin/Bookings"));

const s = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      // Public pages: anyone can browse
      { path: "/", element: <Home /> },
      { path: "/plants", element: <Plants /> },
      { path: "/plants/:slug", element: <PlantDetail /> },
      { path: "/categories", element: <Categories /> },
      { path: "/services", element: <ServicesPage /> },
      { path: "/services/:slug", element: <ServiceDetail /> },
      // Signed-in pages
      {
        element: <RequireUser />,
        children: [
          { path: "/cart", element: <CartPage /> },
          { path: "/checkout", element: <Checkout /> },
          { path: "/account", element: <Account /> },
          { path: "/account/orders", element: <MyOrders /> },
          { path: "/account/orders/:orderNumber", element: <OrderDetail /> },
          { path: "/account/bookings", element: <MyBookings /> },
          { path: "/account/bookings/:bookingNumber", element: <BookingDetail /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    element: <RequireUser admin />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: s(<AdminDashboard />) },
          { path: "products", element: s(<AdminProducts />) },
          { path: "categories", element: s(<AdminCategories />) },
          { path: "orders", element: s(<AdminOrders />) },
          { path: "customers", element: s(<AdminCustomers />) },
          { path: "services", element: s(<AdminServices />) },
          { path: "slots", element: s(<AdminSlots />) },
          { path: "bookings", element: s(<AdminBookings />) },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <AuthDialog />
    </>
  );
}

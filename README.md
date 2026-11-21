# Plant Point Mart – Online Plant Selling Website

An online plant shop with a plant-care service booking system.

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router + TanStack Query
- **Backend:** Node.js + Express 5 + TypeScript (REST API)
- **Database:** SQLite through Prisma ORM
- **Payment:** Cash on Delivery

## Features

**Customers** (every page can be browsed without an account; signing in is only asked for when you add to cart, check out or book)

- Home page, plant categories, search, filters (category, price, in stock) and sorting
- Plant details with an image gallery, care info and stock status
- Cart, checkout with Cash on Delivery, and free delivery above ₹499
- My Orders with a tracking timeline (Placed → Confirmed → Shipped → Out for delivery → Delivered); orders can be cancelled before shipping
- **Services:** browse plant-care services, pick a date on a calendar that shows only free slots, choose a time, add an address, notes and optional plant photos, then book
- My Bookings with a status timeline, the team's notes and their before/after photos

**Admin** (`/admin`)

- Dashboard: revenue, orders to process, pending bookings, free slots, low stock, recent activity
- Products: add, edit and delete; upload and delete images; choose the main image
- Categories: add, edit and delete, with an image
- Orders: filter, search, view, and update status with a note (cancelling restores stock; delivering marks the cash as collected)
- Customers: list with their orders and bookings
- Services: add, edit, delete and hide, with an image
- **Free slots:** a calendar of free and booked slots per day; add one day's slots or repeat them across dates and weekdays; block, unblock, delete, or clear a whole day
- **Bookings:** update status (Pending → Confirmed → In progress → Completed / Cancelled), write a work report, upload and delete photos

## Getting started

Requires Node.js 20 or newer.

```bash
# 1. Install everything and create the database (also seeds demo data)
npm run setup

# 2. Start the API (http://localhost:4000) and website (http://localhost:5173)
npm run dev
```

Open http://localhost:5173.

If `server/.env` is missing, copy `server/.env.example` to `server/.env` and set a `JWT_SECRET`.

If port 4000 is busy (for example a production server is running), start the API on another port with `PORT=4002` in `server/.env` and run the website with `API_URL=http://localhost:4002`.

* [ ] Demo accounts (created by the seed)

| Role     | Email                    | Password    |
| -------- | ------------------------ | ----------- |
| Admin    | admin@plantpointmart.com | admin123    |
| Customer | customer@example.com     | customer123 |

### Useful commands

| Command                  | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`          | Run the API and website together                   |
| `npm run seed`         | Reload the demo data (clears existing data)        |
| `npm run db:reset`     | Drop the database, re-run migrations, and seed     |
| `npm run build`        | Production build of both apps                      |
| `npm run start`        | Run the production build (after `npm run build`) |
| `npm run create-admin` | Create an admin, or reset an admin's password      |

### Tests

```bash
npm test            # all tests (server, then website)
npm run typecheck   # type-check the apps and the tests
```

- `server/tests/unit`: validation rules and helpers.
- `server/tests/api`: the real API against a temporary database (`server/prisma/test.db`, created and deleted on every run; `dev.db` is never touched). Covers sign-in, passwords, cart, orders, stock, bookings and slot safety, and admin actions.
- `client/tests/unit`: form validation, formatting and the API client.
- `client/tests/components`: the booking, checkout and form-field screens, using a fake server.
- `tests/fixtures/address-cases.json`: address and phone cases that **both** the server and the website are tested against, so their rules can't drift apart.

Run one side only with `npm --prefix server test` or `npm --prefix client test`, and add `-- --watch` to rerun on save.

### Accounts and passwords

- **New admin:** run `npm run create-admin` and answer the questions. The password is hidden while you type. You can also pass everything at once: `npm run create-admin -- --email owner@example.com --name "Owner" --password "secret123"`. Using an email that already exists turns that account into an admin and sets the new password. This is also how an admin who forgot their password gets back in.
- **Change password:** anyone signed in can go to **My account → Change password**, enter their current password and choose a new one. This signs them out on their other devices. Admins can also use **Change password** at the bottom of the admin sidebar.
- **Customer forgot their password:** in **Admin → Customers**, open the customer and click **Reset password**. Share the temporary password it shows (it's only shown once). The customer signs in with it, sees a reminder, and sets their own password under My account.
- **Block / delete:** blocking signs the customer out straight away and stops them signing in until they're unblocked. Customers with orders or bookings can't be deleted, so their history stays intact. Block them instead.

### Production

```bash
npm run build
npm run start
```

This runs one server on http://localhost:4000 that serves both the API and the built website, so you don't need Vite. Pending database migrations are applied on start. Set `PORT` in `server/.env` to change the port. If the site is served over HTTPS, add `NODE_ENV=production` to `server/.env` so the login cookie is marked secure.

The demo product and service pictures are simple generated illustrations so the project works offline. Replace them with real photos from **Admin → Plants & products**.

## Project structure

```
server/
  prisma/schema.prisma   database tables
  prisma/seed.ts         demo data
  src/routes/            API endpoints (auth, catalog, cart, orders, services, bookings, admin)
  src/middleware/        auth (JWT cookie) and image uploads
  uploads/               uploaded images
client/
  src/pages/             customer pages
  src/pages/admin/       admin panel
  src/components/        shared UI (calendar, sign-in dialog, timeline, …)
```

## How a slot booking stays safe

Each slot has a status: `AVAILABLE`, `BOOKED` or `BLOCKED`. Booking claims a slot in one database update that only succeeds while the slot is still `AVAILABLE`, so two people can never book the same slot. Cancelling a future booking frees the slot again.

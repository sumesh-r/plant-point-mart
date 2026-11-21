import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ServiceDetail } from "../../src/pages/Services";
import { MESSAGES } from "../../src/lib/validation";
import { customer, mockApi, renderPage, signedInAs, type Handler } from "../utils";

const HOUR = 3600e3;
// Slots a few hours ahead, so they're in the calendar month the page opens on (or the next).
const start1 = new Date(Date.now() + 3 * HOUR);
const start2 = new Date(Date.now() + 5 * HOUR);
const slots = [
  { id: 11, startsAt: start1.toISOString(), endsAt: new Date(start1.getTime() + 2 * HOUR).toISOString() },
  { id: 12, startsAt: start2.toISOString(), endsAt: new Date(start2.getTime() + 2 * HOUR).toISOString() },
];
const service = {
  id: 3,
  name: "Home Plant Care Visit",
  slug: "care",
  shortDescription: "Care",
  description: "A gardener visits",
  price: 399,
  durationMinutes: 60,
  image: null,
  isActive: true,
};

const servicePages: Handler = ({ method, path }) => {
  if (method !== "GET") return;
  if (path === "/services/care") return { body: { service } };
  if (path.startsWith("/services/care/slots")) return { body: { slots } };
};

const bookingCreated: Handler = ({ method, path }) =>
  method === "POST" && path === "/bookings" ? { status: 201, body: { booking: { bookingNumber: "SRV-NEW001" } } } : undefined;

function open(...handlers: Handler[]) {
  const api = mockApi(...handlers);
  renderPage("/services/care", [
    { path: "/services/:slug", element: <ServiceDetail /> },
    { path: "/account/bookings/:bookingNumber", element: <p>Booking page for the new booking</p> },
  ]);
  return api;
}

const bookingPosts = (calls: { method: string; path: string; body: unknown }[]) => calls.filter((c) => c.method === "POST" && c.path === "/bookings");

async function fillDetails(user: ReturnType<typeof userEvent.setup>, address: string) {
  // Name and phone are pre-filled from the signed-in account.
  await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveValue(customer.name));
  await user.type(screen.getByLabelText("Address"), address);
  await user.type(screen.getByLabelText("City"), "Coimbatore");
  await user.type(screen.getByLabelText("Pincode"), "641046");
}

async function pickFirstTime(user: ReturnType<typeof userEvent.setup>) {
  const times = await screen.findAllByRole("button", { name: /until/i });
  await user.click(times[0]);
}

describe("booking a service: the reported bug", () => {
  it('address "test" → message under Address, the time stays selected and the button still works', async () => {
    const user = userEvent.setup();
    const { calls } = open(signedInAs(customer), servicePages, bookingCreated);

    await fillDetails(user, "test");
    await pickFirstTime(user);
    const confirm = screen.getByRole("button", { name: "Confirm booking" });
    await user.click(confirm);

    // The problem is shown on the field itself and nothing is sent.
    expect(screen.getByLabelText("Address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(MESSAGES.addressLine)).toBeInTheDocument();
    expect(bookingPosts(calls)).toHaveLength(0);

    // The bug: the chosen time used to be cleared and the button left disabled.
    expect(confirm).toBeEnabled();
    expect(screen.queryByText("No slot selected")).not.toBeInTheDocument();

    // Fixing the address clears the message, and the same button books the same slot.
    await user.type(screen.getByLabelText("Address"), " road, 12 Gandhi Nagar, near bus stand");
    expect(screen.queryByText(MESSAGES.addressLine)).not.toBeInTheDocument();
    await user.click(confirm);

    await screen.findByText("Booking page for the new booking");
    const posts = bookingPosts(calls);
    expect(posts).toHaveLength(1);
    const sent = posts[0].body as FormData;
    expect(sent.get("slotId")).toBe("11");
    expect(sent.get("addressLine")).toBe("test road, 12 Gandhi Nagar, near bus stand");
    expect(sent.get("serviceId")).toBe("3");
  });

  it("if the server rejects a detail, the time stays selected and the message goes under that field", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const { calls } = open(signedInAs(customer), servicePages, ({ method, path }) => {
      if (method !== "POST" || path !== "/bookings") return;
      attempt++;
      return attempt === 1
        ? { status: 400, body: { message: "Enter the city", details: { fields: { city: "Enter the city" } } } }
        : { status: 201, body: { booking: { bookingNumber: "SRV-NEW001" } } };
    });

    await fillDetails(user, "12, Gandhi Nagar, near bus stand");
    await pickFirstTime(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(screen.getByLabelText("City")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.queryByText("No slot selected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    await screen.findByText("Booking page for the new booking");
    expect(bookingPosts(calls)).toHaveLength(2);
    expect((bookingPosts(calls)[1].body as FormData).get("slotId")).toBe("11");
  });

  it("only when the slot was just taken (409) is the time cleared, with an explanation", async () => {
    const user = userEvent.setup();
    const { calls } = open(signedInAs(customer), servicePages, ({ method, path }) =>
      method === "POST" && path === "/bookings" ? { status: 409, body: { message: "Sorry, that slot was just taken. Please pick another time." } } : undefined,
    );

    await fillDetails(user, "12, Gandhi Nagar, near bus stand");
    await pickFirstTime(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(await screen.findByText(/that slot was just taken/i)).toBeInTheDocument();
    expect(screen.getByText("No slot selected")).toBeInTheDocument();
    // The free times are fetched again so the taken one disappears.
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith("/services/care/slots")).length).toBeGreaterThan(1));
  });
});

describe("booking a service: other checks", () => {
  it("pressing Confirm without a time explains what's missing", async () => {
    const user = userEvent.setup();
    const { calls } = open(signedInAs(customer), servicePages, bookingCreated);
    await fillDetails(user, "12, Gandhi Nagar, near bus stand");
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(screen.getByText("Please choose a time slot")).toBeInTheDocument();
    expect(bookingPosts(calls)).toHaveLength(0);
  });

  it("flags every empty required field at once", async () => {
    const user = userEvent.setup();
    open(signedInAs({ ...customer, name: "", phone: null }), servicePages, bookingCreated);
    await pickFirstTime(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    for (const label of ["Full name", "Phone", "Address", "City", "Pincode"]) {
      expect(screen.getByLabelText(label), label).toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.getByLabelText("Notes for the gardener")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Please fix the highlighted details above.")).toBeInTheDocument();
  });

  it("a bad pincode is caught before sending", async () => {
    const user = userEvent.setup();
    const { calls } = open(signedInAs(customer), servicePages, bookingCreated);
    await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveValue(customer.name));
    await user.type(screen.getByLabelText("Address"), "12, Gandhi Nagar, near bus stand");
    await user.type(screen.getByLabelText("City"), "Coimbatore");
    await user.type(screen.getByLabelText("Pincode"), "6410");
    await pickFirstTime(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(screen.getByText(MESSAGES.pincode)).toBeInTheDocument();
    expect(bookingPosts(calls)).toHaveLength(0);
  });

  it("guests can fill everything in, and are asked to sign in only when confirming", async () => {
    const user = userEvent.setup();
    const { calls } = open(signedInAs(null), servicePages, bookingCreated);
    await screen.findAllByRole("button", { name: /until/i });
    await user.type(screen.getByLabelText("Full name"), "Guest Person");
    await user.type(screen.getByLabelText("Phone"), "9876543210");
    await user.type(screen.getByLabelText("Address"), "12, Gandhi Nagar, near bus stand");
    await user.type(screen.getByLabelText("City"), "Coimbatore");
    await user.type(screen.getByLabelText("Pincode"), "641046");
    await pickFirstTime(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/sign in to confirm your booking/i)).toBeInTheDocument();
    expect(bookingPosts(calls)).toHaveLength(0);
  });

  it("time buttons show the start time and when it ends", async () => {
    open(signedInAs(customer), servicePages);
    const times = await screen.findAllByRole("button", { name: /until/i });
    expect(times.length).toBeGreaterThanOrEqual(1);
    expect(times[0].textContent).toMatch(/\d{1,2}:\d{2} (AM|PM)until \d{1,2}:\d{2} (AM|PM)/);
  });
});

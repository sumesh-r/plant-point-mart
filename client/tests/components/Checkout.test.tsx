import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { RequireUser } from "../../src/components/RequireUser";
import Checkout from "../../src/pages/Checkout";
import { MESSAGES } from "../../src/lib/validation";
import { customer, mockApi, renderPage, signedInAs, type Handler } from "../utils";

const product = { id: 1, name: "Peace Lily", slug: "peace-lily", price: 449, stock: 5, images: [], category: { id: 1, name: "Indoor", slug: "indoor" } };
const cart: Handler = ({ method, path }) =>
  method === "GET" && path === "/cart"
    ? { body: { items: [{ id: 1, productId: 1, quantity: 1, product }], count: 1, subtotal: 449, shippingFee: 49, total: 498, freeShippingAbove: 499 } }
    : undefined;
const placed: Handler = ({ method, path }) => (method === "POST" && path === "/orders" ? { status: 201, body: { order: { orderNumber: "PPM-NEW001" } } } : undefined);

function open(...handlers: Handler[]) {
  const api = mockApi(signedInAs(customer), cart, ...handlers);
  // Same as the app: checkout only opens once the signed-in account has loaded.
  renderPage(
    "/checkout",
    [
      { path: "/checkout", element: <Checkout /> },
      { path: "/account/orders/:orderNumber", element: <p>Order placed page</p> },
    ],
    <RequireUser />,
  );
  return api;
}
const orderPosts = (calls: { method: string; path: string; body: unknown }[]) => calls.filter((c) => c.method === "POST" && c.path === "/orders");

beforeEach(() => localStorage.clear());

describe("checkout address", () => {
  it("catches a short address and bad pincode before placing the order", async () => {
    const user = userEvent.setup();
    const { calls } = open(placed);
    await user.type(await screen.findByLabelText("Address"), "test");
    await user.type(screen.getByLabelText("City"), "Coimbatore");
    await user.type(screen.getByLabelText("Pincode"), "123");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(screen.getByText(MESSAGES.addressLine)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.pincode)).toBeInTheDocument();
    expect(screen.getByText("Please fix the highlighted address details.")).toBeInTheDocument();
    expect(orderPosts(calls)).toHaveLength(0);
  });

  it("places the order once the address is complete, and remembers it for next time", async () => {
    const user = userEvent.setup();
    const { calls } = open(placed);
    await user.type(await screen.findByLabelText("Address"), "12, Gandhi Nagar, near bus stand");
    await user.type(screen.getByLabelText("City"), "Coimbatore");
    await user.type(screen.getByLabelText("Pincode"), "641046");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await screen.findByText("Order placed page");
    expect(orderPosts(calls)[0].body).toMatchObject({ addressLine: "12, Gandhi Nagar, near bus stand", pincode: "641046", state: "Tamil Nadu", fullName: customer.name });
    expect(JSON.parse(localStorage.getItem("ppm:lastAddress")!).city).toBe("Coimbatore");
  });

  it("shows the server's field message under the right input", async () => {
    const user = userEvent.setup();
    open(({ method, path }) =>
      method === "POST" && path === "/orders" ? { status: 400, body: { message: "Enter the state", details: { fields: { state: "Enter the state" } } } } : undefined,
    );
    await user.type(await screen.findByLabelText("Address"), "12, Gandhi Nagar, near bus stand");
    await user.type(screen.getByLabelText("City"), "Coimbatore");
    await user.type(screen.getByLabelText("Pincode"), "641046");
    await user.click(screen.getByRole("button", { name: /place order/i }));
    await waitFor(() => expect(screen.getByLabelText("State")).toHaveAttribute("aria-invalid", "true"));
  });
});

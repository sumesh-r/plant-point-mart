import { ArrowRight, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { ButtonLink, EmptyState, ErrorState, PageHeader, PageLoader, QuantityStepper } from "../components/ui";
import { useCart, useUpdateCart } from "../lib/cart";
import { imageUrl, money } from "../lib/format";

export default function CartPage() {
  const { data: cart, isLoading, isError, refetch } = useCart();
  const { update, remove } = useUpdateCart();

  if (isLoading) return <PageLoader />;
  if (isError || !cart)
    return (
      <div className="container-page py-10">
        <ErrorState message="Couldn't load your cart." onRetry={() => refetch()} />
      </div>
    );

  if (cart.items.length === 0)
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title="Your cart is empty"
          description="Looks like you haven't added any plants yet."
          action={<ButtonLink to="/plants">Start shopping</ButtonLink>}
        />
      </div>
    );

  const remaining = cart.freeShippingAbove - cart.subtotal;

  return (
    <div className="container-page py-10">
      <PageHeader title="Your cart" subtitle={`${cart.count} item${cart.count > 1 ? "s" : ""}`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {cart.items.map((item) => {
            const busy =
              (update.isPending && update.variables?.productId === item.productId) ||
              (remove.isPending && remove.variables === item.productId);
            return (
              <div key={item.id} className="card flex gap-4 p-4">
                <Link to={`/plants/${item.product.slug}`} className="shrink-0">
                  <img src={imageUrl(item.product.images[0]?.url)} alt="" className="size-24 rounded-xl object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/plants/${item.product.slug}`} className="font-semibold hover:text-forest-700">
                        {item.product.name}
                      </Link>
                      <p className="text-sm text-forest-950/50">{money(item.product.price)} each</p>
                    </div>
                    <p className="font-bold">{money(item.product.price * item.quantity)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      max={item.product.stock}
                      disabled={busy}
                      onChange={(quantity) => update.mutate({ productId: item.productId, quantity })}
                    />
                    <button
                      onClick={() => remove.mutate(item.productId)}
                      disabled={busy}
                      aria-label={`Remove ${item.product.name}`}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-forest-950/50 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" /> <span className="max-[359px]:hidden">Remove</span>
                    </button>
                  </div>
                  {item.quantity > item.product.stock && (
                    <p className="mt-2 text-xs font-medium text-red-600">Only {item.product.stock} in stock. Please reduce the quantity.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          {remaining > 0 ? (
            <div className="mt-4 rounded-xl bg-forest-50 p-3 text-sm text-forest-800">
              <p className="flex items-center gap-2 font-medium">
                <Truck className="size-4" /> Add {money(remaining)} more for free delivery
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest-100">
                <div className="h-full rounded-full bg-forest-600" style={{ width: `${Math.min(100, (cart.subtotal / cart.freeShippingAbove) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-forest-50 p-3 text-sm font-medium text-forest-800">
              <Truck className="size-4" /> You get free delivery!
            </p>
          )}
          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-forest-950/60">Subtotal</dt><dd className="font-medium">{money(cart.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-forest-950/60">Delivery</dt><dd className="font-medium">{cart.shippingFee ? money(cart.shippingFee) : "Free"}</dd></div>
            <div className="flex justify-between border-t border-sand-200 pt-3 text-base"><dt className="font-semibold">Total</dt><dd className="font-bold">{money(cart.total)}</dd></div>
          </dl>
          <ButtonLink to="/checkout" size="lg" className="mt-6 w-full">
            Checkout <ArrowRight className="size-4" />
          </ButtonLink>
          <Link to="/plants" className="mt-3 block text-center text-sm font-medium text-forest-700 hover:underline">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

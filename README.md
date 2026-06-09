# 🛒 Shopify Cart Broadcaster

[![npm version](https://img.shields.io/npm/v/shopify-cart-broadcast.svg)](https://www.npmjs.com/package/shopify-cart-broadcast)
[![npm downloads](https://img.shields.io/npm/dm/shopify-cart-broadcast.svg)](https://www.npmjs.com/package/shopify-cart-broadcast)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/shopify-cart-broadcast.svg)](https://bundlephobia.com/package/shopify-cart-broadcast)
[![jsDelivr hits](https://img.shields.io/jsdelivr/npm/hm/shopify-cart-broadcast.svg)](https://www.jsdelivr.com/package/npm/shopify-cart-broadcast)
[![license](https://img.shields.io/npm/l/shopify-cart-broadcast.svg)](./LICENSE)

**Reliable cart events for any Shopify theme — in one `<script>` tag.**

<p align="center">
  <img src="https://raw.githubusercontent.com/Rabin-p/shopify-cart-broadcast/main/media/demo.gif" alt="Adding to cart fires shopify:cart-added and shopify:cart-updated DOM events in real time, driving a live free-shipping bar" width="660">
</p>

Shopify themes don't emit consistent, trustworthy cart events. So everyone building a
cart drawer, free-shipping bar, upsell widget, or analytics hook ends up monkey-patching
`window.fetch` by hand — and missing the requests that go through `XMLHttpRequest`.

This is that monkey-patch, done right. It intercepts **both** `fetch` and `XHR`, watches
the Shopify Cart API, and re-broadcasts every change as a clean DOM `CustomEvent`.

```js
window.addEventListener('shopify:cart-updated', (e) => {
  console.log('Cart changed!', e.detail.cart);
});
```

- 🪶 **Zero dependencies**, ~2 KB minified, single file.
- 🔌 Covers `fetch` **and** `XMLHttpRequest` — works no matter how your theme/apps talk to the cart.
- 🎯 Re-fetches the **true cart state** after `/cart/add` (which only returns the added line, not the whole cart).
- 📡 One master `shopify:cart-updated` event for "something changed, re-render."
- 🛡️ Listener errors are isolated — a throwing handler never breaks the store's add-to-cart.

---

## Quick start

### Option A — CDN (great for demos & quick installs)

Add this to your theme's `theme.liquid`, just before `</head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/shopify-cart-broadcast@1.0.0/events-broadcast.min.js"></script>
```

### Option B — npm

```bash
npm install shopify-cart-broadcast
```

```js
import 'shopify-cart-broadcast';
```

### Option C — self-host

Download [`events-broadcast.js`](./events-broadcast.js), drop it in your theme's `assets/`,
and reference it from `theme.liquid`:

```liquid
<script src="{{ 'events-broadcast.js' | asset_url }}" defer></script>
```

---

## Events

Every event's `detail` includes the full `cart` object and the original request `payload`.

| Event | Fires when | `detail` shape |
|---|---|---|
| `shopify:cart-added` | An item is added (`POST /cart/add`) | `{ cart, itemsAdded, payload }` |
| `shopify:cart-changed` | A line is changed (`POST /cart/change`) | `{ cart, payload }` |
| `shopify:cart-updated-items` | Items updated (`POST /cart/update`) | `{ cart, payload }` |
| `shopify:cart-cleared` | Cart emptied (`POST /cart/clear`) | `{ cart, payload }` |
| `shopify:cart-fetched` | Cart read (`GET /cart.js`) | `{ cart, payload }` |
| **`shopify:cart-updated`** | **After _any_ of the above** — your go-to for UI sync | `{ cart }` |
| `shopify:cart-error` | A cart request fails (non-2xx or network) | `{ endpoint, error, payload }` |

> For `shopify:cart-added`, the script automatically calls `/cart.js` so `detail.cart`
> is the **complete** cart, while `detail.itemsAdded` holds just what was added.

---

## Example: a live free-shipping bar

```js
const THRESHOLD = 5000; // $50.00, in cents

window.addEventListener('shopify:cart-updated', (e) => {
  const total = e.detail.cart.total_price;
  const bar = document.querySelector('#free-shipping-bar');

  bar.textContent = total >= THRESHOLD
    ? '✅ You’ve unlocked free shipping!'
    : `You’re $${((THRESHOLD - total) / 100).toFixed(2)} away from free shipping.`;
});
```

See [`demo.html`](./demo.html) for a runnable example (no Shopify store required).

---

## How it works

The script wraps `window.fetch`, `XMLHttpRequest.prototype.open`, and `.send` once
(guarded against double-init). When a request matches a Cart API endpoint, it lets the
real request run untouched, then dispatches the matching event asynchronously
(`setTimeout(0)`) so your listeners never block or alter Shopify's own cart handling.

---

## Notes & limitations

- Request bodies passed as a `Request` object (rather than `fetch(url, { body })`) can't be
  read synchronously, so `payload` is reported as `'[Request Object Payload]'`. The `cart`
  in `detail` is always accurate regardless.
- Load it **early** (before your theme/apps fire cart requests) so nothing is missed.

---

## Contributing

Issues and PRs welcome. If this saved you an afternoon of monkey-patching, a ⭐ helps others find it!

## License

[MIT](./LICENSE)

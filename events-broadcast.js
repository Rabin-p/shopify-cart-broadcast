/**
 * Shopify Cart Event Broadcaster
 * Zero-dependency wrapper that intercepts Shopify's Fetch & XHR Cart APIs
 * and re-broadcasts them as reliable, themeable DOM CustomEvents.
 *
 * @license MIT
 * @see https://github.com/Rabin-p/shopify-cart-broadcast
 */
(() => {
  if (window.ShopifyCartBroadcasterInitialized) return;
  window.ShopifyCartBroadcasterInitialized = true;

  // Capture native fetch up front (bound to window) so our own internal /cart.js
  // call bypasses interception and doesn't re-fire events.
  const originalFetch = window.fetch.bind(window);

  const EVENT_MAP = {
    '/cart/add': 'shopify:cart-added',
    '/cart/change': 'shopify:cart-changed',
    '/cart/update': 'shopify:cart-updated-items',
    '/cart/clear': 'shopify:cart-cleared',
    '/cart.js': 'shopify:cart-fetched'
  };

  // URL matching to prevent false positives like `/cart/add-ons`
  const getCartEventConfig = (urlString) => {
    try {
      const urlPath = new URL(urlString, window.location.origin).pathname;
      const matchedEndpoint = Object.keys(EVENT_MAP).find(endpoint => {
        if (endpoint === '/cart.js') return urlPath.endsWith('/cart.js');
        // Match exact endpoint or endpoint followed by an extension (.js, .json)
        const regex = new RegExp(`${endpoint}(\\.(js|json))?$`);
        return regex.test(urlPath);
      });
      return matchedEndpoint ? { name: EVENT_MAP[matchedEndpoint], endpoint: matchedEndpoint } : null;
    } catch (e) {
      return null;
    }
  };

  // Helper to fetch true cart state when an endpoint doesn't return it natively
  const fetchTrueCartState = (callback) => {
    originalFetch('/cart.js')
      .then(res => res.clone().json())
      .then(cart => callback(cart))
      .catch(err => console.error('ShopifyCartBroadcaster: Failed to fetch fallback cart state', err));
  };

  // Centralized Event Dispatcher
  const dispatch = (eventName, data, payload, isError = false) => {
    setTimeout(() => {
      try {
        if (isError) {
          window.dispatchEvent(new CustomEvent('shopify:cart-error', { detail: { endpoint: eventName, error: data, payload } }));
          return;
        }

        const isAddAction = eventName === 'shopify:cart-added';
        
        const buildAndFire = (trueCart) => {
          window.dispatchEvent(new CustomEvent(eventName, {
            detail: {
              cart: trueCart,
              ...(isAddAction ? { itemsAdded: data } : {}),
              payload
            }
          }));

          window.dispatchEvent(new CustomEvent('shopify:cart-updated', { detail: { cart: trueCart } }));
        };

        // If it was an 'add' mutation, the data returned is just the added items, not the cart.
        if (isAddAction) {
          fetchTrueCartState(buildAndFire);
        } else {
          buildAndFire(data);
        }
      } catch (err) {
        console.error('ShopifyCartBroadcaster: User event listener threw an error', err);
      }
    }, 0);
  };

  // Safe Request Payload Extractor
  const extractPayload = (options, input) => {
    if (!options && !input) return null;
    try {
      if (input instanceof Request) {
        return '[Request Object Payload]';
      }
      const body = options?.body;
      if (!body) return null;
      return typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      return options?.body || null;
    }
  };

  // 1. INTERCEPT FETCH API
  window.fetch = function(...args) {
    const input = args[0];
    const options = args[1] || {};
    const urlString = typeof input === 'string' ? input : input?.url || '';
    const eventConfig = getCartEventConfig(urlString);

    const responsePromise = originalFetch.apply(this, args);

    if (eventConfig) {
      const payload = extractPayload(options, input);
      
      responsePromise
        .then(response => {
          if (!response.ok) {
            response.clone().json()
              .then(errData => dispatch(eventConfig.endpoint, errData, payload, true))
              .catch(() => dispatch(eventConfig.endpoint, { status: response.status }, payload, true));
            return;
          }
          
          response.clone().json()
            .then(data => dispatch(eventConfig.name, data, payload))
            .catch(err => console.error('ShopifyCartBroadcaster: Fetch JSON parsing failed', err));
        })
        .catch(netErr => dispatch(eventConfig.endpoint, netErr, payload, true));
    }

    return responsePromise;
  };


  // 2. INTERCEPT XMLHTTPREQUEST (XHR)
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._cartEventConfig = getCartEventConfig(url);
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    if (this._cartEventConfig) {
      let payload = null;
      try { payload = typeof body === 'string' ? JSON.parse(body) : body; } catch(e) { payload = body; }

      this.addEventListener('load', () => {
        if (this.status >= 200 && this.status < 300) {
          try {
            const data = JSON.parse(this.responseText);
            dispatch(this._cartEventConfig.name, data, payload);
          } catch (err) {
            console.error('ShopifyCartBroadcaster: XHR JSON parsing failed', err);
          }
        } else {
          try {
            const errData = JSON.parse(this.responseText);
            dispatch(this._cartEventConfig.endpoint, errData, payload, true);
          } catch(e) {
            dispatch(this._cartEventConfig.endpoint, { status: this.status }, payload, true);
          }
        }
      });

      this.addEventListener('error', () => {
        dispatch(this._cartEventConfig.endpoint, { status: this.status }, payload, true);
      });
    }
    return originalSend.apply(this, [body]);
  };
})();
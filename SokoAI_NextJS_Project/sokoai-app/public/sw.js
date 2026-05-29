/**
 * SokoAI — Service Worker v1
 * Inashughulikia:
 *   1. Cache ya offline (bei za mwisho zionekane bila internet)
 *   2. Push notifications za bei (Price Drop, Spike alerts)
 *   3. Background sync ya bei mpya
 */

const SW_VERSION   = "sokoai-v1.0";
const STATIC_CACHE = `${SW_VERSION}-static`;
const API_CACHE    = `${SW_VERSION}-api`;

// Static files za kucache wakati wa install
const STATIC_URLS = [
  "/",
  "/masoko",
  "/bidhaa",
  "/offline",
  "/_next/static/css/app.css",
];

// API routes za kucache (stale-while-revalidate)
const API_CACHE_PATTERNS = [
  "/api/v1/prices",
  "/api/v1/commodities",
  "/api/v1/masoko",
  "/api/alerts",
];


// ── Install ───────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${SW_VERSION}`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});


// ── Activate ─────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating ${SW_VERSION}`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith("sokoai-") && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => {
            console.log(`[SW] Deleting old cache: ${k}`);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});


// ── Fetch strategy ────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests — stale-while-revalidate
  const isApiRoute = API_CACHE_PATTERNS.some(p => url.pathname.startsWith(p));
  if (isApiRoute && event.request.method === "GET") {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Static assets — cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Pages — network-first, offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(event.request));
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(event.request));
});


// ── Cache strategies ─────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  // Revalidate in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached immediately, or wait for network
  return cached || fetchPromise;
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline");
  }
}


// ── Push Notifications ────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "SokoAI", body: event.data.text() };
  }

  const { type, title, body, commodity, price, action_url } = data;

  // Notification icons kulingana na aina ya alert
  const icons = {
    PRICE_DROP: "/icons/alert-drop.png",
    SPIKE:      "/icons/alert-spike.png",
    TREND:      "/icons/alert-trend.png",
    WEEKLY:     "/icons/alert-weekly.png",
  };

  const options = {
    body,
    icon:   icons[type] || "/icons/icon-192.png",
    badge:  "/icons/badge-72.png",
    tag:    `sokoai-${type}-${commodity}`,  // Inahakikisha notification moja kwa commodity
    renotify: true,
    vibrate: [200, 100, 200],
    data:   { url: action_url || "/masoko", type, commodity },
    actions: [
      { action: "view",    title: "Angalia Bei" },
      { action: "dismiss", title: "Funga" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title || "SokoAI Alert", options)
  );
});


// ── Notification click ────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(windowClients => {
        // Kama app iko wazi, focus na navigate
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) {
            return client.focus().then(c => c.navigate(url));
          }
        }
        // Fungua window mpya
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});


// ── Background Sync ───────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-prices") {
    event.waitUntil(syncPrices());
  }
});

async function syncPrices() {
  try {
    const cache = await caches.open(API_CACHE);
    // Invalidate na refetch bei za leo
    const keys = await cache.keys();
    for (const key of keys) {
      if (key.url.includes("/api/v1/prices")) {
        await cache.delete(key);
      }
    }
    // Pre-fetch upya
    await fetch("/api/v1/prices");
    console.log("[SW] Prices synced in background");
  } catch (e) {
    console.error("[SW] Background sync failed:", e);
  }
}

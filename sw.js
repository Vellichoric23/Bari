// Offline shell: the app opens without internet; data syncs when the connection returns.
const CACHE = "bari-v46";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // fresh daily content first, cached copy when offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
// push reminders from the BARI server
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "BARI", body: e.data ? e.data.text() : "" }; }
  const opt = { body: d.body || "", tag: d.tag || undefined, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: d.url || "./", tid: d.tid || "" } };
  if (Array.isArray(d.actions) && d.actions.length) opt.actions = d.actions.slice(0, 2);
  e.waitUntil(self.registration.showNotification(d.title || "BARI", opt));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const d = e.notification.data || {};
  let url = d.url || "./";
  if (e.action && d.tid) url = "./?" + e.action + "=" + encodeURIComponent(d.tid);
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) { c.postMessage({ deep: url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

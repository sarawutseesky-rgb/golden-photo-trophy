// Minimal service worker for PWA installability.
// No caching — HTML/asset requests pass through to the network so
// new builds are picked up immediately. The fetch handler exists
// only because Chrome on Android requires one to show the install
// prompt (beforeinstallprompt).
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through; do not intercept or cache.
  return;
});
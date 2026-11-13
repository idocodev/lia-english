// Minimal offline support: network-first for pages, cache-first for assets.
// The voice clips (audio/manifest.json, from scripts/gen-audio.py) and the word pictures
// (pictures/manifest.json, from scripts/get-pictures.mjs) are precached so they work offline.
const CACHE = 'lia-english-v11'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(['./', './manifest.webmanifest', './icon.svg'])
      for (const list of ['./audio/manifest.json', './pictures/manifest.json']) {
        const files = await fetch(list).then((r) => r.json())
        await c.addAll(files.map((f) => './' + f))
      }
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

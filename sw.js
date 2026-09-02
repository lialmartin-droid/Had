const CACHE="nokia-had-v8.0.1-icons";
const FILES=[
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest?v=800-20260902",
  "./assets/icons/snake-icon-32.png?v=800-20260902",
  "./assets/icons/snake-icon-180.png?v=800-20260902",
  "./assets/icons/snake-icon-192.png?v=800-20260902",
  "./assets/icons/snake-icon-512.png?v=800-20260902"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }))
  );
});

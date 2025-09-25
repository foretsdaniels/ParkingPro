const CACHE_NAME = 'parkaudit-v1.0.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  // Add other critical assets
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background Sync for offline entries
self.addEventListener('sync', (event) => {
  if (event.tag === 'audit-sync') {
    event.waitUntil(syncOfflineEntries());
  }
});

async function syncOfflineEntries() {
  try {
    const pendingEntries = localStorage.getItem('pendingAuditEntries');
    if (pendingEntries) {
      const entries = JSON.parse(pendingEntries);
      
      for (const entry of entries) {
        try {
          const response = await fetch('/api/audit-entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(entry),
          });
          
          if (response.ok) {
            // Remove synced entry from pending
            const updatedEntries = entries.filter(e => e !== entry);
            localStorage.setItem('pendingAuditEntries', JSON.stringify(updatedEntries));
          }
        } catch (error) {
          console.error('Failed to sync entry:', error);
        }
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}
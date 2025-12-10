const CACHE_NAME = 'music-app-v3'; // Changed version for updates
const urlsToCache = [
  '/',
  '/index.html',
  '/upload.html',
  '/playlists.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Install event - cache files
self.addEventListener('install', event => {
  console.log('⚙️ Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Opened cache', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker: All resources cached');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        console.error('❌ Service Worker: Cache failed', error);
      })
  );
});

// Fetch event - serve from cache if available
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle cached audio URLs from upload page
  if (url.pathname.startsWith('/cached-audio/')) {
    event.respondWith(handleCachedAudioFetch(event));
    return;
  }
  
  // Handle regular audio files
  if (isAudioFile(request)) {
    event.respondWith(handleAudioFetch(event));
    return;
  }
  
  // Handle HTML page navigation
  if (request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then(networkResponse => {
              // Cache new page
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseClone));
              return networkResponse;
            })
            .catch(() => {
              // If offline and no cache, show offline page
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // For other resources (CSS, JS, images, etc.)
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return cached version
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(request)
          .then(networkResponse => {
            // Don't cache if not successful
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Cache the new resource
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // If it's an image and we're offline, return a placeholder
            if (request.headers.get('Accept').includes('image')) {
              return caches.match('/icons/icon-192x192.png');
            }
            return new Response('Offline', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Special handler for cached audio from upload page
function handleCachedAudioFetch(event) {
  const request = event.request;
  
  console.log('🎵 Handling cached audio request:', request.url);
  
  return caches.match(request)
    .then(cachedResponse => {
      if (cachedResponse) {
        console.log('✅ Serving from Service Worker cache:', request.url);
        return cachedResponse;
      }
      
      // Audio not in cache (shouldn't happen if uploaded properly)
      console.warn('⚠️ Cached audio not found:', request.url);
      return new Response('Audio not available', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
    .catch(error => {
      console.error('❌ Error serving cached audio:', error);
      return new Response('Audio error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    });
}

// Handler for regular audio files from network
function handleAudioFetch(event) {
  const request = event.request;
  
  return caches.match(request)
    .then(cachedResponse => {
      // If audio is cached, return it
      if (cachedResponse) {
        console.log('🎵 Serving cached audio:', request.url);
        return cachedResponse;
      }
      
      // Otherwise fetch from network
      return fetch(request)
        .then(networkResponse => {
          // Don't cache if not successful
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          
          // Check if file is small enough to cache (< 10MB)
          const contentLength = networkResponse.headers.get('content-length');
          if (contentLength && parseInt(contentLength) < 10 * 1024 * 1024) {
            // Cache the audio file
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                console.log('💾 Caching audio file:', request.url);
                cache.put(request, responseToCache);
              });
          } else {
            console.log('⚠️ Audio file too large to cache:', request.url);
          }
          
          return networkResponse;
        })
        .catch(() => {
          // If offline and audio not cached
          return new Response('Audio not available offline', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    });
}

// Check if request is for an audio file
function isAudioFile(request) {
  const url = request.url.toLowerCase();
  return url.includes('.mp3') || 
         url.includes('.wav') || 
         url.includes('.ogg') ||
         url.includes('.m4a') ||
         url.includes('.flac') ||
         url.includes('.aac') ||
         request.headers.get('Accept').includes('audio');
}

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete old caches (all previous versions)
            if (cacheName !== CACHE_NAME && cacheName.startsWith('music-app-')) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients
        return self.clients.claim();
      })
      .then(() => {
        console.log('✅ Service Worker: Activated and controlling clients');
        // Notify all clients that SW is ready
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_READY',
              version: 'v3'
            });
          });
        });
      })
  );
});

// Background sync for uploading songs (future feature)
self.addEventListener('sync', event => {
  if (event.tag === 'upload-songs') {
    console.log('🔄 Background sync: Uploading songs');
    event.waitUntil(uploadPendingSongs());
  }
});

// Message handler for caching audio from IndexedDB
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_AUDIO') {
    console.log('📨 Received message to cache audio:', event.data.fileName);
    
    const { url, blob, fileName } = event.data;
    
    // Validate the blob
    if (!blob || !(blob instanceof Blob)) {
      console.error('❌ Invalid blob received for caching');
      return;
    }
    
    caches.open(CACHE_NAME)
      .then(cache => {
        // Create proper response with audio headers
        const response = new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': blob.type || 'audio/mpeg',
            'Content-Length': blob.size,
            'Cache-Control': 'max-age=31536000' // Cache for 1 year
          }
        });
        
        // Create a proper Request object
        const request = new Request(url);
        
        // Store in cache
        return cache.put(request, response);
      })
      .then(() => {
        console.log('✅ Cached audio from IndexedDB:', fileName);
        
        // Confirm to the client
        event.ports && event.ports[0] && event.ports[0].postMessage({
          type: 'CACHE_SUCCESS',
          fileName: fileName
        });
      })
      .catch(error => {
        console.error('❌ Failed to cache audio:', error);
        
        // Notify client of failure
        event.ports && event.ports[0] && event.ports[0].postMessage({
          type: 'CACHE_ERROR',
          fileName: fileName,
          error: error.message
        });
      });
  }
  
  // Handle other message types
  if (event.data && event.data.type === 'GET_CACHED_AUDIO') {
    const { fileName } = event.data;
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(requests => {
        const audioRequests = requests.filter(req => 
          req.url.includes(fileName) || req.url.includes('/cached-audio/')
        );
        event.ports && event.ports[0] && event.ports[0].postMessage({
          type: 'CACHED_AUDIO_LIST',
          files: audioRequests.map(req => req.url)
        });
      });
  }
  
  // Clear audio cache
  if (event.data && event.data.type === 'CLEAR_AUDIO_CACHE') {
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(requests => {
        const audioRequests = requests.filter(req => 
          req.url.includes('/cached-audio/') || isAudioFile(req)
        );
        return Promise.all(
          audioRequests.map(req => cache.delete(req))
        );
      })
      .then(() => {
        console.log('🗑️ Cleared audio cache');
        event.ports && event.ports[0] && event.ports[0].postMessage({
          type: 'CACHE_CLEARED'
        });
      });
  }
});

// Helper function for background sync (placeholder)
function uploadPendingSongs() {
  // This would upload songs that failed to upload earlier
  return Promise.resolve();
}

// Handle push notifications (optional future feature)
self.addEventListener('push', event => {
  console.log('📱 Push notification received');
  
  const options = {
    body: 'Your music app has new features!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'play',
        title: '🎵 Play Music'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Music Library', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('📱 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'play') {
    // Open the music player
    event.waitUntil(
      clients.openWindow('/upload.html')
    );
  } else {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
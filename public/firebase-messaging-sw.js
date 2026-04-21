// Service Worker Version: 1.1
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// This will be replaced with actual config during build or fetched
// For now, we'll try to fetch it or use a placeholder that we'll update
// In this environment, we can just use the config from the main app
// But SW needs its own initialization

firebase.initializeApp({
  apiKey: "AIzaSyCxQX4ydrm2eColLyE00v2CPfOBSaSqt8g",
  authDomain: "gen-lang-client-0402153282.firebaseapp.com",
  projectId: "gen-lang-client-0402153282",
  storageBucket: "gen-lang-client-0402153282.firebasestorage.app",
  messagingSenderId: "979113642178",
  appId: "1:979113642178:web:3c4390ca5908d9f288535b"
});

const messaging = firebase.messaging();

// PWA Install and Fetch events
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker ...', event);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker ...', event);
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Basic fetch handler to satisfy PWA requirements
  event.respondWith(fetch(event.request));
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png', // Main app icon
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

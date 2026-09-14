// Scripts do Firebase para Service Worker (FCM em background no Android/Chrome/Desktop)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Ativação imediata sem esperar fechamento de abas
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const firebaseConfig = {
  apiKey: "AIzaSyCXJFdoJHbgUbEtIlLCJxvUvNbiHZ4nRZc",
  authDomain: "drivehora.firebaseapp.com",
  projectId: "drivehora",
  storageBucket: "drivehora.firebasestorage.app",
  messagingSenderId: "1017992679969",
  appId: "1:1017992679969:web:1a85c4d6007f51cd4f4960",
  measurementId: "G-H5RSW27QXN"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Manipulador de mensagens em segundo plano via Firebase SDK
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Push recebido em segundo plano:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'DriveHora';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Você tem uma nova notificação.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || `drivehora-${Date.now()}`,
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manipulador nativo de evento PUSH (garante entrega mesmo se payload vier via API direta)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { body: event.data ? event.data.text() : 'Você tem um novo aviso.' };
    } catch {}
  }

  const title = data.notification?.title || data.title || 'DriveHora';
  const body = data.notification?.body || data.body || 'Você tem um novo chamado no sistema.';

  const options = {
    body: body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [300, 150, 300],
    tag: data.tag || `drivehora-${Date.now()}`,
    data: data
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ação de clique na notificação: foca ou abre a janela da aplicação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Scripts do Firebase para Service Worker (FCM em background)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

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

// Manipulador de mensagens em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano:', payload);

  const notificationTitle = payload.notification?.title || 'DriveHora';
  const notificationOptions = {
    body: payload.notification?.body || 'Você tem uma nova notificação.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

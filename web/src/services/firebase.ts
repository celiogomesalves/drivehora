import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyCXJFdoJHbgUbEtIlLCJxvUvNbiHZ4nRZc",
  authDomain: "drivehora.firebaseapp.com",
  projectId: "drivehora",
  storageBucket: "drivehora.firebasestorage.app",
  messagingSenderId: "1017992679969",
  appId: "1:1017992679969:web:1a85c4d6007f51cd4f4960",
  measurementId: "G-H5RSW27QXN"
};

// Inicializa o app Firebase (singleton)
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Analytics (inicializado apenas se o ambiente suportar)
export const initAnalytics = async () => {
  if (typeof window !== "undefined" && (await isSupported())) {
    return getAnalytics(firebaseApp);
  }
  return null;
};

// Inicializa o Cloud Messaging para Push Notifications
export let messaging: Messaging | null = null;
if (typeof window !== "undefined" && "Notification" in window) {
  try {
    messaging = getMessaging(firebaseApp);
  } catch (e) {
    console.warn("Firebase Messaging não inicializado neste navegador:", e);
  }
}

/**
 * Solicita permissão e retorna o token de Push FCM do dispositivo Web
 * @param vapidKey Chave VAPID pública gerada no console do Firebase
 */
export async function requestWebPushToken(vapidKey?: string): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Notificações não são suportadas neste navegador.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Permissão de notificação negada pelo usuário.");
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(firebaseApp);
    }

    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey || undefined
    });

    if (currentToken) {
      console.log("Token FCM obtido com sucesso:", currentToken);
      return currentToken;
    } else {
      console.warn("Nenhum token FCM retornado. Registre o Service Worker.");
      return null;
    }
  } catch (err) {
    console.error("Erro ao solicitar token de Push FCM:", err);
    return null;
  }
}

/**
 * Escuta notificações recebidas em primeiro plano
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

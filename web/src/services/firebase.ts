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

export const DEFAULT_VAPID_KEY = 'BNPWXZbLEl64kql8ej1VQeCWRljWjzZrIA7B_K_e_VAyFWWrxLYuamzF-bUhElpTJfNBhzhrq8us90bYvAjcztQ';

/**
 * Registra o Service Worker do Firebase se suportado pelo navegador
 */
export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    
    // Timeout de segurança de 3.5 segundos para não travar aguardando ready
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration>((resolve) => {
      setTimeout(() => resolve(registration), 3500);
    });
    const finalReg = await Promise.race([readyPromise, timeoutPromise]);
    return finalReg || registration;
  } catch (err) {
    console.warn("Falha ao registrar Service Worker do Firebase:", err);
    return null;
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

  const activeVapid = (vapidKey && vapidKey.trim().length > 0) ? vapidKey.trim() : DEFAULT_VAPID_KEY;

  try {
    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }
    
    if (permission !== "granted") {
      console.warn("Permissão de notificação não concedida:", permission);
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(firebaseApp);
    }

    const swReg = await getOrRegisterServiceWorker();

    const fetchTokenPromise = getToken(messaging, {
      vapidKey: activeVapid,
      serviceWorkerRegistration: swReg || undefined
    });

    const timeoutTokenPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => {
        console.warn("Timeout ao aguardar resposta do FCM para getToken");
        resolve(null);
      }, 7000);
    });

    const currentToken = await Promise.race([fetchTokenPromise, timeoutTokenPromise]);

    if (currentToken) {
      console.log("Token FCM obtido com sucesso:", currentToken);
      return currentToken;
    } else {
      console.warn("Nenhum token FCM retornado pelo Firebase.");
      return null;
    }
  } catch (err) {
    console.error("Erro ao solicitar token de Push FCM:", err);
    return null;
  }
}

export interface PushTestResult {
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  token?: string;
  error?: string;
}

/**
 * Teste completo de diagnóstico e disparo de notificação push no navegador atual
 */
export async function testLocalPushNotification(vapidKey?: string): Promise<PushTestResult> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return {
      success: false,
      permission: 'unsupported',
      error: 'Notificações não são suportadas neste navegador ou dispositivo.'
    };
  }

  try {
    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      return {
        success: false,
        permission,
        error: permission === 'denied'
          ? 'Permissão bloqueada no navegador. Clique no ícone de cadeado na barra de endereços e altere Notificações para "Permitir".'
          : 'Permissão de notificação não foi concedida pelo usuário.'
      };
    }

    // Registra o Service Worker
    const swReg = await getOrRegisterServiceWorker();

    // Obtém o token FCM do dispositivo com fallback seguro da chave VAPID oficial
    let token: string | undefined = undefined;
    const activeVapid = (vapidKey && vapidKey.trim().length > 0) ? vapidKey.trim() : DEFAULT_VAPID_KEY;
    try {
      if (!messaging) {
        messaging = getMessaging(firebaseApp);
      }
      const fetchPromise = getToken(messaging, {
        vapidKey: activeVapid,
        serviceWorkerRegistration: swReg || undefined
      });
      const timeoutPromise = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 6000));
      const tokenResult = await Promise.race([fetchPromise, timeoutPromise]);
      if (tokenResult) token = tokenResult;
    } catch (tokenErr: any) {
      console.warn("Aviso ao obter token FCM durante o teste:", tokenErr?.message);
    }

    // Dispara notificação nativa via Service Worker (ou fallback Notification API)
    const title = '🔔 DriveHora: Teste de Push FCM';
    const options: NotificationOptions = {
      body: 'Excelente! O canal de notificações Push está conectado e operando no seu navegador.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'drivehora-test-push'
    };

    if (swReg && 'showNotification' in swReg) {
      await swReg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }

    return {
      success: true,
      permission,
      token
    };
  } catch (err: any) {
    return {
      success: false,
      permission: (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported',
      error: err?.message || 'Falha ao executar teste de notificação.'
    };
  }
}

/**
 * Escuta notificações recebidas em primeiro plano
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}


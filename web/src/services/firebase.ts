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

    try {
      // Força a atualização do Service Worker para aplicar as últimas alterações
      await registration.update();
    } catch {}

    // Aguarda o worker estar pronto com timeout defensivo
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration>((resolve) => {
      setTimeout(() => resolve(registration), 3000);
    });
    const finalReg = await Promise.race([readyPromise, timeoutPromise]);
    return finalReg || registration;
  } catch (err) {
    console.warn("Falha ao registrar Service Worker do Firebase:", err);
    return null;
  }
}

export interface WebPushTokenResult {
  success: boolean;
  token: string | null;
  permission: NotificationPermission | 'unsupported';
  error?: string;
}

/**
 * Solicitação com diagnóstico detalhado de token FCM Web Push
 */
export async function requestWebPushTokenDetailed(vapidKey?: string): Promise<WebPushTokenResult> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return {
      success: false,
      token: null,
      permission: 'unsupported',
      error: 'Notificações não são suportadas neste navegador ou dispositivo.'
    };
  }

  const activeVapid = (vapidKey && vapidKey.trim().length > 0) ? vapidKey.trim() : DEFAULT_VAPID_KEY;

  try {
    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      return {
        success: false,
        token: null,
        permission,
        error: permission === 'denied'
          ? 'Permissão bloqueada no navegador. Clique no ícone de configurações na barra de endereços e altere para "Permitir".'
          : 'Permissão de notificação não foi concedida pelo usuário.'
      };
    }

    if (!messaging) {
      messaging = getMessaging(firebaseApp);
    }

    const swReg = await getOrRegisterServiceWorker();

    let currentToken: string | null = null;
    let lastError: string = '';

    // Tentativa 1: com a registration obtida
    try {
      const fetchPromise = getToken(messaging, {
        vapidKey: activeVapid,
        serviceWorkerRegistration: swReg || undefined
      });
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      currentToken = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn("Tentativa 1 de getToken com swReg falhou:", lastError);
    }

    // Tentativa 2 (fallback): sem passar registration explicitamente
    if (!currentToken) {
      try {
        const fetchPromise2 = getToken(messaging, { vapidKey: activeVapid });
        const timeoutPromise2 = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
        currentToken = await Promise.race([fetchPromise2, timeoutPromise2]);
      } catch (e: any) {
        lastError = e?.message || String(e);
        console.warn("Tentativa 2 de getToken fallback falhou:", lastError);
      }
    }

    if (currentToken) {
      console.log("Token FCM obtido com sucesso:", currentToken);
      return { success: true, token: currentToken, permission };
    } else {
      console.warn("Nenhum token FCM retornado pelo Firebase:", lastError);
      return {
        success: false,
        token: null,
        permission,
        error: lastError || 'Firebase não retornou o token FCM (verifique chave VAPID ou conectividade).'
      };
    }
  } catch (err: any) {
    console.error("Erro ao solicitar token de Push FCM:", err);
    return {
      success: false,
      token: null,
      permission: (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported',
      error: err?.message || String(err)
    };
  }
}

/**
 * Solicita permissão e retorna o token de Push FCM do dispositivo Web
 * @param vapidKey Chave VAPID pública gerada no console do Firebase
 */
export async function requestWebPushToken(vapidKey?: string): Promise<string | null> {
  const result = await requestWebPushTokenDetailed(vapidKey);
  return result.token;
}

export interface PushTestResult {
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  token?: string;
  tokenError?: string;
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

    // Obtém o token FCM com diagnóstico detalhado
    const tokenDetailed = await requestWebPushTokenDetailed(vapidKey);
    const token = tokenDetailed.token || undefined;
    const tokenError = tokenDetailed.error;

    // Dispara notificação nativa via Service Worker (ou fallback Notification API)
    const title = '🔔 DriveHora: Teste de Push FCM';
    const options: NotificationOptions = {
      body: token 
        ? 'Excelente! Seu aparelho está registrado e conectado para notificações em primeiro e segundo plano.'
        : 'Notificação local exibida, mas atenção: o token FCM em segundo plano ainda não foi gerado.',
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
      token,
      tokenError
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


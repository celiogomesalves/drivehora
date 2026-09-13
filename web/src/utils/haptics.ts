/**
 * Utilitário de Feedback Tátil / Háptico (Vibrações sutis em smartphones)
 * Proporciona sensação de aplicativo nativo (Padrão Uber / Lyft / iOS / Android)
 */

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(30);
        break;
      case 'heavy':
        navigator.vibrate(50);
        break;
      case 'success':
        navigator.vibrate([20, 50, 30]);
        break;
      case 'warning':
        navigator.vibrate([40, 60, 40]);
        break;
      case 'error':
        navigator.vibrate([60, 40, 60, 40, 60]);
        break;
    }
  } catch {}
};

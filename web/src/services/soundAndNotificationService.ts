// Serviço Central de Áudio, Notificações Nativas e Vibração do DriveHora

export type NotificationSoundType = 'new_ride' | 'accepted' | 'in_progress' | 'finished' | 'alert';

// 1. Sintetizador Web Audio API de Alta Fidelidade (Funciona sem arquivos externos)
export const playNotificationSound = (type: NotificationSoundType = 'alert') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playTone = (freq: number, start: number, duration: number, gainVal: number = 0.25, wave: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    if (type === 'new_ride') {
      // Alerta chamativo para o motorista (Arpejo duplo de alerta)
      playTone(880, 0, 0.15, 0.35, 'triangle');
      playTone(1174.66, 0.18, 0.22, 0.35, 'triangle');
      playTone(1479.98, 0.42, 0.3, 0.35, 'triangle');
      playTone(1760, 0.74, 0.35, 0.4, 'triangle');
    } else if (type === 'accepted') {
      // Tom harmonioso para o passageiro: Motorista a caminho! (C5 -> E5 -> G5)
      playTone(523.25, 0, 0.18, 0.25, 'sine');
      playTone(659.25, 0.16, 0.22, 0.25, 'sine');
      playTone(783.99, 0.34, 0.4, 0.3, 'sine');
      playTone(1046.5, 0.54, 0.5, 0.2, 'sine');
    } else if (type === 'in_progress') {
      // Tom suave de início de viagem: Partida iniciada (A5 -> D6)
      playTone(880, 0, 0.2, 0.25, 'sine');
      playTone(1174.66, 0.22, 0.45, 0.28, 'sine');
    } else if (type === 'finished') {
      // Acorde triunfal de conclusão de corrida (G4 -> B4 -> D5 -> G5)
      playTone(392.00, 0, 0.25, 0.2, 'sine');
      playTone(493.88, 0.15, 0.25, 0.2, 'sine');
      playTone(587.33, 0.3, 0.3, 0.25, 'sine');
      playTone(783.99, 0.45, 0.6, 0.3, 'sine');
    } else {
      // Alerta geral
      playTone(600, 0, 0.15, 0.2, 'sine');
      playTone(900, 0.18, 0.3, 0.25, 'sine');
    }
  } catch (e) {
    console.warn('Erro ao reproduzir áudio Web Audio API:', e);
  }
};

// 2. Solicitar Permissão de Notificação com Confirmação do Usuário
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Toca som curto de confirmação
      playNotificationSound('accepted');
    }
    return permission;
  } catch (e) {
    console.warn('Erro ao solicitar permissão de notificações:', e);
    return 'denied';
  }
};

// 3. Disparar Notificação Nativa + Som + Vibração
export interface AppNotificationPayload {
  title: string;
  body: string;
  soundType?: NotificationSoundType;
  icon?: string;
  tag?: string;
}

export const sendAppNotification = (payload: AppNotificationPayload): void => {
  const { title, body, soundType = 'alert', icon = '/favicon.svg', tag } = payload;

  // 1. Tocar som apropriado
  playNotificationSound(soundType);

  // 2. Vibrar dispositivo se suportado (celulares Android / PWA)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {}
  }

  // 3. Notificação nativa do sistema operacional / navegador
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon,
          tag: tag || `dh_${Date.now()}`
        });
      } catch (err) {
        console.warn('Falha ao instanciar notificação nativa:', err);
      }
    }
  }
};

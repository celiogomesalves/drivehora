/**
 * Utilitários para Gestão de Sessão Única Concorrente (Single Active Session)
 */

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Navegador Web';
  const ua = navigator.userAgent;
  
  let os = 'Dispositivo';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Navegador';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  return `${browser} (${os})`;
}

/**
 * Identificador Único e Persistente do Dispositivo / Navegador Local
 * Permanece mesmo após logout para saber com certeza se é o mesmo aparelho.
 */
export function getLocalDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';
  let devId = localStorage.getItem('drivehora_device_id');
  if (!devId) {
    devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem('drivehora_device_id', devId);
  }
  return devId;
}

/**
 * Monta a string completa de identificação do aparelho contendo nome amigável + ID de hardware/browser
 */
export function getFullDeviceSignature(): string {
  const name = getDeviceName();
  const devId = getLocalDeviceId();
  return `${name} #${devId}`;
}

export function generateSessionToken(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getLocalSessionToken(): string {
  let token = localStorage.getItem('drivehora_session_token');
  if (!token) {
    token = generateSessionToken();
    localStorage.setItem('drivehora_session_token', token);
  }
  return token;
}

export function setLocalSessionToken(token: string): void {
  localStorage.setItem('drivehora_session_token', token);
}

export function clearLocalSessionToken(): void {
  localStorage.removeItem('drivehora_session_token');
}

/**
 * Sanitiza o nome do dispositivo cadastrado para exibição limpa ao usuário
 */
export function formatDeviceName(raw?: string | null): string {
  if (!raw) return 'Outro Dispositivo';
  const trimmed = raw.trim();
  if (
    trimmed.startsWith('{') || 
    trimmed.startsWith('[') || 
    trimmed.includes('"wallet"') || 
    trimmed.includes('"userId"') || 
    trimmed.includes('usr_')
  ) {
    return 'Outro Dispositivo';
  }
  // Remove a hash de identificação interna (#dev_...) para exibição amigável
  if (trimmed.includes('#dev_')) {
    return trimmed.split('#dev_')[0].trim();
  }
  return trimmed;
}

/**
 * Verifica se o dispositivo salvo no banco é rigorosamente o mesmo aparelho atual
 */
export function isSameDevice(savedDeviceRaw?: string | null): boolean {
  if (!savedDeviceRaw) return false;
  const currentDevId = getLocalDeviceId();
  if (savedDeviceRaw.includes(currentDevId)) {
    return true;
  }
  return false;
}

/**
 * Verifica se uma sessão anterior já está expirada por inatividade (padrão: 15 minutos)
 */
export function isSessionInactive(lastActiveAt?: string | null, maxInactiveMinutes = 15): boolean {
  if (!lastActiveAt) return true;
  try {
    const diffMs = Date.now() - new Date(lastActiveAt).getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes > maxInactiveMinutes;
  } catch {
    return true;
  }
}

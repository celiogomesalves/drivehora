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
 * Sanitiza o nome do dispositivo cadastrado, prevenindo exibição de objetos JSON legados de carteira/usuário
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
  return trimmed;
}

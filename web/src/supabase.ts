import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Variáveis globais em cache
let globalUrl = import.meta.env.VITE_SUPABASE_URL || '';
let globalKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Obter credenciais globais (Environment > Backend Config > LocalStorage)
export const getSupabaseCredentials = () => {
  const storageUrl = localStorage.getItem('drivehora_supabase_url') || '';
  const storageKey = localStorage.getItem('drivehora_supabase_key') || '';

  const url = globalUrl || storageUrl;
  const key = globalKey || storageKey;

  return { url, key, isConfigured: Boolean(url && key) };
};

// Salvar credenciais globalmente
export const saveSupabaseCredentials = async (url: string, key: string) => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  globalUrl = cleanUrl;
  globalKey = cleanKey;

  localStorage.setItem('drivehora_supabase_url', cleanUrl);
  localStorage.setItem('drivehora_supabase_key', cleanKey);

  // Sincronizar com o servidor backend central (para que todos os dispositivos recebam)
  try {
    await fetch('/api/config/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, key: cleanKey })
    });
  } catch (e) {
    console.warn('Não foi possível sincronizar credenciais com o backend:', e);
  }
};

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export const getSupabase = (): SupabaseClient | null => {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  if (cachedClient && lastUsedUrl === url && lastUsedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    return cachedClient;
  } catch (e) {
    console.error('Erro ao inicializar Supabase:', e);
    return null;
  }
};

// Auto-sincronizar credenciais do backend no início
export const initGlobalSupabaseConfig = async () => {
  try {
    const res = await fetch('/api/config/supabase');
    if (res.ok) {
      const data = await res.json();
      if (data.url && data.key) {
        globalUrl = data.url;
        globalKey = data.key;
        localStorage.setItem('drivehora_supabase_url', data.url);
        localStorage.setItem('drivehora_supabase_key', data.key);
      }
    }
  } catch (e) {
    // Modo offline / estático
  }
};

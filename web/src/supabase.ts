import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Variáveis globais em cache
let globalUrl = import.meta.env.VITE_SUPABASE_URL || '';
let globalKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Obter credenciais globais (Environment > LocalStorage > Cache)
export const getSupabaseCredentials = () => {
  const storageUrl = localStorage.getItem('drivehora_supabase_url') || '';
  const storageKey = localStorage.getItem('drivehora_supabase_key') || '';

  const url = globalUrl || storageUrl;
  const key = globalKey || storageKey;

  return { url, key, isConfigured: Boolean(url && key) };
};

// Salvar credenciais globalmente e sincronizar com todos os usuários
export const saveSupabaseCredentials = async (url: string, key: string) => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  globalUrl = cleanUrl;
  globalKey = cleanKey;

  localStorage.setItem('drivehora_supabase_url', cleanUrl);
  localStorage.setItem('drivehora_supabase_key', cleanKey);

  // 1. Sincronizar com a API Serverless Vercel / Backend Node
  try {
    await fetch('/api/config/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, key: cleanKey })
    });
  } catch (e) {
    console.warn('Sincronização API Vercel:', e);
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

// Sincronizar automaticamente as credenciais configuradas para todos os usuários
export const initGlobalSupabaseConfig = async (): Promise<boolean> => {
  // 1. Tentar ler do backend serverless
  try {
    const res = await fetch('/api/config/supabase');
    if (res.ok) {
      const data = await res.json();
      if (data.url && data.key) {
        globalUrl = data.url;
        globalKey = data.key;
        localStorage.setItem('drivehora_supabase_url', data.url);
        localStorage.setItem('drivehora_supabase_key', data.key);
        return true;
      }
    }
  } catch (e) {}

  // 2. Se já estiver no localStorage, retorna true
  const creds = getSupabaseCredentials();
  return creds.isConfigured;
};

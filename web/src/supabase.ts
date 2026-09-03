import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Obter credenciais do .env ou de localStorage para configuração dinâmica
export const getSupabaseCredentials = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const storageUrl = localStorage.getItem('drivehora_supabase_url') || '';
  const storageKey = localStorage.getItem('drivehora_supabase_key') || '';

  const url = storageUrl || envUrl;
  const key = storageKey || envKey;

  return { url, key, isConfigured: Boolean(url && key) };
};

export const saveSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('drivehora_supabase_url', url.trim());
  localStorage.setItem('drivehora_supabase_key', key.trim());
};

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';

export const getSupabase = (): SupabaseClient | null => {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  if (cachedClient && lastUsedUrl === url) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    lastUsedUrl = url;
    return cachedClient;
  } catch (e) {
    console.error('Erro ao inicializar Supabase:', e);
    return null;
  }
};

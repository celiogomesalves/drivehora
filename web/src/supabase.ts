import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://dnebvxvzlsudndjybaoe.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZWJ2eHZ6bHN1ZG5kanliYW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTA2NjIsImV4cCI6MjEwNDAyNjY2Mn0.LZXJEozYDXVHV9UiUg4y275f-ZA0hZgzTbfExBKcq38';

// Variáveis globais em cache (Nativo com fallback padrão de produção)
let globalUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
let globalKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

// Obter credenciais globais (LocalStorage > Environment > Fallback Padrão)
export const getSupabaseCredentials = () => {
  const storageUrl = localStorage.getItem('drivehora_supabase_url') || '';
  const storageKey = localStorage.getItem('drivehora_supabase_key') || '';

  const url = storageUrl || globalUrl || DEFAULT_SUPABASE_URL;
  const key = storageKey || globalKey || DEFAULT_SUPABASE_ANON_KEY;

  return { url, key, isConfigured: Boolean(url && key) };
};

// Salvar credenciais globalmente (quando o Super Admin quiser trocar no futuro)
export const saveSupabaseCredentials = async (url: string, key: string) => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  globalUrl = cleanUrl;
  globalKey = cleanKey;

  localStorage.setItem('drivehora_supabase_url', cleanUrl);
  localStorage.setItem('drivehora_supabase_key', cleanKey);

  // Sincronizar com a API Serverless Vercel / Backend Node
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

  // 2. Usar padrão nativo de produção
  const creds = getSupabaseCredentials();
  return creds.isConfigured;
};

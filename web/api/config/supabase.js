// Vercel Serverless Function: Central de Configuração Global do Supabase

let inMemoryConfig = {
  url: 'https://dnebvxvzlsudndjybaoe.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZWJ2eHZ6bHN1ZG5kanliYW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTA2NjIsImV4cCI6MjEwNDAyNjY2Mn0.LZXJEozYDXVHV9UiUg4y275f-ZA0hZgzTbfExBKcq38'
};

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { url, key } = req.body || {};
    if (url && key) {
      inMemoryConfig = { url: url.trim(), key: key.trim() };
      return res.status(200).json({ success: true, message: 'Configuração do Supabase salva com sucesso globalmente!' });
    }
    return res.status(400).json({ error: 'URL e Chave do Supabase são obrigatórias.' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(inMemoryConfig);
  }

  res.status(405).json({ error: 'Método não permitido.' });
}

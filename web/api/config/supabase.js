// Vercel Serverless Function - Sincronização Global de Credenciais Supabase
// Permite que a configuração realizada por 1 administrador seja compartilhada com todos os usuários

let cachedConfig = {
  url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
  key: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { url, key } = body || {};
      if (url && key) {
        cachedConfig = {
          url: String(url).trim(),
          key: String(key).trim()
        };
      }
      return res.status(200).json({ success: true, ...cachedConfig });
    } catch (e) {
      return res.status(400).json({ error: "Invalid payload" });
    }
  }

  // GET: Retornar configuração atual
  return res.status(200).json(cachedConfig);
}

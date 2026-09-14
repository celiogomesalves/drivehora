// Vercel Serverless Function: Envio de Notificações Push FCM v1 para Dispositivos (Web & Mobile)
// Permite que notificações cheguem mesmo com o navegador ou app fechados
import crypto from 'crypto';

// Credenciais da Service Account do Firebase DriveHora
const DEFAULT_SERVICE_ACCOUNT = {
  project_id: "drivehora",
  client_email: "firebase-adminsdk-fbsvc@drivehora.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDJpY/zktWpPiY8\nsup9J4iKjoIfVIRJEeXtF+61QxeLtgHakJ8/AjqtU7RP1V6o9bG0JHLuAoWh2vZb\nj/cWlLZgm5jrACXJAZVJVUH6xZXOOv+0gULS4J342oQANwxyiD5NY/wDEQuVumP8\nhTuC39RQXalzz3f56s7aeWRY/UXhWGd1YbG1MN1k66Vp5OOmHOmS67V+X8c8FHTH\nSXG0SzL+YRUpy+yqJlCk/pAoiHvCSg4YmfxyFGhDRIyUDyM5JgTWuetcGGCucla8\n4BDl/fMNqeEiY7Iuy0Ou313GnAfxNcZXq94+F/xrMt9l47MyOsJC5baspzpynJzG\n0VnOBJ1NAgMBAAECgf9o40CtJAaIBwjaQMjTBWWLqnyg5UvDEwO+dxXzH7/FcBBw\n2ChjwoqSPuR6tc2YXoyA9tYroldmenoWQVnVO6LaKJki3BB9do/dz9CaiESq1X0I\nHjSG6gZhiLFC7JeIDNx4sJWd4wpA4ZOMFJMVsScWvvbJmaT6gXvfb0VaXtj4GUB/\nwnvFxDixO5Prj3bn0bsefU0FQzZhlZUtJntu96dB510U25khZ88H/B59Ky/OO7ow\neLfF8F2X0z/lU+B0KdETB70wf4yhP9YAPFZL0yslJxc1HNmccbTtEjgCU91pmwI3\nmj8KVQt/xHcLZGZqDoaYnMKU5vE7p535DIQhJskCgYEA8zB7TAyluJmz+U9ZqaCW\nwnmdXlCsngaHqsPNbwH+b7aJ1dbl2nNTFKUnMxzxn2kR68s1LXLTMVaOJvnE4D5W\njKz885jQ6XztTn4Rktvc42htzQWjcKtCB1hTHE2nyZPI7IU9hyVewVzRtlOEbDQS\naQffX50EFzRa7OAJHd5tkqsCgYEA1ETb+d+5HI0sUFrkOIo3CqL4gUeaw7p7Prgb\nFCPG4ig/jSXx6R00FDv/4sfb/1ms0dgyzSKS78JYIc8VMv6wJzynJ3ULmifkOUEM\nke0b3XG3pvSzxK5rF4COHpXk7EoxfPf/l/5hnyp6kccaSz8VOIUmVlcbWx6bA2AQ\nYnanz+cCgYEAqF7Cnq6K9joEbvHPRC/Y8SA+IhR8zpP6zfHug5K/1BxvZcv5K7t4\no+yMLUk2yIV4UOZKFQNQ0PH6TWXUNuUyCwehwg3lZiKGMjf6dtEeJ5wfmTj0JYeM\nmYU/VXM2Xcuh6o99P9pRtlJLJ46/OiL7NBitQId3U5F9+k5KQZHEDy0CgYAICFMK\nsZyfp/f1UnswaIqMrH4a5krE/VmMlgrwSCpOhJdjD/yHhcNiwKJ+QnHgx9PyXOwP\nNy+4QvJy1RNISrr/wRvSMmut+bR5NizzmLVlO9hnSPtEhhUnXoYCQknXZzdYM0pI\nxieLjl/1BEPKdSioauF4gvNWD2JuTkRQdY0EIQKBgFPtuSoEVD7Td9YQ7nt5LJFF\njoaFOrt66+YRrfXqsiK16zCeJxUXRe1EUZltHleT1q4bpdnL7pUkW7EcKoCzdXZy\nA4duCt+hntSCecGW4ly+FIsjkf/PlMegkbEjbllDjtv6+xnC7NCGYNPFsTQzYBFS\nitjDnrtmyJt621eTaMnw\n-----END PRIVATE KEY-----\n"
};

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {}
  }
  return DEFAULT_SERVICE_ACCOUNT;
}

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Cache do Access Token na memória da Serverless Function
let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < (tokenExpiresAt - 120)) {
    return cachedAccessToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(sa.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha OAuth2 Google: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600);
  return cachedAccessToken;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { token, tokens, title, body, sound, data = {} } = req.body || {};

  const targetTokens = Array.isArray(tokens) && tokens.length > 0
    ? tokens
    : (token ? [token] : []);

  if (targetTokens.length === 0) {
    return res.status(400).json({ error: 'Nenhum token FCM informado para envio.' });
  }

  try {
    const sa = getServiceAccount();
    const accessToken = await getGoogleAccessToken(sa);
    const projectId = sa.project_id || 'drivehora';
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const pushTitle = title || 'DriveHora';
    const pushBody = body || 'Você tem uma nova notificação';

    const results = await Promise.allSettled(
      targetTokens.map(async (devToken) => {
        const payload = {
          message: {
            token: devToken,
            notification: {
              title: pushTitle,
              body: pushBody
            },
            data: {
              title: pushTitle,
              body: pushBody,
              sound: sound || 'new_ride_a',
              timestamp: String(Date.now()),
              ...data
            },
            webpush: {
              headers: {
                Urgency: 'high'
              },
              notification: {
                title: pushTitle,
                body: pushBody,
                icon: '/favicon.svg',
                badge: '/favicon.svg',
                tag: `dh_${Date.now()}`,
                requireInteraction: true
              }
            }
          }
        };

        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`FCM Erro [${response.status}]: ${errData}`);
        }

        return await response.json();
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    return res.status(200).json({
      ok: true,
      sentCount: targetTokens.length,
      successCount,
      failureCount,
      results: results.map(r => r.status === 'fulfilled' ? { status: 'sent' } : { status: 'failed', error: r.reason?.message || String(r.reason) })
    });
  } catch (err) {
    console.error('Erro na Serverless Function de Push:', err);
    return res.status(500).json({
      error: 'Falha ao processar envio FCM',
      detail: err?.message || String(err)
    });
  }
}

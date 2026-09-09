// Vercel Serverless Function: Integração Completa com a API do Asaas (Sandbox & Produção)
// Resolve problemas de CORS do navegador e garante que cobranças e simulações reflitam no dashboard do Asaas

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

  const {
    action,
    apiKey,
    environment = 'sandbox',
    paymentId,
    rideId,
    amount,
    description = 'DriveHora - Corrida',
    clientName = 'Passageiro DriveHora',
    clientEmail = 'passageiro@drivehora.app',
    clientCpf = '01234567890'
  } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'Chave de API do Asaas não informada.' });
  }

  const cleanKey = apiKey.trim();
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';

  try {
    // -------------------------------------------------------------------------
    // 1. Criar Cobrança Pix no Asaas
    // -------------------------------------------------------------------------
    if (action === 'create_pix') {
      // 1.1 Localizar ou Criar Cliente no Asaas
      let customerId = null;

      try {
        const listCustRes = await fetch(`${baseUrl}/customers?limit=1`, {
          headers: { 'access_token': cleanKey, 'User-Agent': 'DriveHora/1.0' }
        });
        if (listCustRes.ok) {
          const listData = await listCustRes.json();
          if (listData?.data && listData.data.length > 0) {
            customerId = listData.data[0].id;
          }
        }
      } catch (err) {
        console.warn('Erro ao listar clientes no Asaas:', err);
      }

      // Se ainda não existir cliente, cria um novo
      if (!customerId) {
        const createCustRes = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers: {
            'access_token': cleanKey,
            'Content-Type': 'application/json',
            'User-Agent': 'DriveHora/1.0'
          },
          body: JSON.stringify({
            name: clientName,
            email: clientEmail,
            cpfCnpj: clientCpf
          })
        });

        if (createCustRes.ok) {
          const newCust = await createCustRes.json();
          customerId = newCust.id;
        } else {
          const errData = await createCustRes.json().catch(() => ({}));
          console.warn('Falha ao criar cliente no Asaas:', errData);
        }
      }

      if (!customerId) {
        return res.status(400).json({ error: 'Não foi possível registrar o cliente no Asaas.' });
      }

      // 1.2 Criar a cobrança Pix
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const payRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'access_token': cleanKey,
          'Content-Type': 'application/json',
          'User-Agent': 'DriveHora/1.0'
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: Number(amount) || 50,
          dueDate: dueDateStr,
          description: description,
          externalReference: rideId
        })
      });

      if (!payRes.ok) {
        const errPay = await payRes.json().catch(() => ({}));
        return res.status(payRes.status).json({
          error: errPay?.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas.'
        });
      }

      const payData = await payRes.json();
      const realPaymentId = payData.id;

      // 1.3 Obter QR Code e Copia e Cola do Asaas
      const qrRes = await fetch(`${baseUrl}/payments/${realPaymentId}/pixQrCode`, {
        headers: {
          'access_token': cleanKey,
          'User-Agent': 'DriveHora/1.0'
        }
      });

      let pixQrCodeUrl = undefined;
      let pixCopiaECola = undefined;
      let expiresAt = undefined;

      if (qrRes.ok) {
        const qrData = await qrRes.json();
        pixQrCodeUrl = qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : undefined;
        pixCopiaECola = qrData.payload;
        expiresAt = qrData.expirationDate;
      }

      return res.status(200).json({
        success: true,
        externalId: realPaymentId,
        pixQrCodeUrl,
        pixCopiaECola,
        expiresAt
      });
    }

    // -------------------------------------------------------------------------
    // 2. Simular Pagamento no Asaas (Ambiente de Testes / Sandbox)
    // -------------------------------------------------------------------------
    if (action === 'simulate_payment') {
      if (!paymentId) {
        return res.status(400).json({ error: 'ID da cobrança do Asaas não informado.' });
      }

      const today = new Date().toISOString().split('T')[0];
      const simRes = await fetch(`${baseUrl}/payments/${paymentId}/receiveInCash`, {
        method: 'POST',
        headers: {
          'access_token': cleanKey,
          'Content-Type': 'application/json',
          'User-Agent': 'DriveHora/1.0'
        },
        body: JSON.stringify({
          paymentDate: today,
          value: Number(amount) || undefined
        })
      });

      if (!simRes.ok) {
        const errSim = await simRes.json().catch(() => ({}));
        return res.status(simRes.status).json({
          error: errSim?.errors?.[0]?.description || 'Erro ao simular recebimento no Asaas.'
        });
      }

      const simData = await simRes.json();
      return res.status(200).json({
        success: true,
        message: 'Pagamento confirmado e registrado como RECEBIDO no Asaas!',
        status: simData.status,
        paymentId: simData.id
      });
    }

    return res.status(400).json({ error: 'Ação não reconhecida.' });
  } catch (e) {
    console.error('Erro na API Serverless Asaas:', e);
    return res.status(500).json({ error: e.message || 'Erro interno no servidor.' });
  }
}

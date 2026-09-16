export interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export const formatCep = (value: string): string => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
};

export const fetchAddressByCep = async (cep: string): Promise<CepResult | null> => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  // 1. Tentar ViaCEP com timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          cep: data.cep || cleanCep,
          logradouro: data.logradouro || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          localidade: data.localidade || '',
          uf: data.uf || ''
        };
      }
    }
  } catch (error) {
    console.warn('ViaCEP indisponível ou timeout, tentando BrasilAPI como fallback...', error);
  }

  // 2. Fallback resiliente com BrasilAPI
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return {
        cep: data.cep || cleanCep,
        logradouro: data.street || '',
        complemento: '',
        bairro: data.neighborhood || '',
        localidade: data.city || '',
        uf: data.state || ''
      };
    }
  } catch (error) {
    console.error('Falha ao consultar BrasilAPI:', error);
  }

  return null;
};


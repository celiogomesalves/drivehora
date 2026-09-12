import { getSupabase } from '../supabase';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  rideId?: string;
  createdAt: number;
}

export interface UserWallet {
  userId: string;
  balance: number; // Positivo = crédito disponível; Negativo = débito pendente
  transactions: WalletTransaction[];
  hasPendingDebt: boolean;
}

const WALLET_STORAGE_PREFIX = 'drivehora_wallet_';

/**
 * Obtém os dados de carteira do usuário (localStorage com sincronização no Supabase)
 */
export async function getUserWallet(userId: string): Promise<UserWallet> {
  if (!userId) {
    return { userId: '', balance: 0, transactions: [], hasPendingDebt: false };
  }

  // 1. Tentar ler do Supabase na tabela system_settings (ou legado de transição)
  const sb = getSupabase();
  let remoteWallet: UserWallet | null = null;

  if (sb) {
    try {
      // 1.1 Nova leitura da tabela global de configurações/dados
      const resSetting = await sb
        .from('system_settings')
        .select('value')
        .eq('key', `wallet_${userId}`)
        .maybeSingle();

      if (resSetting.data?.value?.wallet) {
        remoteWallet = resSetting.data.value.wallet;
      } else {
        // 1.2 Fallback de transição apenas se ainda existir dado antigo
        const resProf = await sb
          .from('profiles')
          .select('id, active_device_name')
          .eq('id', userId)
          .maybeSingle();

        if (resProf.data?.active_device_name && resProf.data.active_device_name.startsWith('{"wallet":')) {
          const parsed = JSON.parse(resProf.data.active_device_name);
          if (parsed.wallet) {
            remoteWallet = parsed.wallet;
          }
        }
      }
    } catch (e) {
      console.warn('Aviso: falha ao buscar carteira no Supabase:', e);
    }
  }

  // 2. Fallback para cache local
  let localWallet: UserWallet | null = null;
  try {
    const raw = localStorage.getItem(`${WALLET_STORAGE_PREFIX}${userId}`);
    if (raw) localWallet = JSON.parse(raw);
  } catch (e) {}

  const wallet = remoteWallet || localWallet || {
    userId,
    balance: 0,
    transactions: [],
    hasPendingDebt: false
  };

  wallet.hasPendingDebt = (wallet.balance || 0) < 0;
  return wallet;
}

/**
 * Salva e sincroniza a carteira do usuário no Supabase e localStorage
 */
export async function saveUserWallet(wallet: UserWallet): Promise<void> {
  wallet.hasPendingDebt = (wallet.balance || 0) < 0;

  try {
    localStorage.setItem(`${WALLET_STORAGE_PREFIX}${wallet.userId}`, JSON.stringify(wallet));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drivehora_wallet_updated', { detail: wallet }));
    }
  } catch (e) {}

  const sb = getSupabase();
  if (sb && wallet.userId) {
    try {
      // Sincroniza estado da carteira na tabela system_settings (chave isolada)
      await sb
        .from('system_settings')
        .upsert({
          key: `wallet_${wallet.userId}`,
          value: { wallet },
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.warn('Aviso ao sincronizar carteira em system_settings:', err);
    }
  }
}

/**
 * Adiciona crédito à carteira do passageiro (ex: ressarcimento de corrida cancelada pelo motorista)
 */
export async function addWalletCredit(userId: string, amount: number, description: string, rideId?: string): Promise<UserWallet> {
  const current = await getUserWallet(userId);
  const newTx: WalletTransaction = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    userId,
    type: 'credit',
    amount: Math.abs(amount),
    description,
    rideId,
    createdAt: Date.now()
  };

  const updated: UserWallet = {
    ...current,
    balance: Number(((current.balance || 0) + Math.abs(amount)).toFixed(2)),
    transactions: [newTx, ...(current.transactions || [])]
  };

  await saveUserWallet(updated);
  return updated;
}

/**
 * Deduz saldo / registra débito na carteira do passageiro
 */
export async function addWalletDebit(userId: string, amount: number, description: string, rideId?: string): Promise<UserWallet> {
  const current = await getUserWallet(userId);
  const newTx: WalletTransaction = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    userId,
    type: 'debit',
    amount: Math.abs(amount),
    description,
    rideId,
    createdAt: Date.now()
  };

  const updated: UserWallet = {
    ...current,
    balance: Number(((current.balance || 0) - Math.abs(amount)).toFixed(2)),
    transactions: [newTx, ...(current.transactions || [])]
  };

  await saveUserWallet(updated);
  return updated;
}

/**
 * Quitação / Regularização de Débito realizada pelo Administrador
 */
export async function clearUserDebtByAdmin(userId: string, adminNotes?: string): Promise<UserWallet> {
  const current = await getUserWallet(userId);
  const pendingDebt = current.balance < 0 ? Math.abs(current.balance) : 0;

  const newTx: WalletTransaction = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    userId,
    type: 'credit',
    amount: pendingDebt,
    description: adminNotes ? `Débito regularizado pela administração: ${adminNotes}` : 'Débito regularizado e quitado pela administração',
    createdAt: Date.now()
  };

  const updated: UserWallet = {
    ...current,
    balance: 0,
    hasPendingDebt: false,
    transactions: [newTx, ...(current.transactions || [])]
  };

  await saveUserWallet(updated);
  return updated;
}

import React, { useState } from 'react';
import type { UserProfile, ClientProfile } from '../types/auth';
import { formatCep, fetchAddressByCep } from '../services/cepService';
import { formatPhone, formatCpf, validateCpf, validatePhone } from '../utils/formatters';
import { MapPin, Search, CheckCircle2, Check, RefreshCw, AlertCircle, Database } from 'lucide-react';
import { dbSaveClientProfile, dbCheckSupabaseStatus } from '../services/dbService';

interface ClientOnboardingProps {
  user: UserProfile;
  onComplete: (clientProfile: ClientProfile) => void;
  onOpenSupabaseConfig?: () => void;
}

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ 
  user, 
  onComplete,
  onOpenSupabaseConfig 
}) => {
  const [phone, setPhone] = useState(formatPhone(user.phone || ''));
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepSuccess, setCepSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDbError, setIsDbError] = useState(false);

  // Manipular busca automática do CEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    setCepSuccess(false);

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      const result = await fetchAddressByCep(clean);
      setIsLoadingCep(false);
      if (result) {
        setStreet(result.logradouro || '');
        setNeighborhood(result.bairro || '');
        setCity(result.localidade || '');
        setState(result.uf || '');
        setCepSuccess(true);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsDbError(false);

    // 1. Validação Real e Impeditiva de CPF
    if (!validateCpf(cpf)) {
      setErrorMessage('CPF inválido. Por favor, insira um número de CPF autêntico.');
      return;
    }

    // 2. Validação Real e Impeditiva de Telefone
    if (!validatePhone(phone)) {
      setErrorMessage('Número de telefone inválido. Insira um número com DDD válido (ex: 11 98765-4321).');
      return;
    }

    // 3. Validação de Endereço
    if (!street || !number || !neighborhood || !city || !state) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios do endereço.');
      return;
    }

    // 4. Checagem de Conexão com o Banco Supabase
    setIsSaving(true);
    const dbStatus = await dbCheckSupabaseStatus();
    if (!dbStatus.connected) {
      setIsSaving(false);
      setIsDbError(true);
      setErrorMessage(`⚠️ Impossível cadastrar cliente: Não há conexão com o banco de dados Supabase (${dbStatus.message || 'Desconectado'}). Conecte o banco primeiro.`);
      return;
    }

    const profile: ClientProfile = {
      id: 'client_' + user.id,
      userId: user.id,
      cpf,
      phone,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      isProfileComplete: true
    };

    const res = await dbSaveClientProfile(profile);
    setIsSaving(false);

    if (!res.success) {
      setIsDbError(true);
      setErrorMessage(`Falha ao salvar no banco: ${res.error}`);
      return;
    }

    onComplete(profile);
  };

  return (
    <div style={{ maxWidth: '650px', margin: '30px auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '36px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.15)',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: '#818cf8'
          }}>
            <MapPin size={30} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Complete seu Cadastro</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Olá <strong>{user.fullName}</strong>! Precisamos do seu endereço e telefone para agilizar seus chamados no banco de dados.
          </p>
        </div>

        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '14px 16px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>

            {isDbError && onOpenSupabaseConfig && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                <Database size={14} /> Conectar Banco
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label>Telefone / WhatsApp</label>
              <input
                type="tel"
                className="custom-input"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 98765-4321"
                maxLength={15}
                required
              />
            </div>

            <div className="input-group">
              <label>CPF</label>
              <input
                type="text"
                className="custom-input"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>
          </div>

          {/* Campo de CEP com Busca Automática */}
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>CEP (Busca Automática de Endereço)</label>
              {isLoadingCep && (
                <span style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={12} className="animate-spin" /> Buscando no ViaCEP...
                </span>
              )}
              {cepSuccess && (
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <CheckCircle2 size={12} /> Endereço Localizado!
                </span>
              )}
            </div>
            
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="custom-input"
                value={cep}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
                required
              />
              <Search size={18} style={{ position: 'absolute', right: '14px', top: '13px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Campos Preenchidos Automaticamente */}
          <div className="input-group">
            <label>Rua / Logradouro</label>
            <input
              type="text"
              className="custom-input"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Rua, Avenida..."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
            <div className="input-group">
              <label>Número</label>
              <input
                type="text"
                className="custom-input"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1000"
                required
              />
            </div>

            <div className="input-group">
              <label>Complemento (Opcional)</label>
              <input
                type="text"
                className="custom-input"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Apto 42, Bloco B"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: '12px' }}>
            <div className="input-group">
              <label>Bairro</label>
              <input
                type="text"
                className="custom-input"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                required
              />
            </div>

            <div className="input-group">
              <label>Cidade</label>
              <input
                type="text"
                className="custom-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cidade"
                required
              />
            </div>

            <div className="input-group">
              <label>UF</label>
              <input
                type="text"
                className="custom-input"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '10px' }}
          >
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
            <span>{isSaving ? 'Gravando no Banco de Dados...' : 'Salvar no Banco e Acessar DriveHora'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

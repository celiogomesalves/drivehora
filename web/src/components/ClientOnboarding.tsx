import React, { useState, useEffect } from 'react';
import type { UserProfile, ClientProfile } from '../types/auth';
import { formatCep, fetchAddressByCep } from '../services/cepService';
import { formatPhone, formatCpf, validateCpf, validatePhone } from '../utils/formatters';
import { MapPin, Search, CheckCircle2, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { dbSaveClientProfile } from '../services/dbService';

interface ClientOnboardingProps {
  user: UserProfile;
  initialProfile?: ClientProfile | null;
  onComplete: (clientProfile: ClientProfile) => void;
}

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ 
  user, 
  initialProfile,
  onComplete 
}) => {
  // 💾 Recuperar rascunho de cliente salvo em memória interna
  const getSavedDraft = () => {
    try {
      const raw = localStorage.getItem(`drivehora_client_draft_${user.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const draft = getSavedDraft();

  const initialPhone = (user.phone && user.phone !== '(11) 98765-4321') 
    ? formatPhone(user.phone) 
    : (initialProfile?.phone && initialProfile.phone !== '(11) 98765-4321') 
    ? formatPhone(initialProfile.phone) 
    : (draft?.phone && draft.phone !== '(11) 98765-4321') 
    ? draft.phone 
    : '';

  const [phone, setPhone] = useState(initialPhone);
  const [cpf, setCpf] = useState(draft?.cpf || initialProfile?.cpf || '');
  const [cep, setCep] = useState(draft?.cep || initialProfile?.cep || '');
  const [street, setStreet] = useState(draft?.street || initialProfile?.street || '');
  const [number, setNumber] = useState(draft?.number || initialProfile?.number || '');
  const [complement, setComplement] = useState(draft?.complement || initialProfile?.complement || '');
  const [neighborhood, setNeighborhood] = useState(draft?.neighborhood || initialProfile?.neighborhood || '');
  const [city, setCity] = useState(draft?.city || initialProfile?.city || '');
  const [state, setState] = useState(draft?.state || initialProfile?.state || '');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepSuccess, setCepSuccess] = useState(Boolean(draft?.street || initialProfile?.street));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 💾 Salvar automaticamente em memória interna a cada alteração
  useEffect(() => {
    try {
      localStorage.setItem(
        `drivehora_client_draft_${user.id}`,
        JSON.stringify({
          phone,
          cpf,
          cep,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        })
      );
    } catch (e) {}
  }, [phone, cpf, cep, street, number, complement, neighborhood, city, state, user.id]);

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

    // 4. Salvar Cadastro (Local-first resiliente para nunca travar o passageiro)
    setIsSaving(true);
    try {
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

      await dbSaveClientProfile(profile, user);
      onComplete(profile);
    } catch (err: any) {
      console.warn('Aviso de rede ao salvar cliente:', err);
      const fallbackProfile: ClientProfile = {
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
      onComplete(fallbackProfile);
    } finally {
      setIsSaving(false);
    }
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
            Olá <strong>{user.fullName}</strong>! Precisamos do seu endereço e telefone para agilizar seus chamados no sistema.
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
            gap: '10px'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
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
            <span>{isSaving ? 'Gravando Cadastro...' : 'Salvar Cadastro e Acessar DriveHora'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, AlertCircle, Save, MapPin, FileText } from 'lucide-react';
import type { UserProfile, ClientProfile } from '../types/auth';
import { formatCep, fetchAddressByCep } from '../services/cepService';
import { formatPhone, formatCpf, validateCpf, validatePhone } from '../utils/formatters';
import { dbSaveClientProfile } from '../services/dbService';

interface ClientProfileManagerProps {
  user: UserProfile;
  initialProfile?: ClientProfile | null;
  onSaveSuccess: (updatedProfile: ClientProfile) => void;
}

export const ClientProfileManager: React.FC<ClientProfileManagerProps> = ({
  user,
  initialProfile,
  onSaveSuccess
}) => {
  const [fullName, setFullName] = useState(user.fullName || initialProfile?.fullName || '');
  const [email] = useState(user.email || '');
  const [phone, setPhone] = useState(formatPhone(user.phone || initialProfile?.phone || ''));
  const [cpf, setCpf] = useState(formatCpf(initialProfile?.cpf || ''));
  
  const [cep, setCep] = useState(formatCep(initialProfile?.cep || ''));
  const [street, setStreet] = useState(initialProfile?.street || '');
  const [number, setNumber] = useState(initialProfile?.number || '');
  const [complement, setComplement] = useState(initialProfile?.complement || '');
  const [neighborhood, setNeighborhood] = useState(initialProfile?.neighborhood || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [state, setState] = useState(initialProfile?.state || '');

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      if (initialProfile.cpf) setCpf(formatCpf(initialProfile.cpf));
      if (initialProfile.phone) setPhone(formatPhone(initialProfile.phone));
      if (initialProfile.cep) setCep(formatCep(initialProfile.cep));
      if (initialProfile.street) setStreet(initialProfile.street);
      if (initialProfile.number) setNumber(initialProfile.number);
      if (initialProfile.complement) setComplement(initialProfile.complement);
      if (initialProfile.neighborhood) setNeighborhood(initialProfile.neighborhood);
      if (initialProfile.city) setCity(initialProfile.city);
      if (initialProfile.state) setState(initialProfile.state);
    }
  }, [initialProfile]);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);

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
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validação de Nome
    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      setErrorMessage('Por favor, informe seu Nome Completo (nome e sobrenome).');
      return;
    }

    // 2. Validação Real de CPF
    if (!validateCpf(cpf)) {
      setErrorMessage('CPF inválido. Para emissão de pagamentos Pix pelos Gateways, um CPF autêntico é obrigatório.');
      return;
    }

    // 3. Validação de Telefone
    if (!validatePhone(phone)) {
      setErrorMessage('Número de celular/WhatsApp inválido. Informe o DDD e o número com 9 dígitos.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedClientProfile: ClientProfile = {
        id: initialProfile?.id || ('client_' + user.id),
        userId: user.id,
        fullName: fullName.trim(),
        phone: phone.replace(/\D/g, ''),
        cpf: cpf.replace(/\D/g, ''),
        cep: cep.replace(/\D/g, ''),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        isProfileComplete: true
      };

      await dbSaveClientProfile(updatedClientProfile, user);
      onSaveSuccess(updatedClientProfile);
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar os dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const isCpfValid = validateCpf(cpf);
  const isPhoneValid = validatePhone(phone);

  return (
    <div className="glass-panel" style={{ padding: '28px', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8'
        }}>
          <User size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Meus Dados & Cadastro de Passageiro</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Mantenha seu CPF e dados atualizados para emissão de cobranças e faturas nos Gateways de Pagamento.
          </p>
        </div>
      </div>



      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#fca5a5',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successNotice && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#6ee7b7',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          <span>Dados cadastrais atualizados e validados com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Dados Pessoais & Fiscais Obrigatórios */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} color="#818cf8" />
            <span>1. Dados Pessoais Obrigatórios</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Nome Completo *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                CPF (Obrigatório para emissão Pix) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="input-field"
                  style={{
                    width: '100%',
                    fontSize: '0.85rem',
                    borderColor: cpf.length === 14 ? (isCpfValid ? '#10b981' : '#ef4444') : undefined
                  }}
                />
                {cpf.length === 14 && (
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: isCpfValid ? '#10b981' : '#ef4444'
                  }}>
                    {isCpfValid ? '✓ Válido' : '✗ Inválido'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Celular / WhatsApp com DDD *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="input-field"
                  style={{
                    width: '100%',
                    fontSize: '0.85rem',
                    borderColor: phone.length >= 14 ? (isPhoneValid ? '#10b981' : '#ef4444') : undefined
                  }}
                />
                {phone.length >= 14 && (
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: isPhoneValid ? '#10b981' : '#ef4444'
                  }}>
                    {isPhoneValid ? '✓ Válido' : '✗ Inválido'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                E-mail Cadastrado
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem', opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>
          </div>
        </div>

        {/* Endereço Residencial (Para Faturamento e Embarque) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={15} color="#38bdf8" />
            <span>2. Endereço Residencial</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                CEP
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="00000-000"
                  maxLength={9}
                  value={cep}
                  onChange={handleCepChange}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
                {isLoadingCep && (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#38bdf8' }}>
                    Buscando...
                  </span>
                )}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Rua / Logradouro
              </label>
              <input
                type="text"
                placeholder="Nome da sua rua ou avenida"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Número
              </label>
              <input
                type="text"
                placeholder="Ex: 123"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Complemento
              </label>
              <input
                type="text"
                placeholder="Apto, Bloco..."
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Bairro
              </label>
              <input
                type="text"
                placeholder="Seu bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Cidade
              </label>
              <input
                type="text"
                placeholder="Sua cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Estado (UF)
              </label>
              <input
                type="text"
                maxLength={2}
                placeholder="UF"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button
            type="submit"
            disabled={isSaving || !isCpfValid || !isPhoneValid}
            className="btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '12px'
            }}
          >
            <Save size={18} />
            <span>{isSaving ? 'Salvando Dados...' : 'Salvar Dados Cadastrais'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

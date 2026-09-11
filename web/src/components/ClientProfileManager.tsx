import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, AlertCircle, Save, MapPin, FileText, Lock, X } from 'lucide-react';
import type { UserProfile, ClientProfile } from '../types/auth';
import { formatCep, fetchAddressByCep } from '../services/cepService';
import { formatPhone, formatCpf, validateCpf, validatePhone } from '../utils/formatters';
import { dbSaveClientProfile } from '../services/dbService';

interface ClientProfileManagerProps {
  user: UserProfile;
  initialProfile?: ClientProfile | null;
  isApproved?: boolean;
  hasCompletedRides?: boolean;
  isUserAdmin?: boolean;
  onSaveSuccess: (updatedProfile: ClientProfile) => void;
}

export const ClientProfileManager: React.FC<ClientProfileManagerProps> = ({
  user,
  initialProfile,
  isApproved,
  hasCompletedRides,
  isUserAdmin,
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

  // Modal de solicitação de alteração de dados
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeRequestText, setChangeRequestText] = useState('');
  const [changeRequestSent, setChangeRequestSent] = useState(false);

  // Passageiro com cadastro homologado ou que já realizou corrida tem a edição bloqueada
  const isLocked = Boolean((isApproved || hasCompletedRides || initialProfile?.isProfileComplete) && !isUserAdmin);

  useEffect(() => {
    if (initialProfile) {
      if (initialProfile.fullName) setFullName(initialProfile.fullName);
      if (initialProfile.cpf) setCpf(formatCpf(initialProfile.cpf));
      if (initialProfile.phone) setPhone(formatPhone(initialProfile.phone));
      if (initialProfile.cep) setCep(formatCep(initialProfile.cep));
      if (initialProfile.street) setStreet(initialProfile.street);
      if (initialProfile.number) setNumber(initialProfile.number);
      if (initialProfile.complement) setComplement(initialProfile.complement);
      if (initialProfile.neighborhood) setNeighborhood(initialProfile.neighborhood);
      if (initialProfile.city) setCity(initialProfile.city);
      if (initialProfile.state) setState(initialProfile.state);
    } else if (user.fullName) {
      setFullName(user.fullName);
    }
  }, [initialProfile, user.fullName]);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
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
    if (isLocked) return;
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
    <div className="glass-panel" style={{ padding: '18px 20px', maxWidth: '680px', margin: '0 auto' }}>
      {/* Cabeçalho Compacto da Aba Meus Dados */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            flexShrink: 0
          }}>
            <User size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Meus Dados Cadastrais
            </h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Dados cadastrais e fiscais utilizados nas faturas e corridas da plataforma.
            </p>
          </div>
        </div>

        {isUserAdmin && (
          <span style={{
            fontSize: '0.7rem',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#f59e0b',
            padding: '2px 8px',
            borderRadius: '8px',
            fontWeight: 700
          }}>
            👑 Painel Admin (Edição Livre)
          </span>
        )}
      </div>

      {/* Banner de Cadastro Homologado e Protegido (Edição Bloqueada) */}
      {isLocked && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.08))',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Lock size={16} color="#10b981" />
            </div>
            <div>
              <p style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981', margin: 0 }}>
                Cadastro Homologado e Protegido
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Dados protegidos por segurança. Para alterar CPF, nome ou telefone, solicite ao suporte.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowChangeRequest(true); setChangeRequestSent(false); setChangeRequestText(''); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981', fontWeight: 700, fontSize: '0.78rem',
              cursor: 'pointer', flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            <FileText size={13} />
            <span>Solicitar Alteração</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#fca5a5',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '14px'
        }}>
          <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successNotice && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#6ee7b7',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '14px'
        }}>
          <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
          <span>Dados cadastrais atualizados e validados com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Dados Pessoais & Fiscais Obrigatórios */}
        <div className="profile-section-card">
          <div className="profile-section-title">
            <FileText size={14} color="#818cf8" />
            <span>1. Dados Pessoais Obrigatórios</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div>
              <label className="profile-field-label">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                disabled={isLocked}
                placeholder="Ex: Carlos Eduardo Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>

            <div>
              <label className="profile-field-label">
                CPF (Obrigatório para emissão Pix) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  disabled={isLocked}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="input-field"
                  style={{
                    width: '100%',
                    fontSize: '0.82rem',
                    borderColor: cpf.length === 14 ? (isCpfValid ? '#10b981' : '#ef4444') : undefined,
                    ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                  }}
                />
                {cpf.length === 14 && (
                  <span style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: isCpfValid ? '#10b981' : '#ef4444'
                  }}>
                    {isCpfValid ? '✓ Válido' : '✗ Inválido'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="profile-field-label">
                Celular / WhatsApp com DDD *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  disabled={isLocked}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="input-field"
                  style={{
                    width: '100%',
                    fontSize: '0.82rem',
                    borderColor: phone.length >= 14 ? (isPhoneValid ? '#10b981' : '#ef4444') : undefined,
                    ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                  }}
                />
                {phone.length >= 14 && (
                  <span style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: isPhoneValid ? '#10b981' : '#ef4444'
                  }}>
                    {isPhoneValid ? '✓ Válido' : '✗ Inválido'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="profile-field-label">
                E-mail Cadastrado
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="input-field"
                style={{ width: '100%', fontSize: '0.82rem', opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>
          </div>
        </div>

        {/* Endereço Residencial (Para Faturamento e Embarque) */}
        <div className="profile-section-card">
          <div className="profile-section-title">
            <MapPin size={14} color="#38bdf8" />
            <span>2. Endereço Residencial</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div>
              <label className="profile-field-label">
                CEP
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  disabled={isLocked}
                  placeholder="00000-000"
                  maxLength={9}
                  value={cep}
                  onChange={handleCepChange}
                  className="input-field"
                  style={{
                    width: '100%',
                    fontSize: '0.82rem',
                    ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                  }}
                />
                {isLoadingCep && (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', color: '#38bdf8' }}>
                    Buscando...
                  </span>
                )}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="profile-field-label">
                Rua / Logradouro
              </label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="Nome da sua rua ou avenida"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>

            <div>
              <label className="profile-field-label">
                Número
              </label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="Ex: 123"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>

            <div>
              <label className="profile-field-label">
                Complemento
              </label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="Apto, Bloco..."
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>

            <div>
              <label className="profile-field-label">
                Bairro
              </label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="Seu bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>

            <div>
              <label className="profile-field-label">
                Cidade
              </label>
              <input
                type="text"
                disabled={isLocked}
                placeholder="Sua cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>

            <div>
              <label className="profile-field-label">
                Estado (UF)
              </label>
              <input
                type="text"
                disabled={isLocked}
                maxLength={2}
                placeholder="UF"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  ...(isLocked ? { opacity: 0.75, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' } : {})
                }}
              />
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '10px' }}>
          {isLocked ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.78rem', fontWeight: 600 }}>
                <Lock size={14} />
                <span>Edição bloqueada — Cadastro validado</span>
              </div>
              <button
                type="button"
                onClick={() => { setShowChangeRequest(true); setChangeRequestSent(false); setChangeRequestText(''); }}
                className="btn-outline"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  whiteSpace: 'nowrap'
                }}
              >
                <FileText size={14} />
                <span>Solicitar Alteração ao Suporte</span>
              </button>
            </>
          ) : (
            <div style={{ marginLeft: 'auto' }}>
              <button
                type="submit"
                disabled={isSaving || !isCpfValid || !isPhoneValid}
                className="btn-primary"
                style={{
                  padding: '9px 22px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Save size={15} />
                <span>{isSaving ? 'Salvando Dados...' : 'Salvar Dados Cadastrais'}</span>
              </button>
            </div>
          )}
        </div>
      </form>

      {/* MODAL DE SOLICITAÇÃO DE ALTERAÇÃO DE DADOS */}
      {showChangeRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0d1527',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '20px',
            padding: '24px 20px',
            maxWidth: '480px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  📝 Solicitar Alteração de Dados
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Informe quais dados cadastrais ou endereço precisam ser corrigidos. A moderação analisará seu pedido.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeRequest(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {changeRequestSent ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '18px',
                textAlign: 'center'
              }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontWeight: 700, color: '#10b981', margin: 0, fontSize: '0.9rem' }}>Solicitação enviada com sucesso!</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  O suporte/administrador foi notificado e atualizará seus dados após a conferência.
                </p>
                <button
                  type="button"
                  onClick={() => setShowChangeRequest(false)}
                  className="btn-primary"
                  style={{ marginTop: '14px', padding: '7px 20px', fontSize: '0.82rem', borderRadius: '8px' }}
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={changeRequestText}
                  onChange={e => setChangeRequestText(e.target.value)}
                  placeholder="Descreva quais dados precisam ser alterados e o motivo. Ex: Troca de telefone para (11) 98765-4321 ou novo endereço na Rua XYZ, 100."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowChangeRequest(false)}
                    className="btn-outline"
                    style={{ flex: 1, padding: '9px', fontSize: '0.82rem', justifyContent: 'center', borderRadius: '8px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!changeRequestText.trim() || changeRequestText.trim().length < 10}
                    onClick={() => {
                      try {
                        const requests = JSON.parse(localStorage.getItem('drivehora_change_requests') || '[]');
                        requests.push({
                          role: 'client',
                          userId: user.id,
                          clientId: user.id,
                          userName: fullName || user.fullName,
                          userEmail: user.email,
                          userPhone: phone,
                          message: changeRequestText.trim(),
                          createdAt: new Date().toISOString(),
                          status: 'pending'
                        });
                        localStorage.setItem('drivehora_change_requests', JSON.stringify(requests));
                      } catch (e) {}
                      setChangeRequestSent(true);
                    }}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '9px',
                      fontSize: '0.82rem',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      opacity: (!changeRequestText.trim() || changeRequestText.trim().length < 10) ? 0.5 : 1
                    }}
                  >
                    Enviar ao Suporte
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

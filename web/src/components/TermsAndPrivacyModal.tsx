import React, { useState } from 'react';
import { 
  X, ShieldCheck, FileText, Search, CheckCircle2, 
  Lock, UserCheck 
} from 'lucide-react';
import { 
  TERMS_OF_USE_SECTIONS, 
  PRIVACY_POLICY_LGPD_SECTIONS, 
  LEGAL_TERMS_METADATA,
  type LegalSection 
} from '../constants/legalTerms';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  mustAccept?: boolean;
  initialTab?: 'terms' | 'privacy';
  theme?: 'light' | 'dark';
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  mustAccept = false,
  initialTab = 'terms',
  theme = 'dark'
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [agreedCheckbox, setAgreedCheckbox] = useState(false);

  if (!isOpen) return null;

  const currentSections: LegalSection[] = activeTab === 'terms' 
    ? TERMS_OF_USE_SECTIONS 
    : PRIVACY_POLICY_LGPD_SECTIONS;

  const filteredSections = currentSections.filter(sec => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = sec.title.toLowerCase().includes(query);
    const matchesBadge = sec.badge?.toLowerCase().includes(query);
    const matchesContent = sec.content.some(c => c.toLowerCase().includes(query));
    return matchesTitle || matchesBadge || matchesContent;
  });

  const handleConfirmAccept = () => {
    if (onAccept) {
      onAccept();
    }
    onClose();
  };

  return (
    <div 
      className="modal-overlay"
      onClick={() => {
        if (!mustAccept) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '92vh',
          maxHeight: '780px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: theme === 'light' 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.2)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* CABEÇALHO DO MODAL */}
        <div style={{
          padding: '20px 24px',
          borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
          background: theme === 'light' ? '#f8fafc' : 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: activeTab === 'terms' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: activeTab === 'terms' ? '#6366f1' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${activeTab === 'terms' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
            }}>
              {activeTab === 'terms' ? <FileText size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: theme === 'light' ? '#0f172a' : '#ffffff',
                  margin: 0
                }}>
                  {activeTab === 'terms' ? 'Termos de Uso e Condições Gerais' : 'Política de Privacidade e Proteção de Dados (LGPD)'}
                </h3>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  background: activeTab === 'terms' ? '#6366f1' : '#10b981',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  textTransform: 'uppercase'
                }}>
                  v{LEGAL_TERMS_METADATA.version}
                </span>
              </div>
              <p style={{
                fontSize: '0.75rem',
                color: theme === 'light' ? '#475569' : '#94a3b8',
                margin: '2px 0 0 0'
              }}>
                Atualizado em {LEGAL_TERMS_METADATA.lastUpdated} • Lei Federal nº 13.709/2018 (LGPD)
              </p>
            </div>
          </div>

          {!mustAccept && (
            <button
              onClick={onClose}
              type="button"
              aria-label="Fechar"
              style={{
                background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.06)',
                border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: theme === 'light' ? '#475569' : '#94a3b8',
                transition: 'all 0.15s'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* SELETOR DE ABAS + CAMPO DE BUSCA */}
        <div style={{
          padding: '12px 24px',
          background: theme === 'light' ? '#f1f5f9' : 'rgba(255, 255, 255, 0.02)',
          borderBottom: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{
            display: 'inline-flex',
            background: theme === 'light' ? '#ffffff' : 'rgba(0, 0, 0, 0.3)',
            padding: '3px',
            borderRadius: '12px',
            border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('terms');
                setSearchQuery('');
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'terms' ? (theme === 'light' ? '#2563eb' : '#6366f1') : 'transparent',
                color: activeTab === 'terms' ? '#ffffff' : (theme === 'light' ? '#475569' : '#94a3b8'),
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={14} />
              <span>Termos de Uso</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('privacy');
                setSearchQuery('');
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'privacy' ? '#10b981' : 'transparent',
                color: activeTab === 'privacy' ? '#ffffff' : (theme === 'light' ? '#475569' : '#94a3b8'),
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck size={14} />
              <span>Privacidade & LGPD</span>
            </button>
          </div>

          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: theme === 'light' ? '#64748b' : '#94a3b8' }} />
            <input
              type="search"
              placeholder="Buscar cláusula ou tema..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: '0.8rem',
                borderRadius: '10px',
                background: theme === 'light' ? '#ffffff' : 'rgba(0, 0, 0, 0.25)',
                border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid var(--border-subtle)',
                color: theme === 'light' ? '#0f172a' : '#ffffff',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* ALERTA DE CONSENTIMENTO LGPD */}
        <div style={{
          padding: '10px 24px',
          background: theme === 'light' ? '#eff6ff' : 'rgba(99, 102, 241, 0.08)',
          borderBottom: theme === 'light' ? '1px solid #dbeafe' : '1px solid rgba(99, 102, 241, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.78rem',
          color: theme === 'light' ? '#1e40af' : '#a5b4fc'
        }}>
          <Lock size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Proteção Rigorosa:</strong> Seus dados pessoais e de localização são protegidos por criptografia e tratados com total respeito aos artigos 7º, 11 e 18 da Lei Federal nº 13.709/2018 (LGPD).
          </span>
        </div>

        {/* CORPO DE TEXTO COM ROLAGEM */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {filteredSections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <p>Nenhuma cláusula encontrada para o termo <strong>"{searchQuery}"</strong>.</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px', marginTop: '10px' }}
              >
                Limpar Busca
              </button>
            </div>
          ) : (
            filteredSections.map((section, idx) => (
              <div 
                key={section.id || idx}
                style={{
                  background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                  border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <h4 style={{
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    color: theme === 'light' ? '#0f172a' : '#ffffff',
                    margin: 0
                  }}>
                    {section.title}
                  </h4>
                  {section.badge && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      background: theme === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                      color: theme === 'light' ? '#334155' : '#cbd5e1'
                    }}>
                      {section.badge}
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.84rem',
                  lineHeight: 1.6,
                  color: theme === 'light' ? '#334155' : '#cbd5e1'
                }}>
                  {section.content.map((paragraph, pIdx) => (
                    <p key={pIdx} style={{ margin: 0 }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* RODAPÉ DO DOCUMENTO LEGAL */}
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f1f5f9' : 'rgba(255, 255, 255, 0.01)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.04)',
            fontSize: '0.78rem',
            color: theme === 'light' ? '#64748b' : '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.5
          }}>
            <strong>{LEGAL_TERMS_METADATA.legalEntity}</strong><br />
            Encarregado de Proteção de Dados (DPO):{' '}
            <a 
              href={`mailto:${LEGAL_TERMS_METADATA.dpoEmail}`}
              style={{ color: theme === 'light' ? '#2563eb' : '#818cf8', textDecoration: 'underline' }}
            >
              {LEGAL_TERMS_METADATA.dpoEmail}
            </a>
          </div>
        </div>

        {/* ÁREA DE CONFIRMAÇÃO / ACEITE OBRIGATÓRIO */}
        <div style={{
          padding: '16px 24px',
          borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
          background: theme === 'light' ? '#f8fafc' : '#0b1120',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {mustAccept || onAccept ? (
            <>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                color: theme === 'light' ? '#1e293b' : '#f8fafc',
                lineHeight: 1.4
              }}>
                <input
                  type="checkbox"
                  checked={agreedCheckbox}
                  onChange={(e) => setAgreedCheckbox(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#2563eb',
                    marginTop: '2px',
                    cursor: 'pointer'
                  }}
                />
                <span>
                  Li atentamente e <strong>concordo expressamente com os Termos de Uso e com a Política de Privacidade e Tratamento de Dados Pessoais (LGPD)</strong> do DriveHora.
                </span>
              </label>

              <button
                type="button"
                onClick={handleConfirmAccept}
                disabled={!agreedCheckbox}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  opacity: agreedCheckbox ? 1 : 0.5,
                  cursor: agreedCheckbox ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 size={18} />
                <span>Confirmar Aceite e Prosseguir</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <UserCheck size={18} />
              <span>Entendido</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

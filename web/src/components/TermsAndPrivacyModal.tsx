import React, { useState } from 'react';
import { X, FileText, ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';
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
  const [agreedCheckbox, setAgreedCheckbox] = useState(false);

  if (!isOpen) return null;

  const currentSections: LegalSection[] = activeTab === 'terms' 
    ? TERMS_OF_USE_SECTIONS 
    : PRIVACY_POLICY_LGPD_SECTIONS;

  const handleConfirmAccept = () => {
    if (onAccept) {
      onAccept();
    }
    onClose();
  };

  const isLight = theme === 'light';

  return (
    <div 
      className="modal-overlay"
      onClick={() => {
        if (!mustAccept) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
        style={{
          width: '100%',
          maxWidth: '720px',
          height: '90vh',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: isLight ? '#ffffff' : '#0f172a',
          color: isLight ? '#1e293b' : '#f8fafc',
          border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isLight 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.2)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 25px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden'
        }}
      >
        {/* CABEÇALHO LIMPO E DIRETO */}
        <div style={{
          padding: '18px 24px',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
          background: isLight ? '#f8fafc' : '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: isLight ? '#0f172a' : '#ffffff',
              margin: 0
            }}>
              Termos de Uso & Privacidade
            </h3>
            <p style={{
              fontSize: '0.78rem',
              color: isLight ? '#64748b' : '#94a3b8',
              margin: '3px 0 0'
            }}>
              Versão {LEGAL_TERMS_METADATA.version} • Conforme Lei Geral de Proteção de Dados (LGPD)
            </p>
          </div>

          {!mustAccept && (
            <button
              onClick={onClose}
              type="button"
              aria-label="Fechar"
              style={{
                background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isLight ? '#475569' : '#94a3b8',
                transition: 'all 0.15s',
                flexShrink: 0
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* SELETOR DE ABAS ELEGANTE */}
        <div style={{
          padding: '10px 24px',
          background: isLight ? '#f1f5f9' : '#0b1120',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            style={{
              padding: '7px 16px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'terms' ? (isLight ? '#2563eb' : '#3b82f6') : 'transparent',
              color: activeTab === 'terms' ? '#ffffff' : (isLight ? '#475569' : '#94a3b8'),
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={15} />
            <span>Termos de Uso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            style={{
              padding: '7px 16px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'privacy' ? (isLight ? '#059669' : '#10b981') : 'transparent',
              color: activeTab === 'privacy' ? '#ffffff' : (isLight ? '#475569' : '#94a3b8'),
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={15} />
            <span>Privacidade & LGPD</span>
          </button>
        </div>

        {/* CORPO DE LEITURA FLUIDO E LIMPO (ESTILO ARTIGO/DOCUMENTO) */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            background: isLight ? '#ffffff' : '#0f172a',
            lineHeight: 1.7
          }}
        >
          {currentSections.map((section, idx) => (
            <article 
              key={section.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                paddingBottom: '18px',
                borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <h4 style={{
                fontSize: '1.02rem',
                fontWeight: 800,
                color: isLight ? '#0f172a' : '#ffffff',
                margin: 0,
                letterSpacing: '-0.01em'
              }}>
                {section.title}
              </h4>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.88rem',
                color: isLight ? '#334155' : '#cbd5e1'
              }}>
                {section.content.map((paragraph, pIdx) => (
                  <p key={pIdx} style={{ margin: 0, textAlign: 'justify' }}>
                    {paragraph}
                  </p>
                ))}
              </div>

              {section.subsections && section.subsections.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  paddingLeft: '16px',
                  borderLeft: `2px solid ${isLight ? '#2563eb' : '#6366f1'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {section.subsections.map((sub, sIdx) => (
                    <div key={sIdx}>
                      <strong style={{ fontSize: '0.85rem', color: isLight ? '#0f172a' : '#f8fafc' }}>
                        {sub.subtitle}
                      </strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '0.84rem' }}>
                        {sub.items.map((item, iIdx) => (
                          <li key={iIdx} style={{ margin: '2px 0' }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}

          {/* RODAPÉ DO DOCUMENTO LEGAL */}
          <div style={{
            padding: '16px',
            marginTop: '10px',
            borderRadius: '12px',
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.78rem',
            color: isLight ? '#64748b' : '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.6
          }}>
            <strong>{LEGAL_TERMS_METADATA.legalEntity}</strong><br />
            Encarregado pelo Tratamento de Dados Pessoais (DPO):{' '}
            <a 
              href={`mailto:${LEGAL_TERMS_METADATA.dpoEmail}`}
              style={{ color: isLight ? '#2563eb' : '#60a5fa', textDecoration: 'underline' }}
            >
              {LEGAL_TERMS_METADATA.dpoEmail}
            </a>
          </div>
        </div>

        {/* ÁREA DE ACEITE / CONFIRMAÇÃO */}
        <div style={{
          padding: '16px 24px',
          borderTop: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
          background: isLight ? '#f8fafc' : '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {mustAccept || onAccept ? (
            <>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.84rem',
                color: isLight ? '#1e293b' : '#f8fafc',
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
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
                <span>
                  Li atentamente e <strong>concordo com os Termos de Uso e com a Política de Privacidade (LGPD)</strong>.
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

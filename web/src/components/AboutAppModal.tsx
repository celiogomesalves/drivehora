import React from 'react';
import { X, Clock, ShieldCheck, MapPin, Star, Heart, PhoneCall } from 'lucide-react';
import { DriveHoraLogo } from './DriveHoraLogo';
import type { SystemSettings } from '../services/settingsService';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  logoOption?: 1 | 2 | 3 | 'custom';
  theme?: 'light' | 'dark';
  insurance?: SystemSettings['insurance'];
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({
  isOpen,
  onClose,
  onOpenTerms,
  logoOption = 2,
  theme = 'dark',
  insurance
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
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
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '24px',
          background: theme === 'light' ? '#ffffff' : '#0f172a',
          border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: theme === 'light' 
            ? '0 20px 40px -10px rgba(0, 0, 0, 0.18)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(99, 102, 241, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative'
        }}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: theme === 'light' ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: theme === 'light' ? '#475569' : '#94a3b8',
            transition: 'all 0.2s'
          }}
        >
          <X size={18} />
        </button>

        {/* LOGO EM ZOOM */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          paddingTop: '8px'
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px'
          }}>
            {/* Glow sutil atrás da logo */}
            <div style={{
              position: 'absolute',
              width: '130px',
              height: '130px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%)',
              filter: 'blur(12px)',
              pointerEvents: 'none'
            }} />

            {/* Logo em Zoom */}
            <div style={{
              padding: '6px',
              borderRadius: '24px',
              background: theme === 'light' 
                ? 'linear-gradient(135deg, #ffffff, #f1f5f9)' 
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02))',
              border: theme === 'light' ? '2px solid #e2e8f0' : '2px solid rgba(99, 102, 241, 0.3)',
              boxShadow: theme === 'light' 
                ? '0 10px 25px rgba(0, 0, 0, 0.08)' 
                : '0 12px 30px rgba(0, 0, 0, 0.4)'
            }}>
              <DriveHoraLogo size={110} option={logoOption} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: theme === 'light' ? '#0f172a' : '#ffffff',
              letterSpacing: '-0.02em',
              margin: 0
            }}>
              DriveHora
            </h3>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '8px'
            }}>
              Oficial
            </span>
          </div>

          <p style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: theme === 'light' ? '#2563eb' : '#818cf8',
            margin: '0 0 12px 0'
          }}>
            Mobilidade Inteligente por Hora
          </p>

          {/* Breve descrição sobre o app */}
          <div style={{
            fontSize: '0.85rem',
            lineHeight: 1.55,
            color: theme === 'light' ? '#334155' : '#cbd5e1',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '14px 16px',
            textAlign: 'left'
          }}>
            O <strong>DriveHora</strong> é uma plataforma moderna de mobilidade urbana baseada em <strong>aluguel com motorista por tempo</strong>. 
            Você tem a liberdade de contratar horas dedicadas para seus compromissos, fazer múltiplas paradas sem acréscimo surpresa e contar com motoristas selecionados com total transparência e tranquilidade.
          </div>
        </div>

        {/* Pilares do Aplicativo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px'
        }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
              <Clock size={16} />
              <strong style={{ fontSize: '0.78rem', color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                Valor por Hora
              </strong>
            </div>
            <span style={{ fontSize: '0.72rem', color: theme === 'light' ? '#475569' : '#94a3b8', lineHeight: 1.35 }}>
              Sem taxas dinâmicas abusivas ou surpresas no final.
            </span>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6' }}>
              <MapPin size={16} />
              <strong style={{ fontSize: '0.78rem', color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                Múltiplas Paradas
              </strong>
            </div>
            <span style={{ fontSize: '0.72rem', color: theme === 'light' ? '#475569' : '#94a3b8', lineHeight: 1.35 }}>
              Vários destinos e espera flexível no mesmo pedido.
            </span>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8b5cf6' }}>
              <ShieldCheck size={16} />
              <strong style={{ fontSize: '0.78rem', color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                Embarque com PIN
              </strong>
            </div>
            <span style={{ fontSize: '0.72rem', color: theme === 'light' ? '#475569' : '#94a3b8', lineHeight: 1.35 }}>
              Validação segura de 4 dígitos antes da partida.
            </span>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '12px',
            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
              <Star size={16} />
              <strong style={{ fontSize: '0.78rem', color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                Favoritos & Notas
              </strong>
            </div>
            <span style={{ fontSize: '0.72rem', color: theme === 'light' ? '#475569' : '#94a3b8', lineHeight: 1.35 }}>
              Priorize condutores de alta pontuação e confiança.
            </span>
          </div>
        </div>

        {/* Informações da Apólice de Seguro Ativa (Lei 13.640/2018) */}
        {insurance && insurance.enabled && insurance.providerName && (
          <div
            style={{
              borderRadius: '14px',
              padding: '14px 16px',
              background: theme === 'light'
                ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                : 'linear-gradient(135deg, rgba(6, 78, 59, 0.35) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: theme === 'light' ? '1px solid #86efac' : '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: theme === 'light'
                ? '0 4px 12px rgba(16, 185, 129, 0.08)'
                : '0 4px 16px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 style={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    margin: 0,
                    color: theme === 'light' ? '#065f46' : '#6ee7b7'
                  }}>
                    Viagem 100% Assegurada
                  </h4>
                  <span style={{
                    fontSize: '0.68rem',
                    color: theme === 'light' ? '#047857' : '#a7f3d0',
                    display: 'block'
                  }}>
                    Seguro APP • Lei Federal nº 13.640/2018
                  </span>
                </div>
              </div>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                background: theme === 'light' ? '#dcfce7' : 'rgba(16, 185, 129, 0.25)',
                color: theme === 'light' ? '#15803d' : '#34d399',
                padding: '3px 8px',
                borderRadius: '6px',
                border: theme === 'light' ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.4)'
              }}>
                Ativo
              </span>
            </div>

            {/* Companhia e Apólice */}
            <div style={{
              background: theme === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.25)',
              borderRadius: '10px',
              padding: '8px 10px',
              border: theme === 'light' ? '1px solid #d1fae5' : '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                <span style={{ color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Seguradora:</span>
                <strong style={{ color: theme === 'light' ? '#0f172a' : '#f8fafc', fontWeight: 700 }}>
                  {insurance.providerName}
                </strong>
              </div>
              {insurance.policyNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                  <span style={{ color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Nº da Apólice:</span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: theme === 'light' ? '#065f46' : '#34d399',
                    fontSize: '0.72rem'
                  }}>
                    {insurance.policyNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Coberturas por Ocupante */}
            <div>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: theme === 'light' ? '#047857' : '#a7f3d0',
                display: 'block',
                marginBottom: '6px'
              }}>
                Cobertura por passageiro e motorista durante a corrida:
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px'
              }}>
                <div style={{
                  background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                  padding: '6px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: theme === 'light' ? '1px solid #d1fae5' : '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ fontSize: '0.62rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Morte Acid.</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                    R$ {(insurance.coverageAmountMA || 100000).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div style={{
                  background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                  padding: '6px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: theme === 'light' ? '1px solid #d1fae5' : '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ fontSize: '0.62rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Invalidez Perm.</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                    R$ {(insurance.coverageAmountIPA || 100000).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div style={{
                  background: theme === 'light' ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                  padding: '6px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: theme === 'light' ? '1px solid #d1fae5' : '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ fontSize: '0.62rem', color: theme === 'light' ? '#64748b' : '#94a3b8' }}>Desp. Médicas</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#f1f5f9' }}>
                    R$ {(insurance.coverageAmountDMHO || 10000).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>

            {/* Suporte 24h da Seguradora */}
            {insurance.emergencyHotline && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.7rem',
                color: theme === 'light' ? '#065f46' : '#6ee7b7',
                paddingTop: '2px'
              }}>
                <PhoneCall size={13} />
                <span>Central de Sinistro 24h: <strong>{insurance.emergencyHotline}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Link para Termos & LGPD */}
        {onOpenTerms && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTerms();
            }}
            className="btn-outline"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={15} />
            <span>Ver Termos de Uso & Privacidade (LGPD)</span>
          </button>
        )}

        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          type="button"
          className="btn-primary"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '0.88rem',
            fontWeight: 700,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Heart size={16} />
          <span>Entendido</span>
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, Award, Shield, Cpu } from 'lucide-react';

interface LogoProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLogo?: (optionId: number) => void;
}

export const LogoProposalsModal: React.FC<LogoProposalsModalProps> = ({
  isOpen,
  onClose,
  onSelectLogo
}) => {
  const [selectedId, setSelectedId] = useState<number>(() => {
    try {
      const dedicated = localStorage.getItem('drivehora_selected_logo_option');
      if (dedicated === '1' || dedicated === '2' || dedicated === '3') return Number(dedicated);
      const raw = localStorage.getItem('drivehora_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.logoOption) return parsed.branding.logoOption;
      }
    } catch {}
    return 2;
  });

  useEffect(() => {
    try {
      const dedicated = localStorage.getItem('drivehora_selected_logo_option');
      if (dedicated === '1' || dedicated === '2' || dedicated === '3') {
        setSelectedId(Number(dedicated));
        return;
      }
      const raw = localStorage.getItem('drivehora_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.logoOption) setSelectedId(parsed.branding.logoOption);
      }
    } catch {}
  }, [isOpen]);

  if (!isOpen) return null;

  const proposals = [
    {
      id: 1,
      title: 'Opção 1: Chrono-Drive Tech',
      tag: 'Futurista & Vibrante',
      icon: Cpu,
      imageSrc: '/branding/logo_option_1.jpg',
      description: 'Monograma "D" aerodinâmico com mostrador de cronógrafo interno e rastro de vento neon.',
      palette: ['#0f172a', '#4f46e5', '#818cf8', '#38bdf8'],
      highlights: 'Alta visibilidade em telas mobile, ideal para perfil tech moderno.'
    },
    {
      id: 2,
      title: 'Opção 2: Infinito & Velocímetro Titânio',
      tag: 'Mais Votada • Luxo & Minimalismo',
      icon: Sparkles,
      imageSrc: '/branding/logo_option_2.jpg',
      description: 'Fusão contínua da letra "D" com o símbolo do infinito (tempo ilimitado) em aço escovado e ponteiro cobalto.',
      palette: ['#0a0d14', '#1e293b', '#3b82f6', '#e2e8f0'],
      highlights: 'Extrema elegância, padrão de montadoras como Porsche e Tesla.'
    },
    {
      id: 3,
      title: 'Opção 3: Shield Asas Executivas',
      tag: 'Chauffeur VIP & Tradicional',
      icon: Shield,
      imageSrc: '/branding/logo_option_3.jpg',
      description: 'Emblema em formato de escudo heráldico com asas em titânio e relógio de alta relojoaria suíça no centro.',
      palette: ['#111827', '#1e3a8a', '#94a3b8', '#ffffff'],
      highlights: 'Transmite máxima solidez, segurança e pontualidade executiva.'
    }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-themed-surface"
        style={{
          borderRadius: '24px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.3)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho com fundo sólido e alto contraste */}
        <div
          className="modal-themed-header"
          style={{
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary, #1e293b)',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                flexShrink: 0
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Propostas de Identidade Visual DriveHora
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Conceitos em alta resolução para o ícone oficial da plataforma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'var(--border-subtle)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Grade com as 3 Propostas */}
        <div
          style={{
            padding: '18px',
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px'
          }}
        >
          {proposals.map(p => {
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  if (onSelectLogo) {
                    onSelectLogo(p.id);
                  }
                }}
                className="modal-themed-card"
                style={{
                  borderRadius: '20px',
                  border: isSelected ? '2px solid #2563eb' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(37, 99, 235, 0.08)' : undefined,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Tag de destaque */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--border-subtle)',
                      color: isSelected ? '#2563eb' : 'var(--text-secondary)'
                    }}
                  >
                    {p.tag}
                  </span>
                  {isSelected && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>
                      <CheckCircle2 size={16} /> Selecionada
                    </span>
                  )}
                </div>

                {/* Imagem em Alta Resolução - Exibida em sua Total Integridade */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#0a0d14',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                    padding: '4px',
                    boxSizing: 'border-box'
                  }}
                >
                  <img
                    src={p.imageSrc}
                    alt={p.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '12px',
                      display: 'block'
                    }}
                  />
                </div>

                {/* Título & Descrição */}
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {p.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {p.description}
                  </p>
                </div>

                {/* Highlights com Contraste Perfeito */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    fontSize: '0.76rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    marginTop: 'auto'
                  }}
                >
                  ✨ {p.highlights}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé de Ação com Fundo Temático */}
        <div
          className="modal-themed-footer"
          style={{
            padding: '14px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: 'var(--bg-secondary, #1e293b)',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Opção selecionada no momento: <strong style={{ color: 'var(--text-primary)' }}>Opção {selectedId}</strong>
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Fechar
            </button>
            <button
              onClick={() => {
                if (onSelectLogo) onSelectLogo(selectedId);
                onClose();
              }}
              style={{
                padding: '7px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)'
              }}
            >
              Confirmar Escolha (Opção {selectedId})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
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
  const [selectedId, setSelectedId] = useState<number>(2);

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
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-color, #111827)',
          color: 'var(--text-primary, #ffffff)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.3)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(99, 102, 241, 0.15), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Propostas de Identidade Visual DriveHora
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', margin: '2px 0 0' }}>
                Conceitos em alta resolução para o ícone oficial da plataforma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Grade com as 3 Propostas */}
        <div
          style={{
            padding: '20px',
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
                onClick={() => setSelectedId(p.id)}
                style={{
                  borderRadius: '20px',
                  background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
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
                      background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                      color: isSelected ? '#60a5fa' : '#cbd5e1'
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

                {/* Imagem em Alta Resolução */}
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
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <img
                    src={p.imageSrc}
                    alt={p.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>

                {/* Título & Descrição */}
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                    {p.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    {p.description}
                  </p>
                </div>

                {/* Highlights */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    fontSize: '0.72rem',
                    color: '#cbd5e1',
                    marginTop: 'auto'
                  }}
                >
                  ✨ {p.highlights}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé de Ação */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.3)'
          }}
        >
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Opção selecionada no momento: <strong>Opção {selectedId}</strong>
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
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
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.35)'
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

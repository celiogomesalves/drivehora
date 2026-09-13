import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, CheckCircle2, Award, Shield, Cpu, UploadCloud, Image as ImageIcon, Trash2 } from 'lucide-react';
import logoOption1 from '../assets/branding/logo_option_1.jpg';
import logoOption2 from '../assets/branding/logo_option_2.jpg';
import logoOption3 from '../assets/branding/logo_option_3.jpg';

export interface LogoProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLogo?: (optionId: 1 | 2 | 3 | 'custom', customLogoUrl?: string) => void;
  currentOption?: 1 | 2 | 3 | 'custom';
  currentCustomLogoUrl?: string;
}

export const LogoProposalsModal: React.FC<LogoProposalsModalProps> = ({
  isOpen,
  onClose,
  onSelectLogo,
  currentOption,
  currentCustomLogoUrl
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<1 | 2 | 3 | 'custom'>(() => {
    if (currentOption) return currentOption;
    try {
      const dedicated = localStorage.getItem('drivehora_selected_logo_option');
      if (dedicated === '1' || dedicated === '2' || dedicated === '3') return Number(dedicated) as 1 | 2 | 3;
      if (dedicated === 'custom') return 'custom';
      const raw = localStorage.getItem('drivehora_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.logoOption) return parsed.branding.logoOption;
      }
    } catch {}
    return 2;
  });

  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => {
    if (currentCustomLogoUrl) return currentCustomLogoUrl;
    try {
      const dedicated = localStorage.getItem('drivehora_custom_logo_url');
      if (dedicated) return dedicated;
      const raw = localStorage.getItem('drivehora_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.customLogoUrl) return parsed.branding.customLogoUrl;
      }
    } catch {}
    return null;
  });

  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const dedicated = localStorage.getItem('drivehora_selected_logo_option');
      if (dedicated === '1' || dedicated === '2' || dedicated === '3') {
        setSelectedId(Number(dedicated) as 1 | 2 | 3);
      } else if (dedicated === 'custom') {
        setSelectedId('custom');
      } else if (currentOption) {
        setSelectedId(currentOption);
      }

      const dedicatedUrl = localStorage.getItem('drivehora_custom_logo_url');
      if (dedicatedUrl) {
        setCustomLogoUrl(dedicatedUrl);
      } else if (currentCustomLogoUrl) {
        setCustomLogoUrl(currentCustomLogoUrl);
      }
    } catch {}
  }, [isOpen, currentOption, currentCustomLogoUrl]);

  if (!isOpen) return null;

  // Processa o upload da imagem, redimensionando se necessário para otimizar armazenamento
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }

    setIsProcessingImage(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setIsProcessingImage(false);
        return;
      }

      // Se for SVG, salva direto
      if (file.type === 'image/svg+xml') {
        setCustomLogoUrl(result);
        setSelectedId('custom');
        try {
          localStorage.setItem('drivehora_custom_logo_url', result);
          localStorage.setItem('drivehora_selected_logo_option', 'custom');
        } catch {}
        if (onSelectLogo) {
          onSelectLogo('custom', result);
        }
        setIsProcessingImage(false);
        return;
      }

      // Para imagens bitmap, otimiza através de um canvas em alta resolução
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 512;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/png', 0.92);
          setCustomLogoUrl(optimizedDataUrl);
          setSelectedId('custom');
          try {
            localStorage.setItem('drivehora_custom_logo_url', optimizedDataUrl);
            localStorage.setItem('drivehora_selected_logo_option', 'custom');
          } catch {}
          if (onSelectLogo) {
            onSelectLogo('custom', optimizedDataUrl);
          }
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setIsProcessingImage(false);
      };
      img.src = result;
    };

    reader.onerror = () => {
      setIsProcessingImage(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomLogoUrl(null);
    try {
      localStorage.removeItem('drivehora_custom_logo_url');
    } catch {}
    // Se estava na custom, volta obrigatoriamente para a Opção 2 como padrão
    if (selectedId === 'custom') {
      setSelectedId(2);
      try {
        localStorage.setItem('drivehora_selected_logo_option', '2');
      } catch {}
      if (onSelectLogo) {
        onSelectLogo(2, undefined);
      }
    }
  };

  const proposals = [
    {
      id: 1 as const,
      title: 'Opção 1: Chrono-Drive Tech',
      tag: 'Futurista & Vibrante',
      icon: Cpu,
      imageSrc: logoOption1,
      description: 'Monograma "D" aerodinâmico com mostrador de cronógrafo interno e rastro de vento neon.',
      palette: ['#0f172a', '#4f46e5', '#818cf8', '#38bdf8'],
      highlights: 'Alta visibilidade em telas mobile, ideal para perfil tech moderno.'
    },
    {
      id: 2 as const,
      title: 'Opção 2: Infinito & Velocímetro Titânio',
      tag: 'Mais Votada • Padrão Oficial',
      icon: Sparkles,
      imageSrc: logoOption2,
      description: 'Fusão contínua da letra "D" com o símbolo do infinito em aço escovado e ponteiro cobalto.',
      palette: ['#0a0d14', '#1e293b', '#3b82f6', '#e2e8f0'],
      highlights: 'Extrema elegância, padrão de montadoras como Porsche e Tesla.'
    },
    {
      id: 3 as const,
      title: 'Opção 3: Shield Asas Executivas',
      tag: 'Chauffeur VIP & Tradicional',
      icon: Shield,
      imageSrc: logoOption3,
      description: 'Emblema em formato de escudo heráldico com asas em titânio e relógio suíço no centro.',
      palette: ['#111827', '#1e3a8a', '#94a3b8', '#ffffff'],
      highlights: 'Transmite máxima solidez, segurança e pontualidade executiva.'
    }
  ];

  const handleConfirmSelection = () => {
    const finalOption = selectedId;
    const finalUrl = finalOption === 'custom' && customLogoUrl ? customLogoUrl : undefined;

    try {
      localStorage.setItem('drivehora_selected_logo_option', String(finalOption));
      if (finalUrl) {
        localStorage.setItem('drivehora_custom_logo_url', finalUrl);
      }
    } catch {}

    if (onSelectLogo) {
      onSelectLogo(finalOption, finalUrl);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
          maxWidth: '960px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.3)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="modal-themed-header"
          style={{
            padding: '18px 24px',
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
                width: '42px',
                height: '42px',
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
                Identidade Visual & Logo da Plataforma
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Selecione uma das 3 propostas oficiais de alta resolução ou faça upload da sua logo personalizada
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

        {/* Grade com as 4 opções (3 Padrão + 1 Personalizada) */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '16px'
          }}
        >
          {/* As 3 Logos Padrão */}
          {proposals.map(p => {
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  if (onSelectLogo) {
                    onSelectLogo(p.id, customLogoUrl || undefined);
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
                      fontSize: '0.68rem',
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
                      <CheckCircle2 size={16} /> Ativa
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
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {p.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {p.description}
                  </p>
                </div>

                {/* Highlights */}
                <div
                  style={{
                    padding: '7px 10px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    fontSize: '0.74rem',
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

          {/* 4ª Opção: Logo Personalizada (Upload) */}
          <div
            onClick={() => {
              if (customLogoUrl) {
                setSelectedId('custom');
                if (onSelectLogo) {
                  onSelectLogo('custom', customLogoUrl);
                }
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="modal-themed-card"
            style={{
              borderRadius: '20px',
              border: selectedId === 'custom' ? '2px solid #10b981' : '1px dashed var(--border-subtle)',
              background: selectedId === 'custom' ? 'rgba(16, 185, 129, 0.08)' : undefined,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              style={{ display: 'none' }}
            />

            {/* Tag de destaque */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '8px',
                  background: selectedId === 'custom' ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)',
                  color: selectedId === 'custom' ? '#10b981' : 'var(--text-secondary)'
                }}
              >
                Personalizada • Upload
              </span>
              {selectedId === 'custom' && customLogoUrl && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>
                  <CheckCircle2 size={16} /> Ativa
                </span>
              )}
            </div>

            {/* Área de Preview da Logo Personalizada ou Dropzone de Upload */}
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
                boxSizing: 'border-box',
                position: 'relative',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt="Logo Personalizada Carregada"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    display: 'block'
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '16px',
                    textAlign: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6'
                    }}
                  >
                    <UploadCloud size={24} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isProcessingImage ? 'Otimizando logo...' : 'Carregar Sua Logo'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    PNG, JPG, SVG ou WebP
                  </span>
                </div>
              )}
            </div>

            {/* Título & Descrição */}
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Logo Personalizada
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {customLogoUrl
                  ? 'Sua logo personalizada está carregada. Ela é aplicada em tempo real para todos os passageiros e motoristas.'
                  : 'Faça upload do arquivo da sua marca corporativa para definir como a logo padrão do sistema.'}
              </p>
            </div>

            {/* Botões de Ação para a Logo Personalizada */}
            <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ImageIcon size={14} />
                <span>{customLogoUrl ? 'Substituir' : 'Selecionar'}</span>
              </button>

              {customLogoUrl && (
                <button
                  type="button"
                  title="Remover logo personalizada"
                  onClick={handleRemoveCustomLogo}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé com Fundo Temático */}
        <div
          className="modal-themed-footer"
          style={{
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: 'var(--bg-secondary, #1e293b)',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Logo ativa selecionada:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {selectedId === 'custom' ? 'Logo Personalizada' : `Opção ${selectedId}`}
            </strong>
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
              onClick={handleConfirmSelection}
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
              Confirmar Escolha ({selectedId === 'custom' ? 'Personalizada' : `Opção ${selectedId}`})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import logoOption1 from '../assets/branding/logo_option_1.jpg';
import logoOption2 from '../assets/branding/logo_option_2.jpg';
import logoOption3 from '../assets/branding/logo_option_3.jpg';

const LOGO_IMAGES: Record<1 | 2 | 3, string> = {
  1: logoOption1,
  2: logoOption2,
  3: logoOption3
};

interface DriveHoraLogoProps {
  size?: number;
  className?: string;
  option?: 1 | 2 | 3;
  style?: React.CSSProperties;
}

/**
 * DriveHoraLogo - Identidade Visual Oficial DriveHora
 * Renderiza o conceito aprovado (Opções 1, 2 ou 3) com importação direta de assets
 * empacotados pelo Vite e sincronização em tempo real imediata.
 */
export const DriveHoraLogo: React.FC<DriveHoraLogoProps> = ({
  size = 38,
  option,
  style,
  className
}) => {
  const [activeOption, setActiveOption] = useState<1 | 2 | 3>(() => {
    if (option && (option === 1 || option === 2 || option === 3)) return option;
    try {
      const dedicated = typeof window !== 'undefined' ? localStorage.getItem('drivehora_selected_logo_option') : null;
      if (dedicated === '1' || dedicated === '2' || dedicated === '3') {
        return Number(dedicated) as 1 | 2 | 3;
      }
      const raw = typeof window !== 'undefined' ? localStorage.getItem('drivehora_system_settings_v1') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.logoOption) return parsed.branding.logoOption;
      }
    } catch {}
    return 2;
  });

  // Reatividade imediata para alterações de prop
  useEffect(() => {
    if (option && (option === 1 || option === 2 || option === 3)) {
      setActiveOption(option);
    }
  }, [option]);

  // Escuta atualizações locais e de outras abas
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      try {
        const dedicated = localStorage.getItem('drivehora_selected_logo_option');
        if (dedicated === '1' || dedicated === '2' || dedicated === '3') {
          setActiveOption(Number(dedicated) as 1 | 2 | 3);
          return;
        }
      } catch {}
      const opt = e.detail?.branding?.logoOption;
      if (opt && (opt === 1 || opt === 2 || opt === 3)) {
        setActiveOption(opt);
      }
    };
    window.addEventListener('drivehora_settings_updated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);
    return () => {
      window.removeEventListener('drivehora_settings_updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
    };
  }, []);

  // Prioridade síncrona: usa a prop se definida, senão o estado ativo
  const currentOption: 1 | 2 | 3 = (option === 1 || option === 2 || option === 3)
    ? option
    : activeOption;

  const currentImageSrc = LOGO_IMAGES[currentOption] || LOGO_IMAGES[2];

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: '#090d16',
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        flexShrink: 0,
        overflow: 'hidden',
        padding: '2px',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <img
        key={`drivehora-logo-img-${currentOption}`}
        src={currentImageSrc}
        alt={`DriveHora Logo Oficial (Opção ${currentOption})`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: Math.max(2, Math.round(size * 0.16)),
          display: 'block'
        }}
      />
    </div>
  );
};

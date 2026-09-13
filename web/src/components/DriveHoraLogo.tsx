import React, { useState, useEffect } from 'react';
import logoOption1 from '../assets/branding/logo_option_1.jpg';
import logoOption2 from '../assets/branding/logo_option_2.jpg';
import logoOption3 from '../assets/branding/logo_option_3.jpg';

export const LOGO_PRESET_IMAGES: Record<1 | 2 | 3, string> = {
  1: logoOption1,
  2: logoOption2,
  3: logoOption3
};

/**
 * Atualiza dinamicamente o favicon e os ícones da aplicação (PWA/Desktop/Mobile)
 * de acordo com a logo oficial selecionada.
 */
export const updateDocumentFaviconAndIcons = (logoUrl: string) => {
  if (typeof document === 'undefined' || !logoUrl) return;

  try {
    const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon'];
    
    iconRels.forEach(rel => {
      let linkElement = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.rel = rel;
        document.head.appendChild(linkElement);
      }
      linkElement.href = logoUrl;
    });
  } catch (err) {
    console.warn('Erro ao atualizar favicon dinâmico:', err);
  }
};

export interface DriveHoraLogoProps {
  size?: number;
  className?: string;
  option?: 1 | 2 | 3 | 'custom';
  customUrl?: string;
  style?: React.CSSProperties;
}

/**
 * DriveHoraLogo - Identidade Visual Oficial DriveHora
 * Renderiza o conceito aprovado (Opções 1, 2, 3 ou Personalizada) com sincronização
 * em tempo real imediata para todos os usuários e atualização do favicon/ícones.
 */
export const DriveHoraLogo: React.FC<DriveHoraLogoProps> = ({
  size = 38,
  option,
  customUrl,
  style,
  className
}) => {
  const [activeOption, setActiveOption] = useState<1 | 2 | 3 | 'custom'>(() => {
    if (option && (option === 1 || option === 2 || option === 3 || option === 'custom')) return option;
    try {
      const dedicated = typeof window !== 'undefined' ? localStorage.getItem('drivehora_selected_logo_option') : null;
      if (dedicated === '1' || dedicated === '2' || dedicated === '3') {
        return Number(dedicated) as 1 | 2 | 3;
      }
      if (dedicated === 'custom') {
        return 'custom';
      }
      const raw = typeof window !== 'undefined' ? localStorage.getItem('drivehora_system_settings_v1') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.logoOption) return parsed.branding.logoOption;
      }
    } catch {}
    return 2;
  });

  const [activeCustomUrl, setActiveCustomUrl] = useState<string | undefined>(() => {
    if (customUrl) return customUrl;
    try {
      const dedicated = typeof window !== 'undefined' ? localStorage.getItem('drivehora_custom_logo_url') : null;
      if (dedicated) return dedicated;
      const raw = typeof window !== 'undefined' ? localStorage.getItem('drivehora_system_settings_v1') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.customLogoUrl) return parsed.branding.customLogoUrl;
      }
    } catch {}
    return undefined;
  });

  // Reatividade imediata para alterações de props
  useEffect(() => {
    if (option && (option === 1 || option === 2 || option === 3 || option === 'custom')) {
      setActiveOption(option);
    }
  }, [option]);

  useEffect(() => {
    if (customUrl) {
      setActiveCustomUrl(customUrl);
    }
  }, [customUrl]);

  // Escuta atualizações locais, de outras abas e canais em tempo real
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      try {
        const dedicated = localStorage.getItem('drivehora_selected_logo_option');
        if (dedicated === '1' || dedicated === '2' || dedicated === '3') {
          setActiveOption(Number(dedicated) as 1 | 2 | 3);
        } else if (dedicated === 'custom') {
          setActiveOption('custom');
        }

        const dedicatedUrl = localStorage.getItem('drivehora_custom_logo_url');
        if (dedicatedUrl) {
          setActiveCustomUrl(dedicatedUrl);
        }
      } catch {}

      const opt = e.detail?.branding?.logoOption;
      if (opt && (opt === 1 || opt === 2 || opt === 3 || opt === 'custom')) {
        setActiveOption(opt);
      }
      const cUrl = e.detail?.branding?.customLogoUrl;
      if (cUrl) {
        setActiveCustomUrl(cUrl);
      }
    };

    window.addEventListener('drivehora_settings_updated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);
    return () => {
      window.removeEventListener('drivehora_settings_updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
    };
  }, []);

  // Determinar a opção corrente (prop tem prioridade direta)
  const currentOption: 1 | 2 | 3 | 'custom' = (option === 1 || option === 2 || option === 3 || option === 'custom')
    ? option
    : activeOption;

  const currentCustomUrl = customUrl || activeCustomUrl;

  // Imagem resolvida: se custom e tem URL, usa a URL; se custom sem URL, faz fallback para Opção 2
  let currentImageSrc = LOGO_PRESET_IMAGES[2];
  if (currentOption === 'custom' && currentCustomUrl) {
    currentImageSrc = currentCustomUrl;
  } else if (currentOption === 1 || currentOption === 2 || currentOption === 3) {
    currentImageSrc = LOGO_PRESET_IMAGES[currentOption];
  }

  // Atualiza o favicon dinâmico do documento com a logo ativa
  useEffect(() => {
    if (currentImageSrc) {
      updateDocumentFaviconAndIcons(currentImageSrc);
    }
  }, [currentImageSrc]);

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
        key={`drivehora-logo-img-${currentOption}-${currentImageSrc.substring(0, 32)}`}
        src={currentImageSrc}
        alt={`DriveHora Logo Oficial (${currentOption === 'custom' ? 'Personalizada' : `Opção ${currentOption}`})`}
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

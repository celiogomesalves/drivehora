import React, { useState, useEffect } from 'react';

interface DriveHoraLogoProps {
  size?: number;
  className?: string;
  option?: 1 | 2 | 3;
  style?: React.CSSProperties;
}

/**
 * DriveHoraLogo - Identidade Visual Moderna e Sofisticada
 * Renderiza o conceito aprovado (Opções 1, 2 ou 3) com sincronização em tempo real
 * quando o Administrador altera as configurações da marca na plataforma.
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

  // Reatividade imediata: sincroniza com a prop option sempre que ela for atualizada
  useEffect(() => {
    if (option && (option === 1 || option === 2 || option === 3)) {
      setActiveOption(option);
    }
  }, [option]);

  // Escuta atualizações de sistema transmitidas em tempo real (ex: troca de logo pelo Admin)
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

  // Prioridade absoluta síncrona: se a prop option estiver definida, usa imediatamente
  const currentOption: 1 | 2 | 3 = (option === 1 || option === 2 || option === 3)
    ? option
    : activeOption;

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
      {/* Imagem de Alta Fidelidade do Conceito Selecionado - Exibida em sua Total Integridade */}
      <img
        key={`drivehora-logo-${currentOption}`}
        src={`/branding/logo_option_${currentOption}.jpg`}
        alt={`DriveHora Logo Oficial (Opção ${currentOption})`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: Math.max(2, Math.round(size * 0.16)),
          display: 'block'
        }}
        onError={(e) => {
          // Se a imagem falhar em carregar, oculta para exibir o SVG interno de fallback
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />

      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', zIndex: 0 }}
      >
        <defs>
          {/* Gradiente do Monograma 'D' + Velocidade */}
          <linearGradient id="dhGradientD" x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#c7d2fe" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>

          {/* Gradiente do Dial Interno de Hora */}
          <linearGradient id="dhDialGradient" x1="18" y1="12" x2="38" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>

          {/* Sombra de Profundidade */}
          <filter id="dhGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#4f46e5" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Trilha Aerodinâmica Traseira (Velocidade & Fluidez) */}
        <path
          d="M6 18C10 18 13 16 16 14"
          stroke="#818cf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />
        <path
          d="M4 24C9 24 13 23 18 21"
          stroke="#a5b4fc"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M7 30C11 30 14 31 17 33"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />

        {/* Monograma Estrutural 'D' Esculpido */}
        <path
          d="M18 10H26C34.2843 10 41 16.268 41 24C41 31.732 34.2843 38 26 38H18V10Z"
          stroke="url(#dhGradientD)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#dhGlow)"
        />

        {/* Mostrador Circular do Cronógrafo de Horas (O 'Hora' da marca) */}
        <circle
          cx="27"
          cy="24"
          r="8"
          stroke="url(#dhDialGradient)"
          strokeWidth="2"
          strokeDasharray="1.5 2"
        />

        {/* Ponteiros do Relógio de Precisão / Vetor de Direção */}
        <path
          d="M27 24L27 19.5"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M27 24L31.5 26.5"
          stroke="#38bdf8"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Centro Pivô de Precisão em Joia / Titânio */}
        <circle cx="27" cy="24" r="1.8" fill="#ffffff" />
      </svg>
    </div>
  );
};

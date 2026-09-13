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
    if (option) return option;
    try {
      const raw = localStorage.getItem('drivehora_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.logoOption) return parsed.branding.logoOption;
      }
    } catch {}
    return 2;
  });

  useEffect(() => {
    if (option) {
      setActiveOption(option);
      return;
    }
    const handleSettingsUpdated = (e: any) => {
      const opt = e.detail?.branding?.logoOption;
      if (opt && (opt === 1 || opt === 2 || opt === 3)) {
        setActiveOption(opt);
      }
    };
    window.addEventListener('drivehora_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('drivehora_settings_updated', handleSettingsUpdated);
  }, [option]);

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
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(135deg, #0a0d14 0%, #1e1b4b 50%, #0f172a 100%)',
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        flexShrink: 0,
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Imagem de Alta Fidelidade do Conceito Selecionado */}
      <img
        src={`/branding/logo_option_${activeOption}.jpg`}
        alt="DriveHora Logo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
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

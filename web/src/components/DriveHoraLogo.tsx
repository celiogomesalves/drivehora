import React from 'react';

interface DriveHoraLogoProps {
  size?: number;
  className?: string;
  variant?: 'emblem' | 'full' | 'minimal';
  style?: React.CSSProperties;
}

/**
 * DriveHoraLogo - Identidade Visual Moderna e Sofisticada
 * Monograma vetorial premium combinando a aerodinâmica da letra 'D' (Drive)
 * com o ponteiro e dial de precisão do cronógrafo (Hora), em acabamento platina & cobalto.
 */
export const DriveHoraLogo: React.FC<DriveHoraLogoProps> = ({
  size = 38,
  style,
  className
}) => {
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        flexShrink: 0,
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Brilho de reflexo dinâmico de alta sofisticação */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-20%',
          width: '70%',
          height: '70%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
          borderRadius: '50%'
        }}
      />

      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative', zIndex: 1 }}
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

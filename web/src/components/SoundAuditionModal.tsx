import React, { useState, useEffect } from 'react';
import { Volume2, Music, Sparkles, X, CheckCircle2, Crown } from 'lucide-react';
import { playNotificationSound, type NotificationSoundType } from '../services/soundAndNotificationService';

interface SoundAuditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onSaveSoundPreset?: (presetId: 'new_ride_a' | 'new_ride_b' | 'new_ride_c') => void;
}

interface SoundOption {
  id: string;
  name: string;
  category: NotificationSoundType;
  description: string;
  targetUser: 'Motorista' | 'Passageiro' | 'Ambos';
  frequencyInfo: string;
  recommendedFor: string;
  playCustom?: () => void;
}

export const SoundAuditionModal: React.FC<SoundAuditionModalProps> = ({
  isOpen,
  onClose,
  isAdmin = false,
  onSaveSoundPreset
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentActivePreset, setCurrentActivePreset] = useState<'new_ride_a' | 'new_ride_b' | 'new_ride_c'>(() => {
    try {
      const raw = localStorage.getItem('drivehora_system_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.branding?.newRideSound) return parsed.branding.newRideSound;
      }
    } catch {}
    return 'new_ride_a';
  });

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      const snd = e.detail?.branding?.newRideSound;
      if (snd) setCurrentActivePreset(snd);
    };
    window.addEventListener('drivehora_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('drivehora_settings_updated', handleSettingsUpdate);
  }, []);

  if (!isOpen) return null;

  // Função para tocar variações sonoras exclusivas
  const playCustomTone = (tones: Array<{ freq: number; start: number; dur: number; wave?: OscillatorType; gain?: number }>, id: string) => {
    setPlayingId(id);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = t.wave || 'sine';
        osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.start);
        gain.gain.setValueAtTime(t.gain || 0.3, ctx.currentTime + t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t.start);
        osc.stop(ctx.currentTime + t.start + t.dur);
      });

      const maxEnd = Math.max(...tones.map(t => t.start + t.dur));
      setTimeout(() => setPlayingId(null), maxEnd * 1000 + 100);
    } catch {
      setPlayingId(null);
    }
  };

  const soundCatalog: SoundOption[] = [
    // 1. Nova Corrida (Motorista)
    {
      id: 'new_ride_a',
      name: 'Option 1: Arpejo Neo-Drive (Padrão Atual)',
      category: 'new_ride',
      targetUser: 'Motorista',
      description: '4 tons rápidos ascendentes em onda triangular com altíssima penetração acústica, despertando o motorista imediatamente mesmo com ruído no trânsito.',
      frequencyInfo: '880Hz → 1175Hz → 1480Hz → 1760Hz (Triângulo)',
      recommendedFor: 'Recomendado para o motorista no trânsito pesado.',
      playCustom: () => playCustomTone([
        { freq: 880, start: 0, dur: 0.15, wave: 'triangle', gain: 0.35 },
        { freq: 1174.66, start: 0.18, dur: 0.22, wave: 'triangle', gain: 0.35 },
        { freq: 1479.98, start: 0.42, dur: 0.3, wave: 'triangle', gain: 0.35 },
        { freq: 1760, start: 0.74, dur: 0.38, wave: 'triangle', gain: 0.4 }
      ], 'new_ride_a')
    },
    {
      id: 'new_ride_b',
      name: 'Option 2: Pulse Luxe (Estilo Chauffeur VIP)',
      category: 'new_ride',
      targetUser: 'Motorista',
      description: 'Acorde duplo aveludado e sofisticado com ressonância limpa, transmitindo exclusividade sem ser agressivo aos ouvidos.',
      frequencyInfo: '587Hz (Ré5) + 880Hz (Lá5) com eco aveludado',
      recommendedFor: 'Ideal para um posicionamento de luxo e discrição.',
      playCustom: () => playCustomTone([
        { freq: 587.33, start: 0, dur: 0.3, wave: 'sine', gain: 0.35 },
        { freq: 880, start: 0.15, dur: 0.45, wave: 'sine', gain: 0.35 },
        { freq: 1174.66, start: 0.35, dur: 0.5, wave: 'sine', gain: 0.3 }
      ], 'new_ride_b')
    },
    {
      id: 'new_ride_c',
      name: 'Option 3: Bell Alert (Carrilhão Moderno)',
      category: 'new_ride',
      targetUser: 'Motorista',
      description: 'Toque de dois carrilhões de alta frequência estilo notificação premium do iOS, nítido e inconfundível.',
      frequencyInfo: '1046Hz (Dó6) → 1568Hz (Sol6)',
      recommendedFor: 'Máxima clareza e familiaridade instantânea.',
      playCustom: () => playCustomTone([
        { freq: 1046.5, start: 0, dur: 0.2, wave: 'sine', gain: 0.4 },
        { freq: 1567.98, start: 0.22, dur: 0.6, wave: 'sine', gain: 0.35 }
      ], 'new_ride_c')
    },

    // 2. Corrida Aceita (Passageiro)
    {
      id: 'accepted_a',
      name: 'Corrida Aceita: Chime Harmônico de Boas-Vindas',
      category: 'accepted',
      targetUser: 'Passageiro',
      description: 'Acorde maior ascendente suave que gera sensação imediata de alívio e confirmação positiva de que o motorista está a caminho.',
      frequencyInfo: 'C5 (523Hz) → E5 (659Hz) → G5 (784Hz) → C6 (1046Hz)',
      recommendedFor: 'Experiência acolhedora e confiável do passageiro.',
      playCustom: () => playNotificationSound('accepted')
    },

    // 3. Viagem Iniciada
    {
      id: 'in_progress_a',
      name: 'Partida Iniciada: Soft Ignition',
      category: 'in_progress',
      targetUser: 'Ambos',
      description: 'Transição suave de 2 tons com elevação sonora indicando o início da movimentação do veículo.',
      frequencyInfo: '880Hz → 1174Hz (Sine suave)',
      recommendedFor: 'Sinal sonoro discreto de viagem em andamento.',
      playCustom: () => playNotificationSound('in_progress')
    },

    // 4. Viagem Concluída
    {
      id: 'finished_a',
      name: 'Destino Concluído: Acorde Triunfal',
      category: 'finished',
      targetUser: 'Ambos',
      description: 'Acorde de quatro notas em harmonia maior (Sol Maior), marcando a chegada ao destino com excelência.',
      frequencyInfo: 'Sol4 (392Hz) → Si4 (494Hz) → Ré5 (587Hz) → Sol5 (784Hz)',
      recommendedFor: 'Encerramento memorável da experiência de viagem.',
      playCustom: () => playNotificationSound('finished')
    },

    // 5. Alerta de Tempo (Franquia de Horas)
    {
      id: 'time_alert',
      name: 'Aviso de Franquia: Alerta de 15 Minutos Restantes',
      category: 'alert',
      targetUser: 'Ambos',
      description: 'Toque duplo equilibrado que avisa gentilmente passageiro e motorista quando a franquia contratada está prestes a terminar.',
      frequencyInfo: '600Hz → 900Hz (Bip duplo elegante)',
      recommendedFor: 'Alerta da funcionalidade diferencial de cobrança por hora.',
      playCustom: () => playNotificationSound('alert')
    }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
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
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal com Contraste Perfeito e Fundo Sólido */}
        <div
          className="modal-themed-header"
          style={{
            padding: '18px 20px',
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
                background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                flexShrink: 0
              }}
            >
              <Music size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Identidade Acústica DriveHora
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Degustação dos toques e assinaturas sonoras exclusivas da marca
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

        {/* Banner Informativo com Alto Contraste */}
        <div
          style={{
            padding: '11px 18px',
            background: 'rgba(99, 102, 241, 0.08)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            color: 'var(--text-primary)'
          }}
        >
          <Sparkles size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
          <span>
            Clique no botão <strong>Ouvir</strong> de cada item para escutar as frequências harmônicas em tempo real.
          </span>
        </div>

        {/* Lista de Sons com Cards Responsivos para Celular */}
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {soundCatalog.map(sound => {
            const isPlaying = playingId === sound.id;
            const isPresetActive = sound.id === currentActivePreset;

            return (
              <div
                key={sound.id}
                className="modal-themed-card"
                style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-card, #1e293b)',
                  border: isPlaying ? '1px solid var(--primary)' : isPresetActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {/* Linha 1: Título e Badge de Destinatário */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', lineHeight: 1.4, flex: '1 1 200px' }}>
                    {sound.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '3px 8px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      background: sound.targetUser === 'Motorista' ? 'rgba(245, 158, 11, 0.15)' : sound.targetUser === 'Passageiro' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: sound.targetUser === 'Motorista' ? '#d97706' : sound.targetUser === 'Passageiro' ? '#2563eb' : '#059669'
                    }}
                  >
                    {sound.targetUser}
                  </span>
                </div>

                {/* Linha 2: Descrição com Leitura Clara e sem Quebras Artificiais */}
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, wordBreak: 'normal', width: '100%' }}>
                  {sound.description}
                </p>

                {/* Linha 3: Notas de Frequência */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem' }}>
                  <code style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}>
                    {sound.frequencyInfo}
                  </code>
                </div>

                {/* Linha 4: Botões de Ação Perfeitamente Alinhados e Responsivos */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {sound.id.startsWith('new_ride') && (
                      isPresetActive ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#059669',
                            background: 'rgba(16, 185, 129, 0.12)',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <CheckCircle2 size={15} />
                          Padrão Ativo
                        </span>
                      ) : isAdmin ? (
                        <button
                          onClick={() => {
                            if (onSaveSoundPreset) {
                              onSaveSoundPreset(sound.id as any);
                              setCurrentActivePreset(sound.id as any);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#b45309',
                            background: 'rgba(245, 158, 11, 0.12)',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            cursor: 'pointer'
                          }}
                        >
                          <Crown size={14} />
                          Definir Padrão
                        </button>
                      ) : null
                    )}
                  </div>

                  <button
                    onClick={() => sound.playCustom ? sound.playCustom() : playNotificationSound(sound.category)}
                    style={{
                      padding: '7px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isPlaying ? '#10b981' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                      transition: 'all 0.15s ease',
                      marginLeft: 'auto'
                    }}
                  >
                    <Volume2 size={16} style={{ animation: isPlaying ? 'pulse 0.8s infinite' : 'none' }} />
                    <span>{isPlaying ? 'Tocando...' : 'Ouvir'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com Instrução e Fechar com Fundo Temático */}
        <div
          className="modal-themed-footer"
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: 'var(--bg-secondary, #1e293b)',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            O som selecionado se aplica a toda a plataforma.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--border-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

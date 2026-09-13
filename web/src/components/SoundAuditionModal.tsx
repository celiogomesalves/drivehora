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
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-color, #1e293b)',
          color: 'var(--text-primary, #ffffff)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(99, 102, 241, 0.1), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              <Music size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Identidade Acústica DriveHora
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', margin: '2px 0 0' }}>
                Degustação dos toques e assinaturas sonoras exclusivas da marca
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

        {/* Banner Informativo */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(99, 102, 241, 0.08)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            color: '#a5b4fc'
          }}
        >
          <Sparkles size={16} style={{ flexShrink: 0 }} />
          <span>
            Clique no botão <strong>Ouvir</strong> de cada item para escutar as frequências harmônicas geradas em tempo real.
          </span>
        </div>

        {/* Lista de Sons Disponíveis */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {soundCatalog.map(sound => {
            const isPlaying = playingId === sound.id;
            return (
              <div
                key={sound.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: isPlaying ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card, rgba(255, 255, 255, 0.04))',
                  border: isPlaying ? '1px solid #818cf8' : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isPlaying ? '#a5b4fc' : 'var(--text-primary)' }}>
                      {sound.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: sound.targetUser === 'Motorista' ? 'rgba(245, 158, 11, 0.2)' : sound.targetUser === 'Passageiro' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: sound.targetUser === 'Motorista' ? '#f59e0b' : sound.targetUser === 'Passageiro' ? '#60a5fa' : '#34d399'
                      }}
                    >
                      {sound.targetUser}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 6px' }}>
                    {sound.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                    <code>{sound.frequencyInfo}</code>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {sound.id.startsWith('new_ride') && (
                    sound.id === currentActivePreset ? (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.15)',
                          padding: '5px 10px',
                          borderRadius: '10px',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <CheckCircle2 size={14} />
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#f59e0b',
                          background: 'rgba(245, 158, 11, 0.12)',
                          padding: '5px 10px',
                          borderRadius: '10px',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          cursor: 'pointer'
                        }}
                      >
                        <Crown size={13} />
                        Definir Padrão
                      </button>
                    ) : null
                  )}

                  <button
                    onClick={() => sound.playCustom ? sound.playCustom() : playNotificationSound(sound.category)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isPlaying ? '#10b981' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Volume2 size={15} style={{ animation: isPlaying ? 'pulse 0.8s infinite' : 'none' }} />
                    <span>{isPlaying ? 'Tocando...' : 'Ouvir'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com Instrução e Fechar */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            background: 'var(--surface-color, #1e293b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Após definir suas preferências, fixaremos as opções escolhidas como padrão do sistema.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary, #ffffff)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

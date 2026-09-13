import React, { useState, useEffect } from 'react';
import { 
  Car, Phone, MessageSquare, Share2, AlertTriangle, 
  Send, ShieldAlert, PlusCircle, Check, X
} from 'lucide-react';
import type { DbRide } from '../services/dbService';
import type { DriverProfile } from '../types/auth';
import { formatCurrency } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';

interface ActiveRidePanelProps {
  ride: DbRide;
  role: 'client' | 'driver';
  theme: 'dark' | 'light';
  driverInfo?: DriverProfile | null;
  onCancelRide?: (rideId: string) => void;
  onStartRideWithPin?: (rideId: string, enteredPin: string) => Promise<{ success: boolean; message?: string }>;
  onExtendRide?: (rideId: string, hoursToAdd: number) => Promise<void>;
  onSendMessage?: (rideId: string, text: string) => Promise<void>;
  onCallSupport?: () => void;
  canCancelFree?: boolean;
  cancelCountdownFormatted?: string;
}

export const ActiveRidePanel: React.FC<ActiveRidePanelProps> = ({
  ride,
  role,
  theme,
  driverInfo,
  onCancelRide,
  onStartRideWithPin,
  onExtendRide,
  onSendMessage,
  onCallSupport,
  canCancelFree = false,
  cancelCountdownFormatted = '05:00'
}) => {
  // Controle de expansão do Bottom Sheet / Drawer
  const [sheetState, setSheetState] = useState<'collapsed' | 'standard' | 'expanded'>('standard');
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Atualizador do relógio a cada segundo durante a corrida
  useEffect(() => {
    if (ride.status === 'in_progress') {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [ride.status]);

  // Cálculos de Tempo e Horas Contratadas
  const totalHoursContracted = (ride.hours || 1) + (ride.extendedHours || 0);
  const totalDurationMs = totalHoursContracted * 3600 * 1000;
  const startedAt = ride.startedAt || ride.acceptedAt || ride.createdAt || now;
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
  
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const displayElapsedMins = elapsedMinutes % 60;
  const displayElapsedSecs = Math.floor((elapsedMs % 60000) / 1000);

  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const displayRemainingMins = remainingMinutes % 60;

  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
  const isExpiringSoon = remainingMinutes <= 15 && remainingMinutes > 0;
  const isOvertime = remainingMs <= 0;

  // PIN de segurança de 4 dígitos (garante valor padrão se não existir)
  const pinCode = ride.pinCode || '2846';

  // Mensagens pré-definidas de 1 toque
  const clientQuickReplies = [
    'Estou no local de embarque',
    'Já estou descendo!',
    'Estou na portaria do prédio',
    'Aguardando na calçada'
  ];

  const driverQuickReplies = [
    'Estou a caminho do embarque',
    'Chego em cerca de 2 minutos',
    'Cheguei no ponto de encontro!',
    'Trânsito lento na região'
  ];

  const quickReplies = role === 'client' ? clientQuickReplies : driverQuickReplies;

  // Compartilhamento via WhatsApp
  const handleShareTrip = () => {
    const text = encodeURIComponent(
      `🚗 *Acompanhe minha corrida no DriveHora!*\n\n` +
      `👤 *Motorista:* ${ride.driverName || 'Motorista Parceiro'}\n` +
      (driverInfo?.vehiclePlate ? `🚙 *Veículo:* ${driverInfo.vehicleBrand || ''} ${driverInfo.vehicleModel || ''} (Placa ${driverInfo.vehiclePlate})\n` : '') +
      `⏱️ *Pacote:* ${totalHoursContracted}h de serviço\n` +
      `📍 *Partida:* ${ride.origin}\n` +
      `🏁 *Destino:* ${ride.destination}\n` +
      `🔒 *Status:* ${ride.status === 'in_progress' ? 'Em andamento' : 'A caminho do embarque'}\n\n` +
      `DriveHora • Transporte por Hora com Transparência e Segurança.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Copiar código PIN
  const handleCopyPin = () => {
    try {
      triggerHaptic('light');
      navigator.clipboard.writeText(pinCode);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  // Enviar mensagem de chat
  const handleSendChat = async (textToSend?: string) => {
    const text = (textToSend || chatInputText).trim();
    if (!text || !onSendMessage) return;
    triggerHaptic('light');
    await onSendMessage(ride.id, text);
    setChatInputText('');
  };

  // Validação do PIN pelo motorista
  const handleVerifyPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin.trim().length !== 4) {
      triggerHaptic('warning');
      setPinError('Digite o PIN de 4 dígitos fornecido pelo passageiro.');
      return;
    }
    setPinError('');
    setIsVerifyingPin(true);
    try {
      if (onStartRideWithPin) {
        const res = await onStartRideWithPin(ride.id, inputPin.trim());
        if (!res.success) {
          triggerHaptic('error');
          setPinError(res.message || 'Código PIN incorreto. Verifique com o passageiro.');
        } else {
          triggerHaptic('success');
        }
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Estender tempo
  const handleConfirmExtend = async (hours: number) => {
    if (onExtendRide) {
      triggerHaptic('success');
      await onExtendRide(ride.id, hours);
      setShowExtendModal(false);
    }
  };

  // Cores dinâmicas de acordo com o tema
  const isLight = theme === 'light';
  const cardBg = isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.95)';
  const borderCol = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.12)';
  const textTitle = isLight ? '#0f172a' : '#ffffff';
  const textSub = isLight ? '#64748b' : '#94a3b8';

  return (
    <div className="active-ride-bottom-sheet" style={{
      background: cardBg,
      border: `1px solid ${borderCol}`,
      borderRadius: '24px 24px 18px 18px',
      boxShadow: isLight ? '0 10px 35px -5px rgba(0, 0, 0, 0.1)' : '0 15px 40px -5px rgba(0, 0, 0, 0.5)',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      width: '100%',
      position: 'relative'
    }}>
      {/* Barra de Progresso Superior com Cor Dinâmica */}
      <div style={{
        height: '5px',
        width: '100%',
        background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
        position: 'relative'
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: isOvertime 
            ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
            : isExpiringSoon 
            ? 'linear-gradient(90deg, #f59e0b, #d97706)' 
            : 'linear-gradient(90deg, #6366f1, #10b981)',
          transition: 'width 0.8s ease'
        }} />
      </div>

      {/* Puxador / Drag Handle (Padrão Uber / Lyft) */}
      <div 
        onClick={() => setSheetState(prev => prev === 'expanded' ? 'standard' : 'expanded')}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px 0 4px 0',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        title="Alternar tamanho do painel"
      >
        <div style={{
          width: '40px',
          height: '5px',
          borderRadius: '4px',
          background: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.25)',
          transition: 'background 0.2s ease'
        }} />
      </div>

      <div style={{ padding: '16px 20px 22px 20px' }}>
        {/* Cabeçalho Principal: Status da Corrida + Botão SOS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: ride.status === 'in_progress' ? '#10b981' : '#f59e0b',
                display: 'inline-block',
                boxShadow: ride.status === 'in_progress' ? '0 0 10px #10b981' : '0 0 10px #f59e0b'
              }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: textSub }}>
                {ride.status === 'to_pickup' && 'Motorista a Caminho'}
                {ride.status === 'arrived_at_pickup' && 'No Local de Embarque'}
                {ride.status === 'in_progress' && 'Corrida em Andamento'}
                {ride.status === 'accepted' && 'Confirmada • Aguardando Saída'}
              </span>
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 900, color: textTitle }}>
              {ride.status === 'in_progress' ? (
                <>Viagem Ativa • {totalHoursContracted}h Contratadas</>
              ) : (
                <>{ride.driverName || 'Motorista Parceiro'}</>
              )}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Botão de Segurança SOS */}
            <button
              type="button"
              onClick={() => setShowSosModal(true)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Central de Segurança & SOS"
            >
              <ShieldAlert size={18} />
            </button>

            {/* Botão Compartilhar Viagem */}
            <button
              type="button"
              onClick={handleShareTrip}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: `1px solid ${borderCol}`,
                background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.06)',
                color: isLight ? '#334155' : '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Compartilhar status no WhatsApp"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        {/* Bloco 1: Temporizador Visual de Horas (Destaque Principal durante 'in_progress') */}
        {ride.status === 'in_progress' && (
          <div style={{
            background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.8)',
            border: isOvertime 
              ? '1.5px solid #ef4444' 
              : isExpiringSoon 
              ? '1.5px solid #f59e0b' 
              : `1px solid ${borderCol}`,
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: textSub, fontWeight: 700, textTransform: 'uppercase' }}>
                  Tempo Decorrido
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: textTitle, fontFamily: 'monospace' }}>
                  {String(elapsedHours).padStart(2, '0')}:{String(displayElapsedMins).padStart(2, '0')}:{String(displayElapsedSecs).padStart(2, '0')}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: textSub, fontWeight: 700, textTransform: 'uppercase' }}>
                  {isOvertime ? 'Tempo Excedido' : 'Tempo Restante'}
                </span>
                <div style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: 900, 
                  color: isOvertime ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#10b981',
                  fontFamily: 'monospace' 
                }}>
                  {isOvertime ? '+' : ''}{String(remainingHours).padStart(2, '0')}h {String(displayRemainingMins).padStart(2, '0')}m
                </div>
              </div>
            </div>

            {/* Aviso de Término Próximo ou Excedido */}
            {isExpiringSoon && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '0.78rem',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '10px'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} />
                  Seu pacote de horas está quase acabando ({remainingMinutes} min restantes)!
                </span>
                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Estender
                </button>
              </div>
            )}

            {isOvertime && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '0.78rem',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '10px'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} />
                  Franquia encerrada. Horas adicionais serão calculadas no final.
                </span>
                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Regularizar
                </button>
              </div>
            )}

            {/* Ação Rápida de Extensão de Horas */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleConfirmExtend(1)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: `1px solid ${borderCol}`,
                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                  color: textTitle,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <PlusCircle size={15} color="#6366f1" />
                <span>+ 1 Hora ({formatCurrency(ride.hourlyRate)})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExtendModal(true)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${borderCol}`,
                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                  color: textSub,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Opções...
              </button>
            </div>
          </div>
        )}

        {/* Bloco 2: Identificação do Veículo & Motorista + Código PIN de Embarque */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px',
          marginBottom: '16px'
        }}>
          {/* Card do Veículo com Placa Mercosul de Alto Destaque */}
          <div style={{
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${borderCol}`,
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Car size={22} />
              </div>

              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: textTitle }}>
                  {driverInfo?.vehicleBrand || 'Veículo'} {driverInfo?.vehicleModel || 'Cadastrado'}
                </div>
                <div style={{ fontSize: '0.78rem', color: textSub, marginTop: '2px' }}>
                  {driverInfo?.vehicleColor ? `Cor ${driverInfo.vehicleColor}` : 'Parceiro Verificado'} • {driverInfo?.vehicleYear || ''}
                </div>
              </div>
            </div>

            {/* Placa Mercosul Estilizada */}
            {driverInfo?.vehiclePlate && (
              <div style={{
                border: '2px solid #0f172a',
                borderRadius: '6px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                minWidth: '94px',
                textAlign: 'center'
              }}>
                <div style={{
                  background: '#003399',
                  color: '#ffffff',
                  fontSize: '0.52rem',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  padding: '1px 4px'
                }}>
                  BRASIL
                </div>
                <div style={{
                  color: '#000000',
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  padding: '2px 6px',
                  fontFamily: 'monospace'
                }}>
                  {driverInfo.vehiclePlate.toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Código PIN de Segurança (Padrão Uber) */}
          {(ride.status === 'accepted' || ride.status === 'to_pickup' || ride.status === 'arrived_at_pickup') && (
            role === 'client' ? (
              <div style={{
                background: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.08)',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🔒 PIN de Segurança para Embarque
                  </span>
                  <div style={{ fontSize: '0.78rem', color: textSub, marginTop: '2px' }}>
                    Diga este código ao motorista antes de subir no carro:
                  </div>
                </div>

                <div 
                  onClick={handleCopyPin}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontSize: '1.3rem',
                    fontWeight: 900,
                    letterSpacing: '0.2em',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)'
                  }}
                  title="Clique para copiar"
                >
                  <span>{pinCode}</span>
                  {copiedLink && <Check size={16} />}
                </div>
              </div>
            ) : (
              /* Visão do Motorista: Campo para validar o PIN */
              <form onSubmit={handleVerifyPinSubmit} style={{
                background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${borderCol}`,
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>
                    🔑 Validação do PIN do Passageiro
                  </span>
                  <div style={{ fontSize: '0.74rem', color: textSub }}>
                    Peça os 4 dígitos ao passageiro para iniciar:
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    maxLength={4}
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    style={{
                      width: '74px',
                      padding: '6px 8px',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      borderRadius: '8px',
                      border: pinError ? '1px solid #ef4444' : `1px solid ${borderCol}`,
                      background: isLight ? '#ffffff' : 'rgba(0,0,0,0.3)',
                      color: textTitle
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isVerifyingPin || inputPin.length !== 4}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: inputPin.length === 4 ? 'pointer' : 'not-allowed',
                      opacity: inputPin.length === 4 ? 1 : 0.6
                    }}
                  >
                    OK
                  </button>
                </div>
              </form>
            )
          )}
        </div>

        {/* Mensagem de Erro de PIN se houver */}
        {pinError && (
          <div style={{
            fontSize: '0.76rem',
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.1)',
            padding: '6px 12px',
            borderRadius: '8px',
            marginBottom: '12px'
          }}>
            ⚠️ {pinError}
          </div>
        )}

        {/* Detalhes de Endereço Expandidos (Colapsáveis) */}
        {sheetState === 'expanded' && (
          <div style={{
            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${borderCol}`,
            borderRadius: '16px',
            padding: '14px',
            marginBottom: '16px'
          }}>
            {/* Ponto de Partida */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', marginTop: '4px', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.7rem', color: textSub, textTransform: 'uppercase' }}>Ponto de Partida</span>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: textTitle }}>{ride.origin}</div>
              </div>
            </div>

            {/* Paradas Intermediárias */}
            {ride.stops && ride.stops.length > 0 && ride.stops.map((stop, sIdx) => (
              <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', marginLeft: '1px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1.5px solid #f59e0b',
                  color: '#f59e0b',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '2px',
                  flexShrink: 0
                }}>
                  {sIdx + 1}
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 700 }}>
                    Parada Intermediária {sIdx + 1}
                  </span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: textTitle }}>{stop}</div>
                </div>
              </div>
            ))}

            {/* Destino Principal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981', marginTop: '4px', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.7rem', color: textSub, textTransform: 'uppercase' }}>Destino Principal</span>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: textTitle }}>{ride.destination}</div>
              </div>
            </div>
          </div>
        )}

        {/* Thumb Zone: Botões de Ação na Parte Inferior */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Botão de Chat Rápido */}
          <button
            type="button"
            onClick={() => setShowChatDrawer(true)}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '14px',
              border: `1px solid ${borderCol}`,
              background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
              color: textTitle,
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <MessageSquare size={18} color="#6366f1" />
            <span>Chat Rápido</span>
            {ride.chatMessages && ride.chatMessages.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#6366f1',
                color: '#fff',
                fontSize: '0.68rem',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 900
              }}>
                {ride.chatMessages.length}
              </span>
            )}
          </button>

          {/* Botão de Ligação / WhatsApp */}
          {driverInfo?.phone && (
            <a
              href={`tel:${driverInfo.phone}`}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                border: `1px solid ${borderCol}`,
                background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                flexShrink: 0
              }}
              title={`Ligar para ${driverInfo.phone}`}
            >
              <Phone size={18} />
            </a>
          )}

          {/* Botão de Cancelamento com Countdown se aplicável */}
          {onCancelRide && ride.status !== 'in_progress' && ride.status !== 'finished' && (
            <button
              type="button"
              onClick={() => onCancelRide(ride.id)}
              style={{
                flex: 1.2,
                padding: '14px',
                borderRadius: '14px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <span>{canCancelFree ? `Cancelar (${cancelCountdownFormatted})` : 'Cancelar Corrida'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Drawer Modal de Chat Rápido (1 Toque) */}
      {showChatDrawer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Header do Chat */}
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${borderCol}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageSquare size={20} color="#6366f1" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: textTitle }}>
                    Mensagens Rápidas
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: textSub }}>
                    {role === 'client' ? `Com ${ride.driverName || 'o Motorista'}` : `Com ${ride.clientName || 'o Passageiro'}`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChatDrawer(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: textSub,
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Histórico de Mensagens */}
            <div style={{
              flex: 1,
              padding: '16px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              minHeight: '160px'
            }}>
              {(!ride.chatMessages || ride.chatMessages.length === 0) ? (
                <div style={{ textAlign: 'center', color: textSub, fontSize: '0.82rem', margin: 'auto 0' }}>
                  Envie uma mensagem rápida com apenas 1 toque abaixo.
                </div>
              ) : (
                ride.chatMessages.map(msg => {
                  const isMe = msg.sender === role;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        background: isMe ? '#6366f1' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'),
                        color: isMe ? '#ffffff' : textTitle,
                        padding: '10px 14px',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        maxWidth: '82%',
                        fontSize: '0.86rem',
                        lineHeight: 1.4
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', opacity: 0.8, marginBottom: '2px', fontWeight: 600 }}>
                        {msg.senderName}
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sugestões de Mensagens de 1 Toque */}
            <div style={{
              padding: '10px 20px',
              borderTop: `1px solid ${borderCol}`,
              background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              {quickReplies.map((reply, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(reply)}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${borderCol}`,
                    borderRadius: '20px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: textTitle,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  ⚡ {reply}
                </button>
              ))}
            </div>

            {/* Input para Digitação Manual */}
            <div style={{
              padding: '12px 20px',
              borderTop: `1px solid ${borderCol}`,
              display: 'flex',
              gap: '10px'
            }}>
              <input
                type="text"
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                placeholder="Digite sua mensagem..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${borderCol}`,
                  background: isLight ? '#ffffff' : 'rgba(0,0,0,0.3)',
                  color: textTitle,
                  fontSize: '0.88rem'
                }}
              />
              <button
                type="button"
                onClick={() => handleSendChat()}
                disabled={!chatInputText.trim()}
                style={{
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  cursor: chatInputText.trim() ? 'pointer' : 'not-allowed',
                  opacity: chatInputText.trim() ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Extensão de Horas */}
      {showExtendModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 800, color: textTitle }}>
              Estender Pacote de Horas
            </h3>
            <p style={{ fontSize: '0.85rem', color: textSub, margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Precisa de mais tempo com o motorista? Selecione a quantidade de horas para estender seu atendimento com valor fixo e sem taxa de cancelamento.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => handleConfirmExtend(0.5)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${borderCol}`,
                  background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                  color: textTitle,
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <div style={{ fontSize: '1.1rem', color: '#6366f1' }}>+30 minutos</div>
                <div style={{ fontSize: '0.78rem', color: textSub, marginTop: '4px' }}>
                  {formatCurrency(ride.hourlyRate * 0.5)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmExtend(1)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1.5px solid #6366f1',
                  background: isLight ? '#f0fdf4' : 'rgba(99,102,241,0.1)',
                  color: textTitle,
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <div style={{ fontSize: '1.1rem', color: '#10b981' }}>+1 hora</div>
                <div style={{ fontSize: '0.78rem', color: textSub, marginTop: '4px' }}>
                  {formatCurrency(ride.hourlyRate)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmExtend(2)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${borderCol}`,
                  background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                  color: textTitle,
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <div style={{ fontSize: '1.1rem', color: '#6366f1' }}>+2 horas</div>
                <div style={{ fontSize: '0.78rem', color: textSub, marginTop: '4px' }}>
                  {formatCurrency(ride.hourlyRate * 2)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmExtend(3)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${borderCol}`,
                  background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                  color: textTitle,
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <div style={{ fontSize: '1.1rem', color: '#6366f1' }}>+3 horas</div>
                <div style={{ fontSize: '0.78rem', color: textSub, marginTop: '4px' }}>
                  {formatCurrency(ride.hourlyRate * 3)}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExtendModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)',
                color: textSub,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Segurança / SOS */}
      {showSosModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: cardBg,
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}>
              <ShieldAlert size={28} />
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
              Central de Segurança & Ajuda
            </h3>
            <p style={{ fontSize: '0.85rem', color: textSub, margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Sua segurança é prioridade absoluta no DriveHora. Utilize as opções de discagem rápida abaixo:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <a
                href="tel:190"
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#ef4444',
                  color: '#fff',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Phone size={18} />
                <span>Ligar para a Polícia (190)</span>
              </a>

              <a
                href="tel:192"
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                  color: textTitle,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Phone size={16} />
                <span>Ligar para o SAMU (192)</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setShowSosModal(false);
                  if (onCallSupport) onCallSupport();
                }}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: `1px solid ${borderCol}`,
                  background: 'transparent',
                  color: textTitle,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Suporte DriveHora no WhatsApp
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSosModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: textSub,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

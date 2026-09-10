import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, Car, DollarSign, Package, AlertCircle, CheckCircle2, UserX, MapPin, Users } from 'lucide-react';
import type { UserProfile } from '../types/auth';
import { dbCreateRideReport, type RideReport, type DbRide } from '../services/dbService';

interface ReportIssueModalProps {
  ride: DbRide;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reporterRole?: 'client' | 'driver';
}

// Categorias exclusivas para quando o PASSAGEIRO relata um problema
const CLIENT_ISSUE_CATEGORIES = [
  {
    id: 'lost_item',
    label: 'Esqueci um objeto no veículo',
    desc: 'Celular, carteira, documentos, chaves ou outros pertences esquecidos no carro.',
    icon: Package,
    color: '#38bdf8'
  },
  {
    id: 'safety',
    label: 'Segurança ou Direção Imprudente',
    desc: 'Excesso de velocidade, celular ao volante, manobras arriscadas ou desrespeito ao trânsito.',
    icon: ShieldAlert,
    color: '#ef4444'
  },
  {
    id: 'driver_behavior',
    label: 'Conduta ou Comportamento Inadequado',
    desc: 'Falta de cordialidade, grosseria, conduta inapropriada ou atitude desrespeitosa.',
    icon: UserX,
    color: '#f59e0b'
  },
  {
    id: 'vehicle_condition',
    label: 'Problema com o Veículo ou Comodidades',
    desc: 'Veículo/placa diferente do aplicativo, falta de limpeza, ar-condicionado ou acessibilidade recusada.',
    icon: Car,
    color: '#a855f7'
  },
  {
    id: 'route_billing',
    label: 'Divergência de Horas ou Cobrança',
    desc: 'Cobrança indevida, discordância sobre o tempo contratado ou rota divergente.',
    icon: DollarSign,
    color: '#10b981'
  },
  {
    id: 'cancellation_issue',
    label: 'Motorista não compareceu ou cancelamento indevido',
    desc: 'Motorista não compareceu ao ponto de partida ou solicitou cancelamento indevido.',
    icon: AlertCircle,
    color: '#ec4899'
  },
  {
    id: 'client_other',
    label: 'Outro Problema',
    desc: 'Qualquer outra situação não listada acima que demande intervenção da moderação.',
    icon: AlertTriangle,
    color: '#94a3b8'
  }
] as const;

// Categorias exclusivas para quando o MOTORISTA relata um problema
const DRIVER_ISSUE_CATEGORIES = [
  {
    id: 'passenger_no_show',
    label: 'Passageiro não compareceu (No-Show)',
    desc: 'Aguardei no ponto de embarque após o tempo regulamentar e o passageiro não compareceu nem atendeu.',
    icon: UserX,
    color: '#ef4444'
  },
  {
    id: 'passenger_misconduct',
    label: 'Conduta ou Agressividade do Passageiro',
    desc: 'Desrespeito verbal, agressividade, desacato ou passageiro alterado/embriagado.',
    icon: ShieldAlert,
    color: '#f59e0b'
  },
  {
    id: 'vehicle_damage_dirt',
    label: 'Sujeira ou Dano ao Veículo',
    desc: 'Passageiro derramou alimentos/bebidas, sujou o estofamento ou causou dano físico ao carro.',
    icon: Car,
    color: '#ec4899'
  },
  {
    id: 'item_found_in_car',
    label: 'Encontrei um objeto esquecido no carro',
    desc: 'Localizei um celular, bolsa, carteira ou documento deixado para trás e desejo registrar a devolução.',
    icon: Package,
    color: '#38bdf8'
  },
  {
    id: 'payment_fraud',
    label: 'Problema no Pagamento / Recusa de Pagar',
    desc: 'Passageiro se recusou a pagar o valor em dinheiro, exigiu desconto indevido ou tentou fraude.',
    icon: DollarSign,
    color: '#10b981'
  },
  {
    id: 'excess_passengers_luggage',
    label: 'Excesso de Passageiros ou Bagagem Imprópria',
    desc: 'Tentativa de embarcar mais pessoas que a lotação legal ou bagagens perigosas/incompatíveis.',
    icon: Users,
    color: '#a855f7'
  },
  {
    id: 'dangerous_area_route',
    label: 'Local de Embarque/Destino em Área de Risco',
    desc: 'Ponto final em local inacessível, intransitável ou com risco grave à integridade física do condutor.',
    icon: MapPin,
    color: '#f97316'
  },
  {
    id: 'driver_other',
    label: 'Outra Ocorrência Operacional',
    desc: 'Qualquer outro incidente durante a prestação do serviço que necessite de suporte.',
    icon: AlertTriangle,
    color: '#94a3b8'
  }
] as const;

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  ride,
  currentUser,
  isOpen,
  onClose,
  onSuccess,
  reporterRole
}) => {
  const isDriver = reporterRole 
    ? reporterRole === 'driver' 
    : (currentUser.role === 'driver' || ride.driverId === currentUser.id);

  const categories = isDriver ? DRIVER_ISSUE_CATEGORIES : CLIENT_ISSUE_CATEGORIES;
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0].id);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentCategoryObj = categories.find(c => c.id === selectedCategory) || categories[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      const report: RideReport = {
        id: `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        rideId: ride.id,
        reporterId: currentUser.id,
        reporterName: currentUser.fullName || (isDriver ? 'Motorista Parceiro' : 'Passageiro'),
        reporterRole: isDriver ? 'driver' : 'client',
        reporterPhone: currentUser.phone,
        reporterEmail: currentUser.email,
        driverId: ride.driverId,
        driverName: ride.driverName || 'Motorista Parceiro',
        driverVehicle: (ride as any).vehicleModel || (ride as any).driverVehicle,
        driverPlate: (ride as any).driverPlate,
        category: selectedCategory as any,
        categoryLabel: currentCategoryObj.label,
        description: description.trim(),
        status: 'pending',
        createdAt: Date.now()
      };

      const res = await dbCreateRideReport(report);
      if (res.success) {
        setSubmittedSuccess(true);
        setTimeout(() => {
          setSubmittedSuccess(false);
          onSuccess();
          onClose();
        }, 2200);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '540px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '24px',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#ef4444" />
              <span>{isDriver ? 'Reportar Ocorrência (Motorista)' : 'Reportar Problema com a Corrida'}</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Corrida #{ride.id.slice(-6).toUpperCase()} • {isDriver ? (
                <>Passageiro: <strong>{ride.clientName || 'Passageiro'}</strong></>
              ) : (
                <>Motorista: <strong>{ride.driverName || 'Parceiro'}</strong></>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {submittedSuccess ? (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <CheckCircle2 size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Relato Enviado com Sucesso!</h4>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '8px', lineHeight: 1.5 }}>
              Nossa equipe de moderação e suporte já recebeu os dados desta ocorrência e analisará o caso com prioridade.
            </p>
            <div style={{
              marginTop: '16px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.78rem',
              color: '#6ee7b7'
            }}>
              Protocolo registrado no Painel de Moderação.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                {isDriver ? 'Qual ocorrência deseja registrar?' : 'Qual foi o problema ocorrido?'}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categories.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: `${cat.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Icon size={18} color={cat.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#fff' : '#cbd5e1' }}>
                          {cat.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                          {cat.desc}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="issueCategory"
                        checked={isSelected}
                        onChange={() => setSelectedCategory(cat.id)}
                        style={{ accentColor: '#6366f1' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                Descreva detalhadamente o ocorrido:
              </label>
              <textarea
                rows={4}
                required
                placeholder={isDriver
                  ? "Ex: Aguardei no ponto de embarque por 15 minutos e o passageiro não apareceu... ou O passageiro sujou o banco de trás..."
                  : "Ex: Esqueci uma mochila preta no banco de trás contendo meus documentos... ou Descreva a atitude inadequada do motorista..."}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.74rem',
              color: '#fca5a5',
              lineHeight: 1.4
            }}>
              🛡️ <strong>Atenção:</strong> Seu relato será encaminhado com prioridade para a central de moderação. O administrador analisará os dados da corrida e tomará as medidas cabíveis.
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-outline"
                style={{ padding: '10px 16px', fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim()}
                className="btn-primary"
                style={{
                  padding: '10px 22px',
                  fontSize: '0.85rem',
                  background: '#ef4444',
                  borderColor: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSubmitting ? 'Enviando Relato...' : 'Enviar Relato'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

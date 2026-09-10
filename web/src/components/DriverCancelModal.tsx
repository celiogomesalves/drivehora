import { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import type { DbRide } from '../services/dbService';

interface DriverCancelModalProps {
  ride: DbRide;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (reason: string) => Promise<void>;
}

const PREDEFINED_REASONS = [
  'Problema mecânico ou elétrico no veículo',
  'Pneu furado no trajeto',
  'Imprevisto urgente de saúde ou emergência pessoal',
  'Trânsito totalmente bloqueado ou acidente na via',
  'Ponto de embarque inacessível ou área de risco',
  'Outro motivo'
];

export function DriverCancelModal({
  ride,
  isOpen,
  onClose,
  onConfirmCancel
}: DriverCancelModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(PREDEFINED_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const willRefundCredit = ride.paymentMethod !== 'cash' && (ride.paymentStatus === 'paid' || ride.paymentMethod === 'pix' || ride.paymentMethod === 'credit_card');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalReason = selectedReason === 'Outro motivo' ? customReason.trim() : selectedReason;
    if (!finalReason || finalReason.length < 5) {
      setErrorMsg('Por favor, informe uma justificativa válida para o cancelamento.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmCancel(finalReason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao processar cancelamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel animate-modal-alert"
        style={{
          width: '100%',
          maxWidth: '500px',
          background: 'linear-gradient(145deg, #111827 0%, #1e1b4b 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '24px',
          padding: '26px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Cancelar Atendimento
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
                Justificativa obrigatória para o passageiro
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Informação sobre o Passageiro e Estorno de Crédito */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '0.82rem',
            lineHeight: 1.4
          }}
        >
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: '4px' }}>
            Passageiro: {ride.clientName || 'Cliente'} • Corrida #{ride.id.slice(-6)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Destino: {ride.destination}
          </div>
          {willRefundCredit ? (
            <div style={{ marginTop: '8px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} />
              <span>O valor de {formatCurrency(ride.total)} será estornado automaticamente como crédito para o passageiro.</span>
            </div>
          ) : (
            <div style={{ marginTop: '8px', color: '#cbd5e1' }}>
              Pagamento em dinheiro presencial: nenhum estorno digital é necessário.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Selecione o motivo do cancelamento:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PREDEFINED_REASONS.map(r => (
                <label
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: selectedReason === r ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${selectedReason === r ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    color: selectedReason === r ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="cancel_reason"
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                    style={{ accentColor: '#ef4444' }}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Outro motivo' && (
            <div>
              <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Descreva o motivo detalhado:
              </label>
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Informe o motivo para que o passageiro e a administração fiquem cientes..."
                rows={3}
                className="input-base"
                style={{ width: '100%', fontSize: '0.85rem', padding: '10px', resize: 'none' }}
                autoFocus
              />
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                fontSize: '0.78rem'
              }}
            >
              <ShieldAlert size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-outline"
              style={{ flex: 1, padding: '11px', fontSize: '0.85rem' }}
            >
              Voltar / Manter Corrida
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                flex: 1.2,
                padding: '11px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: '#ef4444',
                borderColor: '#ef4444'
              }}
            >
              {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

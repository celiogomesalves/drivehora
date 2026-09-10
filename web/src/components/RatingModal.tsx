import { useState } from 'react';
import { Star, ShieldAlert, CheckCircle2, MessageSquare } from 'lucide-react';
import { dbSubmitRating, type DbRide } from '../services/dbService';

interface RatingModalProps {
  ride: DbRide;
  currentUserRole: 'client' | 'driver';
  currentUserId: string;
  onRatingCompleted: () => void;
}

export function RatingModal({
  ride,
  currentUserRole,
  currentUserId,
  onRatingCompleted
}: RatingModalProps) {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isClient = currentUserRole === 'client';
  const targetUserName = isClient
    ? (ride.driverName || 'Motorista Parceiro')
    : (ride.clientName || 'Passageiro');

  const targetUserId = isClient ? (ride.driverId || '') : (ride.clientId || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Para notas 1, 2 ou 3 estrelas, a justificativa/comentário é obrigatória
    if (score <= 3 && comment.trim().length < 5) {
      setErrorMessage('Para notas até 3 estrelas, por favor escreva uma breve justificativa para nossa equipe de qualidade.');
      return;
    }

    setIsSubmitting(true);
    try {
      await dbSubmitRating({
        id: 'rating_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        rideId: ride.id,
        fromUserId: currentUserId,
        toUserId: targetUserId,
        score,
        comment: comment.trim(),
        createdAt: Date.now()
      });
      onRatingCompleted();
    } catch (err: any) {
      console.warn('Erro ao registrar avaliação:', err);
      // Mesmo se houver inconsistência de conexão, avança para não travar o usuário
      onRatingCompleted();
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
        background: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(12px)',
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
          maxWidth: '460px',
          background: 'linear-gradient(145deg, #0b1120 0%, #171d33 100%)',
          border: '1.5px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.25)',
          position: 'relative'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(99, 102, 241, 0.25))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              color: '#f59e0b'
            }}
          >
            <Star size={32} fill="#f59e0b" />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            {isClient ? 'Avalie seu Motorista' : 'Avalie seu Passageiro'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
            Sua opinião é <strong>obrigatória e essencial</strong> para mantermos a qualidade e segurança da plataforma DriveHora.
          </p>
          <div
            style={{
              display: 'inline-block',
              marginTop: '8px',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.05)',
              fontSize: '0.8rem',
              color: '#a5b4fc',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {isClient ? '🚗 Motorista: ' : '👤 Passageiro: '} <strong>{targetUserName}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Seletor de Estrelas Interativo */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '6px 0' }}>
            {[1, 2, 3, 4, 5].map(star => {
              const active = (hoverScore || score) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setScore(star)}
                  onMouseEnter={() => setHoverScore(star)}
                  onMouseLeave={() => setHoverScore(0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                >
                  <Star
                    size={38}
                    fill={active ? '#f59e0b' : 'none'}
                    color={active ? '#f59e0b' : 'rgba(255, 255, 255, 0.25)'}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                </button>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
            {score === 5 && <span style={{ color: '#10b981' }}>⭐ Excelente! Superou as expectativas</span>}
            {score === 4 && <span style={{ color: '#38bdf8' }}>⭐ Muito bom! Atendimento de qualidade</span>}
            {score === 3 && <span style={{ color: '#f59e0b' }}>⭐ Regular (Justificativa obrigatória)</span>}
            {score === 2 && <span style={{ color: '#fb923c' }}>⭐ Ruim (Justificativa obrigatória)</span>}
            {score === 1 && <span style={{ color: '#ef4444' }}>⭐ Péssimo (A equipe avaliará o caso)</span>}
          </div>

          {/* Campo de Comentário */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}
            >
              <MessageSquare size={14} />
              <span>
                {score <= 3 ? 'Motivo / O que aconteceu? (Obrigatório)' : 'Comentário ou elogio (Opcional)'}
              </span>
            </label>
            <textarea
              value={comment}
              onChange={e => {
                setComment(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={
                score <= 3
                  ? 'Descreva o que ocorreu para que nossa equipe tome providências...'
                  : 'Deixe um comentário sobre a corrida ou educação do parceiro...'
              }
              rows={3}
              className="input-base"
              style={{
                width: '100%',
                resize: 'none',
                fontSize: '0.85rem',
                padding: '10px 12px',
                borderRadius: '12px',
                borderColor: score <= 3 && !comment.trim() ? '#f59e0b' : undefined
              }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '0.78rem'
              }}
            >
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '0.95rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{isSubmitting ? 'Registrando Avaliação...' : 'Confirmar e Enviar Avaliação'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import type { UserRole, UserProfile } from '../types/auth';
import { Users, Car, LogIn, Mail, Lock, User, Phone } from 'lucide-react';
import { formatPhone } from '../utils/formatters';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('client');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mockUser: UserProfile = {
      id: 'user_' + (isSignUp ? 'new_' : '') + Math.random().toString(36).substring(2, 7),
      email: email || (selectedRole === 'client' ? 'cliente@drivehora.com' : 'motorista@drivehora.com'),
      fullName: fullName || (selectedRole === 'client' ? 'Passageiro DriveHora' : 'Motorista Parceiro'),
      role: selectedRole,
      phone: phone || '(11) 98765-4321',
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('drivehora_current_user', JSON.stringify(mockUser));
    onLoginSuccess(mockUser);
    onClose();
  };

  const handleQuickDemo = (role: UserRole) => {
    const demoUser: UserProfile = {
      id: role === 'client' ? 'client_demo_123' : 'driver_demo_456',
      email: role === 'client' ? 'passageiro@drivehora.com' : 'motorista.vip@drivehora.com',
      fullName: role === 'client' ? 'Carlos Eduardo (Passageiro)' : 'Roberto Silva (Motorista)',
      role: role,
      phone: '(11) 99123-4567',
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('drivehora_current_user', JSON.stringify(demoUser));
    onLoginSuccess(demoUser);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 150,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '32px', position: 'relative' }}>
        
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            background: 'var(--primary-gradient)',
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)'
          }}>
            <Car size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Acesse o DriveHora</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Selecione como deseja utilizar a plataforma
          </p>
        </div>

        {/* Seletor de Perfil */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '6px',
          borderRadius: '16px',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => setSelectedRole('client')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem',
              background: selectedRole === 'client' ? 'var(--primary-gradient)' : 'transparent',
              color: selectedRole === 'client' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Users size={18} />
            <span>Passageiro</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole('driver')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem',
              background: selectedRole === 'driver' ? 'var(--secondary-gradient)' : 'transparent',
              color: selectedRole === 'driver' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Car size={18} />
            <span>Motorista</span>
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSignUp && (
            <>
              <div className="input-group">
                <label>Nome Completo</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="custom-input"
                    style={{ paddingLeft: '38px' }}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Celular / WhatsApp</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                  <input
                    type="tel"
                    className="custom-input"
                    style={{ paddingLeft: '38px' }}
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="input-group">
            <label>E-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="custom-input"
                style={{ paddingLeft: '38px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Senha</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="custom-input"
                style={{ paddingLeft: '38px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className={selectedRole === 'driver' ? 'btn-success' : 'btn-primary'}
            style={{ width: '100%', padding: '14px', marginTop: '6px' }}
          >
            <LogIn size={18} />
            <span>{isSignUp ? 'Criar Conta' : 'Entrar no Sistema'}</span>
          </button>
        </form>

        {/* Alternar entre Login e Cadastro */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {isSignUp ? 'Já tem uma conta? Clique para entrar' : 'Ainda não tem conta? Cadastre-se aqui'}
          </button>
        </div>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ou teste rápido</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {/* Botões de Acesso Rápido para Testes */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleQuickDemo('client')}
            className="btn-outline"
            style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
          >
            Passageiro Demo
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo('driver')}
            className="btn-outline"
            style={{ flex: 1, fontSize: '0.8rem', padding: '10px' }}
          >
            Motorista Demo
          </button>
        </div>
      </div>
    </div>
  );
};

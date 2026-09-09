import React, { useState } from 'react';
import type { UserRole, UserProfile } from '../types/auth';
import { isSuperAdminEmail } from '../types/auth';
import { 
  Users, Car, LogIn, Mail, Lock, User, Phone, ShieldCheck, 
  Sparkles, Clock, DollarSign, LogOut, X, ShieldAlert 
} from 'lucide-react';
import { formatPhone } from '../utils/formatters';
import { 
  dbSaveProfile, dbFindProfileByEmail, generateUserIdFromEmail, 
  dbForceDisconnectOtherSessions, dbUpdateUserSession 
} from '../services/dbService';
import { getDeviceName, getLocalSessionToken, setLocalSessionToken, generateSessionToken } from '../utils/sessionHelper';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('client');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Estado para detecção de sessão concorrente em outro aparelho
  const [concurrentSessionData, setConcurrentSessionData] = useState<{
    user: UserProfile;
    existingDevice: string;
  } | null>(null);

  const completeLogin = async (user: UserProfile, sessionToken: string, deviceName: string) => {
    user.activeSessionToken = sessionToken;
    user.activeDeviceName = deviceName;
    user.lastActiveAt = new Date().toISOString();

    setLocalSessionToken(sessionToken);
    localStorage.setItem('drivehora_current_user', JSON.stringify(user));
    setIsLoading(false);
    onLoginSuccess(user);

    // Salva no banco de dados em segundo plano com timeout para não atrasar a renderização da interface
    try {
      await Promise.allSettled([
        dbSaveProfile(user),
        dbUpdateUserSession(user.id, sessionToken, deviceName)
      ]);
    } catch (e) {
      console.warn('Erro ao sincronizar sessão com o banco:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase() || (selectedRole === 'client' ? 'passageiro@drivehora.com' : 'motorista@drivehora.com');
    const isAdmin = isSuperAdminEmail(cleanEmail);

    // 🔍 Buscar se o usuário já possui cadastro prévio no banco
    const existingProfile = await dbFindProfileByEmail(cleanEmail);
    const userId = existingProfile?.id || generateUserIdFromEmail(cleanEmail);
    const localToken = getLocalSessionToken();
    const deviceName = getDeviceName();

    const user: UserProfile = {
      id: userId,
      email: cleanEmail,
      fullName: (fullName.trim() || existingProfile?.fullName) || (isAdmin ? 'Administrador DriveHora' : selectedRole === 'client' ? 'Passageiro DriveHora' : 'Motorista Parceiro'),
      role: isAdmin ? 'admin' : selectedRole,
      phone: (phone.trim() ? formatPhone(phone) : existingProfile?.phone) || '',
      isAdmin: isAdmin,
      createdAt: existingProfile?.createdAt || new Date().toISOString()
    };

    // 🛡️ VERIFICAÇÃO DE SESSÃO ÚNICA (Single Device Session):
    // Se o perfil já tiver uma sessão ativa registrada diferente deste aparelho:
    if (
      existingProfile?.activeSessionToken && 
      existingProfile.activeSessionToken !== localToken &&
      !isSignUp
    ) {
      setIsLoading(false);
      setConcurrentSessionData({
        user,
        existingDevice: existingProfile.activeDeviceName || 'Outro Dispositivo'
      });
      return;
    }

    // Se for novo cadastro ou mesmo aparelho, segue o login direto
    await completeLogin(user, localToken, deviceName);
  };

  // Forçar desconexão do outro aparelho e assumir acesso neste dispositivo
  const handleConfirmDisconnectAndLogin = async () => {
    if (!concurrentSessionData) return;
    setIsLoading(true);

    const newToken = generateSessionToken();
    const deviceName = getDeviceName();

    await dbForceDisconnectOtherSessions(
      concurrentSessionData.user.id, 
      newToken, 
      deviceName, 
      concurrentSessionData.user.role
    );

    const sessionUser = concurrentSessionData.user;
    setConcurrentSessionData(null);
    await completeLogin(sessionUser, newToken, deviceName);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top Navbar Limpa (Sem opções administrativas públicas) */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'var(--primary-gradient)',
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
          }}>
            <Car size={26} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>DriveHora</span>
              <span style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}>Oficial</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Motorista particular sob demanda por hora</p>
          </div>
        </div>
      </header>

      {/* Container Central com Grid */}
      <main style={{
        maxWidth: '1100px',
        margin: '30px auto',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '40px',
        alignItems: 'center',
        zIndex: 10
      }}>
        
        {/* Lado Esquerdo: Apresentação e Benefícios */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: 'rgba(99, 102, 241, 0.15)',
            borderRadius: '20px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#818cf8',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: '18px'
          }}>
            <Sparkles size={16} />
            <span>A Revolução do Transporte por Hora</span>
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '16px', letterSpacing: '-0.03em' }}>
            Contrate motoristas pelo tempo que precisar.
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px' }}>
            Diferente dos aplicativos convencionais cobrados por km, no <strong>DriveHora</strong> você contrata por bloco de horas (1h a 24h) com preço transparente e atendimento exclusivo.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '10px', color: '#10b981' }}>
                <Clock size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Tempo exclusivo dedicado a você</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>O motorista aguarda suas reuniões, compras ou eventos sem cobranças extras.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '8px', borderRadius: '10px', color: '#818cf8' }}>
                <DollarSign size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Repasse justo ao motorista (85%)</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Apenas 15% de taxa da plataforma, garantindo motoristas mais qualificados.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '8px', borderRadius: '10px', color: '#f59e0b' }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Validação documental rigorosa</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Checagem de CNH com EAR, CRLV do veículo e biometria facial antifraude.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Card de Login e Cadastro */}
        <div className="glass-panel" style={{ padding: '36px', boxShadow: 'var(--shadow-lg)' }}>
          
          {/* Seletor de Perfil */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '6px',
            borderRadius: '16px',
            marginBottom: '24px',
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
              <span>Sou Passageiro</span>
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
              <span>Sou Motorista</span>
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              {isSignUp ? `Cadastro de ${selectedRole === 'client' ? 'Passageiro' : 'Motorista Parceiro'}` : `Entrar como ${selectedRole === 'client' ? 'Passageiro' : 'Motorista'}`}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isSignUp ? 'Preencha seus dados para começar' : 'Informe suas credenciais para acessar sua conta'}
            </p>
          </div>

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
                      placeholder="(00) 00000-0000"
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
              disabled={isLoading}
              className={selectedRole === 'driver' ? 'btn-success' : 'btn-primary'}
              style={{ width: '100%', padding: '14px', marginTop: '6px', fontSize: '1rem' }}
            >
              <LogIn size={18} />
              <span>{isSignUp ? 'Criar Conta' : 'Entrar no Sistema'}</span>
            </button>
          </form>

          {/* Alternar Cadastro / Login */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {isSignUp ? 'Já tem uma conta? Clique aqui para entrar' : 'Ainda não tem conta? Cadastre-se gratuitamente'}
            </button>
          </div>
        </div>

      </main>

      {/* MODAL DE SESSÃO ATIVA EM OUTRO DISPOSITIVO */}
      {concurrentSessionData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '32px 24px',
            borderRadius: '24px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <ShieldAlert size={34} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                Sessão Ativa em Outro Dispositivo
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                Esta conta já está conectada em <strong style={{ color: '#f59e0b' }}>{concurrentSessionData.existingDevice}</strong>.
              </p>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              textAlign: 'left',
              lineHeight: 1.5
            }}>
              🔒 <strong>Regra de Segurança:</strong> Para evitar o compartilhamento de contas e garantir a segurança das viagens, o DriveHora permite apenas <strong>1 dispositivo conectado por vez</strong>.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleConfirmDisconnectAndLogin}
                disabled={isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000'
                }}
              >
                <LogOut size={16} />
                <span>Desconectar Outro Aparelho e Entrar Aqui</span>
              </button>

              <button
                type="button"
                onClick={() => setConcurrentSessionData(null)}
                disabled={isLoading}
                className="btn-outline"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '0.85rem',
                  justifyContent: 'center'
                }}
              >
                <X size={15} />
                <span>Cancelar e Manter no Outro Aparelho</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        © 2026 DriveHora — Plataforma de Motoristas Particulares por Hora. Banco de Dados com Suporte a Realtime.
      </footer>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Car, Clock, DollarSign, Navigation, ShieldCheck, 
  Smartphone, Users, RefreshCw, CheckCircle2, 
  Radio, Award, PlayCircle, Sparkles, Compass, Database, 
  X, Check, LogOut, MapPin, Crown, AlertTriangle, UserCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { getSupabase, getSupabaseCredentials, saveSupabaseCredentials, initGlobalSupabaseConfig } from './supabase';
import type { UserProfile, ClientProfile, DriverProfile } from './types/auth';
import { isSuperAdminEmail } from './types/auth';
import { LoginPage } from './components/LoginPage';
import { ClientOnboarding } from './components/ClientOnboarding';
import { DriverOnboarding } from './components/DriverOnboarding';
import { AdminDashboard } from './components/AdminDashboard';
import { getCurrentPosition, reverseGeocode, searchAddressPlaces } from './services/gpsService';
import { formatCurrency } from './utils/formatters';
import { 
  dbGetClientProfile, dbGetDriverProfile, 
  dbCreateRide, dbUpdateRide, type DbRide 
} from './services/dbService';

export function App() {
  const [activeTab, setActiveTab] = useState<'client' | 'driver' | 'admin' | 'dual' | 'mobile'>('client');
  const [rides, setRides] = useState<DbRide[]>([]);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  // Autenticação & Sessão
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('drivehora_current_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (isSuperAdminEmail(parsed.email)) parsed.isAdmin = true;
    return parsed;
  });

  // Perfis Onboarding
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [showDriverProfileEdit, setShowDriverProfileEdit] = useState(false);

  // Supabase state & modal
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseCredentials());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState(supabaseConfig.url);
  const [inputSupabaseKey, setInputSupabaseKey] = useState(supabaseConfig.key);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  // Formulário do cliente & Busca Automática de Endereços
  const [origin, setOrigin] = useState('Av. Paulista, 1000 - Bela Vista');
  const [destination, setDestination] = useState('Aeroporto de Guarulhos (GRU) - Terminal 3');
  const [originSuggestions, setOriginSuggestions] = useState<string[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<string[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [hours, setHours] = useState(3);
  const [hourlyRate, setHourlyRate] = useState(60);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  // Motorista
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [driverEarnings, setDriverEarnings] = useState(0);

  // Informações de rede local
  const localNetworkUrl = `http://192.168.18.71:5173`;

  const isUserAdmin = Boolean(currentUser?.isAdmin || isSuperAdminEmail(currentUser?.email));

  // Cálculos financeiros
  const totalAmount = hours * hourlyRate;
  const platformFee = Number((totalAmount * 0.15).toFixed(2));
  const driverNet = Number((totalAmount * 0.85).toFixed(2));

  // Carregar perfis do banco sempre que o usuário mudar
  useEffect(() => {
    const loadUserProfiles = async () => {
      if (!currentUser) return;
      if (currentUser.role === 'client') {
        const cp = await dbGetClientProfile(currentUser.id);
        setClientProfile(cp);
        setActiveTab('client');
      } else {
        const dp = await dbGetDriverProfile(currentUser.id);
        setDriverProfile(dp);
        if (isUserAdmin) {
          setActiveTab('admin');
        } else {
          setActiveTab('driver');
        }
      }
    };
    loadUserProfiles();
  }, [currentUser]);

  // Verificar conexão Supabase
  const checkSupabaseConnection = async () => {
    const sb = getSupabase();
    if (!sb) {
      setSupabaseConnected(false);
      return;
    }
    try {
      const { error } = await sb.from('rides').select('id').limit(1);
      setSupabaseConnected(!error);
    } catch {
      setSupabaseConnected(false);
    }
  };

  // Buscar corridas (do Supabase ou do Backend/Memória)
  const fetchRides = async () => {
    const sb = getSupabase();
    if (sb && supabaseConnected) {
      try {
        const { data, error } = await sb.from('rides').select('*').order('created_at', { ascending: false }).limit(50);
        if (!error && data) {
          const formatted: DbRide[] = data.map((d: any) => ({
            id: d.id,
            clientId: d.client_id,
            clientName: d.client_name,
            driverId: d.driver_id,
            driverName: d.driver_name,
            origin: d.origin,
            destination: d.destination,
            hours: Number(d.hours),
            hourlyRate: Number(d.hourly_rate),
            total: Number(d.total),
            commission: Number(d.commission),
            driverNet: Number(d.driver_net),
            status: d.status,
            createdAt: new Date(d.created_at).getTime(),
            acceptedAt: d.accepted_at ? new Date(d.accepted_at).getTime() : undefined,
            startedAt: d.started_at ? new Date(d.started_at).getTime() : undefined,
            finishedAt: d.finished_at ? new Date(d.finished_at).getTime() : undefined
          }));
          setRides(formatted);
          const finished = formatted.filter(r => r.status === 'finished');
          const sum = finished.reduce((acc, cur) => acc + (cur.driverNet || 0), 0);
          setDriverEarnings(sum);
          return;
        }
      } catch (e) {
        console.warn('Fallback para API local:', e);
      }
    }

    // Fallback: API Node.js / memória
    try {
      const res = await fetch('/api/rides');
      if (res.ok) {
        const data = await res.json();
        setRides(data);
        const finished = data.filter((r: DbRide) => r.status === 'finished');
        const sum = finished.reduce((acc: number, cur: DbRide) => acc + (cur.driverNet || 0), 0);
        setDriverEarnings(sum);
      }
    } catch (e) {
      console.warn("Erro ao buscar corridas:", e);
    }
  };

  // Capturar Localização GPS em tempo real
  const handleGetGpsLocation = async () => {
    setIsLocatingGPS(true);
    try {
      const coords = await getCurrentPosition();
      const address = await reverseGeocode(coords);
      setOrigin(address);
    } catch (error) {
      console.warn('Erro ao obter GPS:', error);
      alert('Não foi possível obter sua localização GPS. Verifique a permissão do navegador.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Inicializar e configurar Realtime do Supabase
  useEffect(() => {
    const bootstrap = async () => {
      await initGlobalSupabaseConfig();
      const updated = getSupabaseCredentials();
      setSupabaseConfig(updated);
      setInputSupabaseUrl(updated.url);
      setInputSupabaseKey(updated.key);
      await checkSupabaseConnection();
      fetchRides();
    };
    bootstrap();

    const sb = getSupabase();
    let channel: any = null;

    if (sb) {
      channel = sb
        .channel('public:rides')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
          fetchRides();
        })
        .subscribe();
    }

    const interval = setInterval(() => {
      fetchRides();
    }, 3000);

    return () => {
      clearInterval(interval);
      if (channel && sb) sb.removeChannel(channel);
    };
  }, [supabaseConnected]);

  // Salvar credenciais Supabase globalmente para todos os usuários
  const handleSaveConfig = async () => {
    await saveSupabaseCredentials(inputSupabaseUrl, inputSupabaseKey);
    const updated = getSupabaseCredentials();
    setSupabaseConfig(updated);
    setShowConfigModal(false);
    await checkSupabaseConnection();
    fetchRides();
  };

  // Logout do Usuário -> Volta imediatamente para a Página de Login
  const handleLogout = () => {
    localStorage.removeItem('drivehora_current_user');
    setCurrentUser(null);
    setClientProfile(null);
    setDriverProfile(null);
  };

  // Solicitar corrida como cliente
  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;

    setIsRequesting(true);
    const rideId = 'ride_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const clientId = currentUser?.id || ('client_' + Math.random().toString(36).substring(2, 6));

    const newRide: DbRide = {
      id: rideId,
      clientId,
      clientName: currentUser?.fullName || 'Passageiro',
      origin,
      destination,
      hours,
      hourlyRate,
      total: totalAmount,
      commission: platformFee,
      driverNet: driverNet,
      status: 'searching',
      createdAt: Date.now()
    };

    await dbCreateRide(newRide);
    setCurrentRideId(rideId);
    await fetchRides();
    setIsRequesting(false);
  };

  // Ações do Motorista
  const handleAcceptRide = async (rideId: string) => {
    const driverId = currentUser?.id || 'driver_demo_01';
    const driverName = currentUser?.fullName || 'Motorista Parceiro';
    await dbUpdateRide(rideId, {
      driverId,
      driverName,
      status: 'accepted',
      acceptedAt: Date.now()
    });
    fetchRides();
  };

  const handleStartRide = async (rideId: string) => {
    await dbUpdateRide(rideId, {
      status: 'in_progress',
      startedAt: Date.now()
    });
    fetchRides();
  };

  const handleFinishRide = async (rideId: string) => {
    await dbUpdateRide(rideId, {
      status: 'finished',
      finishedAt: Date.now()
    });
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    fetchRides();
  };

  // Alternar modo online do motorista com validação
  const handleToggleDriverOnline = () => {
    if (!isDriverOnline) {
      // Para ficar ONLINE e receber chamados, o cadastro deve estar validado
      const isApproved = driverProfile?.verificationStatus === 'approved';
      if (!isApproved) {
        alert('Atenção: Para ativar o modo ONLINE e receber solicitações de corridas, é necessário que seus dados de CNH, Veículo e Documentos estejam cadastrados e aprovados.');
        setShowDriverProfileEdit(true);
        return;
      }
    }
    setIsDriverOnline(!isDriverOnline);
  };

  // ========================================================
  // 1. TELA INICIAL: PÁGINA DE LOGIN OBRIGATÓRIA (SE NÃO LOGADO)
  // ========================================================
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={(user) => setCurrentUser(user)}
          onOpenSupabaseConfig={() => setShowConfigModal(true)}
          supabaseConnected={supabaseConnected}
        />

        {/* Supabase Config Modal */}
        {showConfigModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '20px'
          }}>
            <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '28px', position: 'relative' }}>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '10px', color: '#10b981' }}>
                  <Database size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Conectar Banco Supabase</h3>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Cole as credenciais do seu projeto Supabase abaixo para habilitar o banco de dados em nuvem e sincronização em tempo real (Realtime):
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="input-group">
                  <label>URL do Projeto Supabase (Project URL)</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={inputSupabaseUrl}
                    onChange={(e) => setInputSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                  />
                </div>

                <div className="input-group">
                  <label>Chave Pública Anon (Anon Public Key)</label>
                  <input
                    type="password"
                    className="custom-input"
                    value={inputSupabaseKey}
                    onChange={(e) => setInputSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                </div>

                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '10px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                  💡 <strong>Dica:</strong> O script completo de tabelas (<code>profiles</code>, <code>clients</code>, <code>drivers</code>, <code>rides</code>) está em <code>supabase/schema.sql</code>!
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={handleSaveConfig} className="btn-success" style={{ flex: 1 }}>
                    <Check size={16} /> Salvar e Conectar
                  </button>
                  <button onClick={() => setShowConfigModal(false)} className="btn-outline" style={{ flex: 1 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ========================================================
  // 2. TELA DO SISTEMA LOGADO
  // ========================================================
  const activeClientRide = rides.find(r => r.id === currentRideId) || rides.find(r => r.clientId === currentUser?.id) || rides[0];
  const pendingRides = rides.filter(r => r.status === 'searching');
  const myDriverRides = rides.filter(r => (r.status === 'accepted' || r.status === 'in_progress') && (r.driverId === currentUser?.id || !r.driverId));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header Logado */}
      <header style={{
        background: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '12px 20px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Logo & Marca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'var(--primary-gradient)',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
            }}>
              <Car size={24} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>DriveHora</span>
                {isUserAdmin ? (
                  <span style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#f59e0b',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Crown size={12} /> Admin
                  </span>
                ) : (
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
                  }}>MVP v1.0</span>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Motorista particular sob demanda por hora</p>
            </div>
          </div>

          {/* Seletor de Modos */}
          <nav style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            gap: '4px',
            flexWrap: 'wrap'
          }}>
            {/* Aba Admin (Exclusiva para Super Admins) */}
            {isUserAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: activeTab === 'admin' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                  color: activeTab === 'admin' ? '#000' : '#f59e0b',
                  transition: 'all 0.2s'
                }}
              >
                <Crown size={16} />
                <span>Painel Admin</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('client')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeTab === 'client' ? 'var(--primary-gradient)' : 'transparent',
                color: activeTab === 'client' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <Users size={16} />
              <span>Cliente</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('driver');
                setShowDriverProfileEdit(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeTab === 'driver' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: activeTab === 'driver' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <Car size={16} />
              <span>Motorista</span>
              {pendingRides.length > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>{pendingRides.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dual')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeTab === 'dual' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: activeTab === 'dual' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <Sparkles size={16} />
              <span>Visão Dupla</span>
            </button>

            <button
              onClick={() => setActiveTab('mobile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeTab === 'mobile' ? '#f59e0b' : 'transparent',
                color: activeTab === 'mobile' ? '#000' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <Smartphone size={16} />
              <span>Celular</span>
            </button>
          </nav>

          {/* Usuário & Configurações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: isUserAdmin ? '#f59e0b' : currentUser.role === 'driver' ? '#10b981' : '#6366f1',
                color: isUserAdmin ? '#000' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800
              }}>
                {isUserAdmin ? '👑' : currentUser.fullName.charAt(0)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser.fullName.split(' ')[0]}
                </span>
                <span style={{ fontSize: '0.65rem', color: isUserAdmin ? '#f59e0b' : 'var(--text-muted)' }}>
                  {isUserAdmin ? 'Super Admin' : currentUser.role === 'client' ? 'Passageiro' : 'Motorista'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sair e voltar ao Login"
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '4px' }}
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Supabase Button */}
            <button
              onClick={() => setShowConfigModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: supabaseConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: supabaseConnected ? '#10b981' : '#f59e0b',
                border: `1px solid ${supabaseConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Database size={14} />
              <span>{supabaseConnected ? 'Supabase ✅' : 'Supabase'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Supabase Config Modal */}
      {showConfigModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '28px', position: 'relative' }}>
            <button
              onClick={() => setShowConfigModal(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '10px', color: '#10b981' }}>
                <Database size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Conectar Banco Supabase</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Cole as credenciais do seu projeto Supabase abaixo para sincronização em tempo real (Realtime):
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="input-group">
                <label>URL do Projeto Supabase (Project URL)</label>
                <input
                  type="text"
                  className="custom-input"
                  value={inputSupabaseUrl}
                  onChange={(e) => setInputSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                />
              </div>

              <div className="input-group">
                <label>Chave Pública Anon (Anon Public Key)</label>
                <input
                  type="password"
                  className="custom-input"
                  value={inputSupabaseKey}
                  onChange={(e) => setInputSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>

              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '10px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                💡 <strong>Dica:</strong> O script de criação das tabelas no PostgreSQL está em <code>supabase/schema.sql</code>!
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={handleSaveConfig} className="btn-success" style={{ flex: 1 }}>
                  <Check size={16} /> Salvar e Conectar
                </button>
                <button onClick={() => setShowConfigModal(false)} className="btn-outline" style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '24px 16px' }}>
        
        {/* TAB 0: PAINEL EXCLUSIVO DO ADMIN */}
        {activeTab === 'admin' && isUserAdmin && (
          <AdminDashboard
            rides={rides}
            onOpenSupabaseConfig={() => setShowConfigModal(true)}
            supabaseConnected={supabaseConnected}
          />
        )}

        {/* TAB 1: CLIENTE (PASSAGEIRO) */}
        {activeTab === 'client' && (
          <div>
            {!isUserAdmin && currentUser.role === 'client' && (!clientProfile || !clientProfile.isProfileComplete) ? (
              <ClientOnboarding
                user={currentUser}
                onComplete={(cp) => setClientProfile(cp)}
                onOpenSupabaseConfig={() => setShowConfigModal(true)}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Form de Solicitação */}
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        padding: '10px',
                        borderRadius: '12px',
                        color: '#818cf8'
                      }}>
                        <Navigation size={22} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Contratar Motorista</h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Defina o tempo que precisará do veículo</p>
                      </div>
                    </div>

                    {/* Botão de GPS */}
                    <button
                      type="button"
                      onClick={handleGetGpsLocation}
                      disabled={isLocatingGPS}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Preencher com localização GPS atual"
                    >
                      <MapPin size={14} color="#10b981" />
                      <span>{isLocatingGPS ? 'Localizando...' : 'Usar meu GPS'}</span>
                    </button>
                  </div>

                  <form onSubmit={handleRequestRide} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Campo Partida com Busca Automática ao Digitar */}
                    <div className="input-group" style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label>📍 Ponto de Partida</label>
                        {isSearchingOrigin && (
                          <span style={{ fontSize: '0.7rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={10} className="animate-spin" /> Buscando locais...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="custom-input"
                        value={origin}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrigin(val);
                          if (val.trim().length >= 3) {
                            setIsSearchingOrigin(true);
                            searchAddressPlaces(val).then(results => {
                              setOriginSuggestions(results);
                              setIsSearchingOrigin(false);
                            });
                          } else {
                            setOriginSuggestions([]);
                          }
                        }}
                        onFocus={() => {
                          if (origin.trim().length >= 3) {
                            searchAddressPlaces(origin).then(res => setOriginSuggestions(res));
                          }
                        }}
                        placeholder="Ex: Av. Paulista, 1000..."
                        required
                      />

                      {/* Dropdown de Sugestões de Partida */}
                      {originSuggestions.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'rgba(15, 23, 42, 0.98)',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          borderRadius: '10px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                          zIndex: 30,
                          marginTop: '4px',
                          overflow: 'hidden'
                        }}>
                          {originSuggestions.map((sug, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setOrigin(sug);
                                setOriginSuggestions([]);
                              }}
                              style={{
                                padding: '10px 14px',
                                fontSize: '0.8rem',
                                color: '#e2e8f0',
                                cursor: 'pointer',
                                borderBottom: idx < originSuggestions.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <MapPin size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sug}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Campo Destino com Busca Automática ao Digitar */}
                    <div className="input-group" style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label>🏁 Destino Principal / Roteiro</label>
                        {isSearchingDest && (
                          <span style={{ fontSize: '0.7rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={10} className="animate-spin" /> Buscando locais...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        className="custom-input"
                        value={destination}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDestination(val);
                          if (val.trim().length >= 3) {
                            setIsSearchingDest(true);
                            searchAddressPlaces(val).then(results => {
                              setDestSuggestions(results);
                              setIsSearchingDest(false);
                            });
                          } else {
                            setDestSuggestions([]);
                          }
                        }}
                        onFocus={() => {
                          if (destination.trim().length >= 3) {
                            searchAddressPlaces(destination).then(res => setDestSuggestions(res));
                          }
                        }}
                        placeholder="Ex: Aeroporto de Guarulhos..."
                        required
                      />

                      {/* Dropdown de Sugestões de Destino */}
                      {destSuggestions.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'rgba(15, 23, 42, 0.98)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: '10px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                          zIndex: 30,
                          marginTop: '4px',
                          overflow: 'hidden'
                        }}>
                          {destSuggestions.map((sug, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setDestination(sug);
                                setDestSuggestions([]);
                              }}
                              style={{
                                padding: '10px 14px',
                                fontSize: '0.8rem',
                                color: '#e2e8f0',
                                cursor: 'pointer',
                                borderBottom: idx < destSuggestions.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <MapPin size={14} color="#10b981" style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sug}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Atalhos Rápidos */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setOrigin('Aeroporto de Congonhas (CGH)');
                          setDestination('Centro de Convenções Anhembi');
                          setHours(4);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        ✈️ Aeroporto ➔ Evento (4h)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOrigin('Hotel Fasano - Jardins');
                          setDestination('Tour Gastronômico e Compras');
                          setHours(6);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        🛍️ Diária / Passeio (6h)
                      </button>
                    </div>

                    {/* Seletor de Horas */}
                    <div className="input-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label>⏱️ Quantidade de Horas Contratadas</label>
                        <span style={{
                          fontWeight: 700,
                          color: '#818cf8',
                          background: 'rgba(99, 102, 241, 0.15)',
                          padding: '2px 10px',
                          borderRadius: '10px'
                        }}>{hours} {hours === 1 ? 'hora' : 'horas'}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#6366f1',
                          cursor: 'pointer',
                          marginTop: '6px'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>1h (Mínimo)</span>
                        <span>6h</span>
                        <span>12h (Diária)</span>
                      </div>
                    </div>

                    {/* Valor por hora */}
                    <div className="input-group">
                      <label>💵 Valor Ofertado por Hora (R$/h)</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}>R$</span>
                        <input
                          type="number"
                          className="custom-input"
                          style={{ paddingLeft: '38px' }}
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(Number(e.target.value))}
                          min={30}
                          step={5}
                          required
                        />
                      </div>
                    </div>

                    {/* Card de Simulação Financeira */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: '14px',
                      padding: '16px',
                      marginTop: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Valor Total Contratado:</span>
                        <strong style={{ fontSize: '1.25rem', color: '#fff' }}>{formatCurrency(totalAmount)}</strong>
                      </div>
                      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 0' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Taxa da Plataforma (15%):</span>
                        <span>{formatCurrency(platformFee)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                        <span>Repasse Líquido ao Motorista (85%):</span>
                        <span>{formatCurrency(driverNet)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isRequesting}
                      className="btn-primary"
                      style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '8px' }}
                    >
                      {isRequesting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>Gravando no Banco de Dados...</span>
                        </>
                      ) : (
                        <>
                          <Car size={18} />
                          <span>Solicitar Motorista por {formatCurrency(totalAmount)}</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Status em Tempo Real da Corrida do Cliente */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {activeClientRide ? (
                    <div className="glass-panel" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: activeClientRide.status === 'finished' 
                          ? '#10b981' 
                          : activeClientRide.status === 'in_progress' 
                          ? '#3b82f6' 
                          : activeClientRide.status === 'accepted'
                          ? '#f59e0b'
                          : 'var(--primary-gradient)'
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status da Solicitação</span>
                          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            {activeClientRide.status === 'searching' && (
                              <>
                                <span className="animate-pulse-soft" style={{ color: '#818cf8' }}>📡</span>
                                <span>Procurando motorista...</span>
                              </>
                            )}
                            {activeClientRide.status === 'accepted' && (
                              <>
                                <CheckCircle2 color="#f59e0b" size={20} />
                                <span>Motorista ({activeClientRide.driverName || 'Parceiro'}) aceitou! A caminho</span>
                              </>
                            )}
                            {activeClientRide.status === 'in_progress' && (
                              <>
                                <Car color="#3b82f6" size={20} className="animate-car" />
                                <span>Corrida em Andamento ({activeClientRide.hours}h)</span>
                              </>
                            )}
                            {activeClientRide.status === 'finished' && (
                              <>
                                <CheckCircle2 color="#10b981" size={20} />
                                <span>Corrida Concluída!</span>
                              </>
                            )}
                          </h3>
                        </div>

                        <span style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-secondary)'
                        }}>
                          ID: #{activeClientRide.id.slice(-6)}
                        </span>
                      </div>

                      {/* Informações da Viagem */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', marginTop: '5px' }}></div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Partida</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{activeClientRide.origin}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981', marginTop: '5px' }}></div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Destino</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{activeClientRide.destination}</div>
                          </div>
                        </div>
                      </div>

                      {/* Detalhes de Horas e Valor */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '12px',
                        borderRadius: '12px',
                        textAlign: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tempo</div>
                          <div style={{ fontWeight: 700 }}>{activeClientRide.hours} Horas</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Taxa / Hora</div>
                          <div style={{ fontWeight: 700 }}>{formatCurrency(activeClientRide.hourlyRate)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total</div>
                          <div style={{ fontWeight: 700, color: '#818cf8' }}>{formatCurrency(activeClientRide.total)}</div>
                        </div>
                      </div>

                      {/* Ações interativas */}
                      {activeClientRide.status === 'searching' && (
                        <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '12px', border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                            💡 <strong>Simulação em tempo real:</strong> Aceite esta corrida na aba <strong>Motorista</strong> ou clique no botão abaixo:
                          </p>
                          <button
                            onClick={() => handleAcceptRide(activeClientRide.id)}
                            className="btn-success"
                            style={{ width: '100%', fontSize: '0.85rem', padding: '8px' }}
                          >
                            Simular Aceite do Motorista
                          </button>
                        </div>
                      )}

                      {activeClientRide.status === 'accepted' && (
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleStartRide(activeClientRide.id)}
                            className="btn-primary"
                            style={{ flex: 1, fontSize: '0.85rem' }}
                          >
                            <PlayCircle size={16} />
                            Iniciar Viagem
                          </button>
                        </div>
                      )}

                      {activeClientRide.status === 'in_progress' && (
                        <div style={{ marginTop: '20px' }}>
                          <button
                            onClick={() => handleFinishRide(activeClientRide.id)}
                            className="btn-success"
                            style={{ width: '100%', fontSize: '0.9rem' }}
                          >
                            <CheckCircle2 size={16} />
                            Finalizar Corrida e Efetuar Repasse
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
                      <Car size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Nenhuma corrida ativa no momento</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        Preencha o formulário ao lado para solicitar um motorista por hora.
                      </p>
                    </div>
                  )}

                  {/* Destaque das Vantagens */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} color="#10b981" />
                      Por que contratar por hora?
                    </h4>
                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li>Motorista exclusivo aguardando em reuniões, compras ou compromissos.</li>
                      <li>Sem surpresas com tarifas dinâmicas de trânsito ou chuva.</li>
                      <li>Preço transparente e repasse justo ao motorista parceiro (85%).</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MOTORISTA */}
        {activeTab === 'driver' && (
          <div>
            {/* Se o motorista não for admin e ainda não foi aprovado, exibe onboarding */}
            {!isUserAdmin && (!driverProfile || driverProfile.verificationStatus !== 'approved') ? (
              <DriverOnboarding
                user={currentUser}
                initialProfile={driverProfile}
                onComplete={(dp) => setDriverProfile(dp)}
                onOpenSupabaseConfig={() => setShowConfigModal(true)}
              />
            ) : showDriverProfileEdit ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <button onClick={() => setShowDriverProfileEdit(false)} className="btn-outline">
                    ⬅️ Voltar ao Painel do Motorista
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {isUserAdmin ? 'Perfil do Motorista (Super Admin)' : 'Edição Cadastral'}
                  </span>
                </div>
                <DriverOnboarding
                  user={currentUser}
                  initialProfile={driverProfile}
                  onComplete={(dp) => {
                    setDriverProfile(dp);
                    setShowDriverProfileEdit(false);
                  }}
                  onOpenSupabaseConfig={() => setShowConfigModal(true)}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Painel do Motorista */}
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Painel do Motorista</h2>
                        {driverProfile?.verificationStatus === 'approved' ? (
                          <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            Verificado ✅
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            Admin (Cadastro Pendente)
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {driverProfile?.vehicleBrand ? `${driverProfile.vehicleBrand} ${driverProfile.vehicleModel} • ${driverProfile.vehiclePlate}` : 'Complete seu veículo para atender chamados'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {isUserAdmin && (
                        <button
                          onClick={() => setActiveTab('admin')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Crown size={14} />
                          <span>Painel Administrativo</span>
                        </button>
                      )}

                      <button
                        onClick={() => setShowDriverProfileEdit(true)}
                        className="btn-outline"
                        style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        title="Editar / Cadastrar dados do veículo e CNH"
                      >
                        <UserCheck size={14} />
                        <span>Meus Documentos</span>
                      </button>

                      <button
                        onClick={handleToggleDriverOnline}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          borderRadius: '24px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          background: isDriverOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: isDriverOnline ? '#10b981' : '#ef4444',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: isDriverOnline ? '#10b981' : '#ef4444'
                        }}
                      >
                        <Radio size={16} className={isDriverOnline ? 'animate-pulse' : ''} />
                        <span>{isDriverOnline ? 'ONLINE' : 'OFFLINE'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Alerta de Validação de Documentos para Admin */}
                  {driverProfile?.verificationStatus !== 'approved' && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '14px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                        <strong>Requisito de Atendimento:</strong> Como administrador, você possui acesso irrestrito às telas do sistema. Porém, para <strong>ativar o modo ONLINE e receber chamados de passageiros</strong>, clique em <em>"Meus Documentos"</em> e preencha os dados do veículo e CNH.
                      </div>
                    </div>
                  )}

                  {/* Cards de Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <DollarSign size={16} color="#10b981" />
                        <span>Ganhos Líquidos</span>
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
                        {formatCurrency(driverEarnings)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Repasse de 85% do total</div>
                    </div>

                    <div style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Award size={16} color="#f59e0b" />
                        <span>Corridas Feitas</span>
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
                        {rides.filter(r => r.status === 'finished').length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Completadas hoje</div>
                    </div>
                  </div>

                  {/* Status do Radar */}
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: isDriverOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <Compass size={20} color={isDriverOnline ? '#10b981' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '0.85rem', color: isDriverOnline ? '#10b981' : 'var(--text-muted)' }}>
                      {isDriverOnline ? 'Aguardando novas solicitações de clientes...' : 'Você está offline. Ative o modo ONLINE para receber chamados.'}
                    </span>
                  </div>
                </div>

                {/* Lista de Chamadas em Aberto */}
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Solicitações Disponíveis</h3>
                    <span style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {pendingRides.length} pendentes
                    </span>
                  </div>

                  {pendingRides.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <Clock size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.9rem' }}>Nenhuma corrida pendente no momento.</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Crie uma solicitação na aba <strong>Cliente</strong> para testar.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {pendingRides.map(r => (
                        <div
                          key={r.id}
                          style={{
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            padding: '16px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontWeight: 700
                            }}>
                              ⏱️ {r.hours}h de serviço
                            </span>
                            <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                              Ganho Líquido: {formatCurrency(r.driverNet)}
                            </strong>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            <strong>Passageiro:</strong> {r.clientName || 'Cliente'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            <strong>Partida:</strong> {r.origin}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '12px' }}>
                            <strong>Destino:</strong> {r.destination}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Total Cliente: {formatCurrency(r.total)}
                            </span>
                            <button
                              onClick={() => handleAcceptRide(r.id)}
                              className="btn-success"
                              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                            >
                              Aceitar Corrida
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Corridas Aceitas / Em Andamento pelo Motorista */}
                  {myDriverRides.length > 0 && (
                    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#f59e0b' }}>
                        🚗 Minhas Corridas em Atendimento
                      </h4>
                      {myDriverRides.map(r => (
                        <div
                          key={r.id}
                          style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '12px',
                            padding: '14px',
                            marginBottom: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{r.origin} ➔ {r.destination}</span>
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>{r.status}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            {r.status === 'accepted' && (
                              <button
                                onClick={() => handleStartRide(r.id)}
                                className="btn-primary"
                                style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                              >
                                <PlayCircle size={14} /> Iniciar Trajeto
                              </button>
                            )}
                            {r.status === 'in_progress' && (
                              <button
                                onClick={() => handleFinishRide(r.id)}
                                className="btn-success"
                                style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                              >
                                <CheckCircle2 size={14} /> Concluir e Receber {formatCurrency(r.driverNet)}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VISÃO DUPLA */}
        {activeTab === 'dual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              padding: '12px 18px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={20} color="#818cf8" />
                <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>
                  <strong>Simulador Dual (Passageiro vs Motorista):</strong> Observe a persistência no banco de dados sincronizando ambos os lados em tempo real!
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
              {/* Lado Esquerdo: Cliente */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <Users size={20} color="#818cf8" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tela do Cliente (Passageiro)</h3>
                </div>

                <form onSubmit={handleRequestRide} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="custom-input"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="Partida"
                      required
                    />
                  </div>
                  <input
                    type="text"
                    className="custom-input"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Destino"
                    required
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Horas ({hours}h)</label>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#6366f1' }}
                      />
                    </div>
                    <div style={{ width: '120px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>R$/hora</label>
                      <input
                        type="number"
                        className="custom-input"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total: <strong>{formatCurrency(totalAmount)}</strong></span>
                    <span style={{ color: '#10b981' }}>Motorista: <strong>{formatCurrency(driverNet)}</strong></span>
                  </div>

                  <button type="submit" className="btn-primary" style={{ padding: '10px' }}>
                    1. Criar Solicitação de Corrida
                  </button>
                </form>

                {activeClientRide && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status no Banco:</div>
                    <strong style={{ color: '#818cf8', fontSize: '0.95rem' }}>{activeClientRide.status.toUpperCase()}</strong>
                  </div>
                )}
              </div>

              {/* Lado Direito: Motorista */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <Car size={20} color="#10b981" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tela do Motorista Parceiro</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Chamados recebidos em tempo real:
                  </div>

                  {pendingRides.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                      Nenhum chamado pendente. Clique em "Criar Solicitação" ao lado.
                    </div>
                  ) : (
                    pendingRides.map(r => (
                      <div key={r.id} style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.origin} ➔ {r.destination}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>{r.hours}h • Ganho {formatCurrency(r.driverNet)}</span>
                          <button onClick={() => handleAcceptRide(r.id)} className="btn-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                            2. Aceitar
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {myDriverRides.map(r => (
                    <div key={r.id} style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Em Atendimento: {r.origin}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        {r.status === 'accepted' && (
                          <button onClick={() => handleStartRide(r.id)} className="btn-primary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}>
                            3. Iniciar Corrida
                          </button>
                        )}
                        {r.status === 'in_progress' && (
                          <button onClick={() => handleFinishRide(r.id)} className="btn-success" style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}>
                            4. Finalizar e Receber
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ABRIR NO CELULAR */}
        {activeTab === 'mobile' && (
          <div style={{ maxWidth: '750px', margin: '0 auto' }}>
            <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Smartphone size={32} color="#f59e0b" />
              </div>

              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>
                Acesse o DriveHora pelo seu Celular
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '28px' }}>
                Aponte a câmera do seu smartphone para o QR Code abaixo (conectado ao mesmo Wi-Fi):
              </p>

              {/* QR Code */}
              <div style={{
                background: '#ffffff',
                padding: '20px',
                borderRadius: '20px',
                display: 'inline-block',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                marginBottom: '24px'
              }}>
                <QRCodeSVG
                  value={localNetworkUrl}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Link Direto */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                margin: '0 auto 28px',
                maxWidth: '450px'
              }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ou digite no navegador do celular:</span>
                <strong style={{ fontSize: '1rem', color: '#818cf8' }}>{localNetworkUrl}</strong>
              </div>

              {/* Passo a passo */}
              <div style={{
                textAlign: 'left',
                background: 'rgba(15, 23, 42, 0.5)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', color: '#fff' }}>
                  📱 Como instalar como aplicativo no smartphone:
                </h4>
                <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>Certifique-se de que o celular está conectado na mesma rede Wi-Fi do computador.</li>
                  <li>Abra a câmera do celular ou o navegador e acesse o endereço acima.</li>
                  <li>No <strong>Android (Chrome)</strong>: Toque no menu de 3 pontinhos e selecione <em>"Adicionar à tela inicial"</em> ou <em>"Instalar aplicativo"</em>.</li>
                  <li>No <strong>iPhone (Safari)</strong>: Toque no botão de compartilhar e selecione <em>"Adicionar à Tela de Início"</em>.</li>
                  <li>O ícone do <strong>DriveHora</strong> ficará na tela inicial como um app nativo!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '16px 20px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'rgba(9, 13, 22, 0.9)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span>© 2026 DriveHora — Todos os direitos reservados</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Regra: 15% Plataforma / 85% Motorista</span>
            <span>Banco: <strong>{supabaseConnected ? 'Supabase Realtime' : 'Memória / Local'}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

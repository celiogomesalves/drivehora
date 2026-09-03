import React, { useState, useEffect } from 'react';
import type { DriverProfile, ClientProfile, DriverVerificationStatus } from '../types/auth';
import { 
  Users, Car, DollarSign, ShieldCheck, CheckCircle2, 
  XCircle, Clock, RefreshCw, 
  TrendingUp, Database
} from 'lucide-react';
import { formatCurrency, formatPhone, formatCpf, formatPlate } from '../utils/formatters';
import { dbGetAllDrivers, dbGetAllClients, dbAdminUpdateDriverStatus, type DbRide } from '../services/dbService';
import { getSupabase } from '../supabase';

interface AdminDashboardProps {
  rides: DbRide[];
  onOpenSupabaseConfig: () => void;
  supabaseConnected: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  rides, 
  onOpenSupabaseConfig, 
  supabaseConnected 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'drivers' | 'clients' | 'rides'>('overview');
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [driverFilter, setDriverFilter] = useState<'all' | 'under_review' | 'approved' | 'pending_docs'>('all');

  const loadAdminData = async () => {
    const [driverList, clientList] = await Promise.all([
      dbGetAllDrivers(),
      dbGetAllClients()
    ]);
    setDrivers(driverList);
    setClients(clientList);
  };

  useEffect(() => {
    setIsLoading(true);
    loadAdminData().finally(() => setIsLoading(false));

    const sb = getSupabase();
    let channel: any = null;
    if (sb) {
      channel = sb
        .channel('public:admin_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadAdminData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => loadAdminData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => loadAdminData())
        .subscribe();
    }

    const interval = setInterval(() => {
      loadAdminData();
    }, 3500);

    return () => {
      clearInterval(interval);
      if (channel && sb) sb.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (driverId: string, status: DriverVerificationStatus) => {
    await dbAdminUpdateDriverStatus(driverId, status);
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, verificationStatus: status } : d));
  };

  // Cálculos de métricas
  const finishedRides = rides.filter(r => r.status === 'finished');
  const totalVolume = finishedRides.reduce((acc, r) => acc + (r.total || 0), 0);
  const totalPlatformRevenue = finishedRides.reduce((acc, r) => acc + (r.commission || 0), 0);
  const totalDriverPayout = finishedRides.reduce((acc, r) => acc + (r.driverNet || 0), 0);
  const pendingDrivers = drivers.filter(d => d.verificationStatus === 'under_review' || d.verificationStatus === 'pending_docs');
  const approvedDrivers = drivers.filter(d => d.verificationStatus === 'approved');

  const filteredDrivers = drivers.filter(d => {
    if (driverFilter === 'all') return true;
    return d.verificationStatus === driverFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Banner de Boas-Vindas do Super Admin */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.15))',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'var(--primary-gradient)',
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)'
          }}>
            <ShieldCheck size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Painel Geral de Administração</h2>
              <span style={{
                background: '#f59e0b',
                color: '#000',
                fontWeight: 800,
                fontSize: '0.65rem',
                padding: '2px 8px',
                borderRadius: '10px',
                textTransform: 'uppercase'
              }}>Super Admin</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Gestão central de motoristas, clientes, aprovação de documentos e faturamento
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadAdminData}
            disabled={isLoading}
            className="btn-outline"
            style={{ fontSize: '0.8rem', padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Atualizar Dados</span>
          </button>

          <button
            onClick={onOpenSupabaseConfig}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '8px 14px' }}
          >
            <Database size={14} />
            <span>{supabaseConnected ? 'Banco Conectado' : 'Conectar Banco'}</span>
          </button>
        </div>
      </div>

      {/* Navegação de Sub-Abas do Admin */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: 'rgba(15, 23, 42, 0.8)',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid var(--border-subtle)',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveSubTab('overview')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
            background: activeSubTab === 'overview' ? 'var(--primary-gradient)' : 'transparent',
            color: activeSubTab === 'overview' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Visão Geral
        </button>

        <button
          onClick={() => setActiveSubTab('drivers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
            background: activeSubTab === 'drivers' ? 'var(--secondary-gradient)' : 'transparent',
            color: activeSubTab === 'drivers' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          <span>Motoristas ({drivers.length})</span>
          {pendingDrivers.length > 0 && (
            <span style={{ background: '#f59e0b', color: '#000', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px' }}>
              {pendingDrivers.length} pendentes
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('clients')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
            background: activeSubTab === 'clients' ? 'var(--primary-gradient)' : 'transparent',
            color: activeSubTab === 'clients' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Clientes ({clients.length})
        </button>

        <button
          onClick={() => setActiveSubTab('rides')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
            background: activeSubTab === 'rides' ? 'var(--primary-gradient)' : 'transparent',
            color: activeSubTab === 'rides' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Corridas ({rides.length})
        </button>
      </div>

      {/* SUB-ABA 1: VISÃO GERAL / MÉTRICAS */}
      {activeSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Grid de 4 Cards de Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            
            {/* Faturamento da Plataforma (15%) */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Receita da Plataforma (15%)</span>
                <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '6px', borderRadius: '8px', color: '#818cf8' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#818cf8', marginTop: '10px' }}>
                {formatCurrency(totalPlatformRevenue)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Volume total: {formatCurrency(totalVolume)}
              </div>
            </div>

            {/* Repasse aos Motoristas (85%) */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Repasse aos Motoristas (85%)</span>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '6px', borderRadius: '8px', color: '#10b981' }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '10px' }}>
                {formatCurrency(totalDriverPayout)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {finishedRides.length} viagens pagas
              </div>
            </div>

            {/* Motoristas Cadastrados */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Motoristas Cadastrados</span>
                <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '6px', borderRadius: '8px', color: '#f59e0b' }}>
                  <Car size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '10px' }}>
                {drivers.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                {approvedDrivers.length} verificados e aptos
              </div>
            </div>

            {/* Passageiros / Clientes */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Passageiros / Clientes</span>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '6px', borderRadius: '8px', color: '#60a5fa' }}>
                  <Users size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '10px' }}>
                {clients.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {rides.length} chamados registrados
              </div>
            </div>

          </div>

          {/* Chamadas Recentes em Tempo Real */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Últimas Corridas no Sistema</h3>
            {rides.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma corrida realizada até o momento.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rides.slice(0, 5).map(r => (
                  <div key={r.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{r.origin} ➔ {r.destination}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Passageiro: {r.clientName || r.clientId} • {r.hours} horas
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#818cf8' }}>{formatCurrency(r.total)}</div>
                      <span style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: r.status === 'finished' ? '#10b981' : r.status === 'in_progress' ? '#3b82f6' : '#f59e0b'
                      }}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 2: GERENCIAMENTO DE MOTORISTAS & APROVAÇÃO */}
      {activeSubTab === 'drivers' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Motoristas Parceiros</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Valide e aprove a CNH e veículos para liberar atendimento</p>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'all', label: 'Todos' },
                { key: 'under_review', label: 'Em Análise ⏳' },
                { key: 'approved', label: 'Aprovados ✅' },
                { key: 'pending_docs', label: 'Sem Documentos' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setDriverFilter(f.key as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: driverFilter === f.key ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    color: driverFilter === f.key ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredDrivers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <Car size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p>Nenhum motorista encontrado neste filtro.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredDrivers.map(d => (
                <div key={d.id} style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>{d.vehicleBrand} {d.vehicleModel} ({d.vehicleYear})</strong>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        fontWeight: 700
                      }}>
                        Placa: {formatPlate(d.vehiclePlate)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Telefone: <strong>{formatPhone(d.phone)}</strong> • CNH: <strong>{d.cnhNumber || 'N/I'}</strong> (Cat. {d.cnhCategory}) • CPF: <strong>{formatCpf(d.cpf)}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.75rem' }}>
                      <span style={{
                        color: d.verificationStatus === 'approved' ? '#10b981' : d.verificationStatus === 'under_review' ? '#f59e0b' : '#ef4444',
                        fontWeight: 700
                      }}>
                        Status: {d.verificationStatus === 'approved' ? 'Aprovado ✅' : d.verificationStatus === 'under_review' ? 'Em Análise ⏳' : 'Pendente Documentos ⚠️'}
                      </span>
                      <span>• Avaliação: ⭐ {d.rating}</span>
                      <span>• Total de Corridas: {d.totalRides}</span>
                    </div>
                  </div>

                  {/* Ações de Moderação */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {d.verificationStatus !== 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(d.id, 'approved')}
                        className="btn-success"
                        style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                      >
                        <CheckCircle2 size={14} /> Aprovar Motorista
                      </button>
                    )}

                    {d.verificationStatus === 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(d.id, 'under_review')}
                        className="btn-outline"
                        style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#f59e0b' }}
                      >
                        <Clock size={14} /> Suspender / Reavaliar
                      </button>
                    )}

                    <button
                      onClick={() => handleUpdateStatus(d.id, 'rejected')}
                      className="btn-outline"
                      style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#ef4444' }}
                    >
                      <XCircle size={14} /> Reprovar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA 3: CLIENTES */}
      {activeSubTab === 'clients' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Clientes / Passageiros Cadastrados ({clients.length})</h3>
            <button
              onClick={() => loadAdminData()}
              className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>

          {clients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <Users size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p>Nenhum cliente cadastrado ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clients.map(c => (
                <div key={c.id} style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#fff' }}>
                        {c.fullName || 'Passageiro DriveHora'}
                      </strong>
                      {c.email && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          • {c.email}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontWeight: 700
                    }}>
                      {c.isProfileComplete ? 'Perfil Ativo ✅' : 'Cadastrado 👤'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                    <span>📞 Telefone: <strong>{formatPhone(c.phone) || 'Não informado'}</strong></span>
                    {c.cpf && <span>🆔 CPF: <strong>{formatCpf(c.cpf)}</strong></span>}
                  </div>

                  {(c.street || c.city || c.neighborhood) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      📍 {c.street ? `${c.street}, ${c.number || 'S/N'}` : ''} 
                      {c.complement ? ` (${c.complement})` : ''} 
                      {c.neighborhood ? ` - ${c.neighborhood}` : ''} 
                      {c.city ? ` - ${c.city}/${c.state}` : ''} 
                      {c.cep ? ` • CEP: ${c.cep}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA 4: AUDITORIA DE CORRIDAS */}
      {activeSubTab === 'rides' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>Histórico Geral de Corridas</h3>
          {rides.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma corrida registrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rides.map(r => (
                <div key={r.id} style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.origin} ➔ {r.destination}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Passageiro: {r.clientName || r.clientId} • Motorista: {r.driverName || r.driverId || 'Aguardando'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#fff' }}>Total: {formatCurrency(r.total)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>Plataforma (15%): {formatCurrency(r.commission)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Motorista (85%): {formatCurrency(r.driverNet)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { DriverProfile, ClientProfile, DriverVerificationStatus } from '../types/auth';
import { 
  Users, Car, DollarSign, ShieldCheck, CheckCircle2, 
  XCircle, Clock, RefreshCw, 
  TrendingUp, Database, Image, AlertTriangle, Eye, X, Check
} from 'lucide-react';
import { formatCurrency, formatPhone, formatCpf, formatPlate } from '../utils/formatters';
import { dbGetAllDrivers, dbGetAllClients, dbAdminUpdateDriverStatus, type DbRide } from '../services/dbService';
import { getSupabase } from '../supabase';

// Utilitário para verificar pendências documentais obrigatórias
export const getMissingDriverDocs = (d: DriverProfile): string[] => {
  const missing: string[] = [];
  if (!d.cnhUrl && !d.cnhNumber) missing.push('Foto da CNH (ou Número)');
  if (!d.crlvUrl && !d.vehiclePlate) missing.push('Foto do CRLV (Doc. do Veículo)');
  if (!d.selfieUrl) missing.push('Selfie de Identificação com CNH');
  if (!d.cpf || d.cpf.replace(/\D/g, '').length < 11) missing.push('CPF Válido');
  if (!d.phone) missing.push('Telefone de Contato');
  if (!d.vehicleBrand || !d.vehicleModel) missing.push('Marca/Modelo do Veículo');
  if (!d.vehiclePlate) missing.push('Placa do Veículo');
  return missing;
};

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
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

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

  const handleUpdateStatus = async (driver: DriverProfile, status: DriverVerificationStatus) => {
    if (status === 'approved') {
      const missing = getMissingDriverDocs(driver);
      if (missing.length > 0) {
        alert(
          `⚠️ APROVAÇÃO BLOQUEADA!\n\nNão é possível aprovar este motorista pois existem documentos/dados obrigatórios pendentes:\n\n• ${missing.join('\n• ')}\n\nO motorista precisa enviar todas as fotos e dados antes da liberação.`
        );
        return;
      }
    }

    const res = await dbAdminUpdateDriverStatus(driver.id, status);
    if (res.success) {
      setDrivers(prev => prev.map(d => (d.id === driver.id || d.userId === driver.userId) ? { ...d, verificationStatus: status } : d));
      if (status === 'approved') {
        alert(`✅ Motorista "${driver.vehicleBrand} ${driver.vehicleModel}" aprovado com sucesso!`);
      }
    } else {
      alert(`Erro ao atualizar status: ${res.error || 'Falha de comunicação com o banco'}`);
    }
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
              {filteredDrivers.map(d => {
                const missingDocs = getMissingDriverDocs(d);
                const isReadyToApprove = missingDocs.length === 0;

                return (
                  <div key={d.id} style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: isReadyToApprove ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '14px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1.05rem', color: '#fff' }}>
                            {d.vehicleBrand ? `${d.vehicleBrand} ${d.vehicleModel}` : 'Veículo não informado'} {d.vehicleYear ? `(${d.vehicleYear})` : ''}
                          </strong>
                          {d.vehiclePlate && (
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              fontWeight: 700,
                              color: '#94a3b8'
                            }}>
                              Placa: {formatPlate(d.vehiclePlate)}
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            background: d.verificationStatus === 'approved' 
                              ? 'rgba(16, 185, 129, 0.15)' 
                              : d.verificationStatus === 'under_review' 
                              ? 'rgba(245, 158, 11, 0.15)' 
                              : 'rgba(239, 68, 68, 0.15)',
                            color: d.verificationStatus === 'approved' 
                              ? '#10b981' 
                              : d.verificationStatus === 'under_review' 
                              ? '#f59e0b' 
                              : '#ef4444'
                          }}>
                            {d.verificationStatus === 'approved' ? 'Aprovado ✅' : d.verificationStatus === 'under_review' ? 'Em Análise ⏳' : 'Pendente Docs ⚠️'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          <span>📞 Telefone: <strong>{formatPhone(d.phone) || 'Não informado'}</strong></span>
                          <span>🆔 CPF: <strong>{formatCpf(d.cpf) || 'Não informado'}</strong></span>
                          <span>🪪 CNH: <strong>{d.cnhNumber || 'Não informada'}</strong> (Cat. {d.cnhCategory || 'B'})</span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>⭐ Avaliação: {d.rating}</span>
                          <span>• 🚗 Total de Corridas: {d.totalRides}</span>
                        </div>
                      </div>

                      {/* Ações de Moderação */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {d.verificationStatus !== 'approved' && (
                          <button
                            onClick={() => handleUpdateStatus(d, 'approved')}
                            className={isReadyToApprove ? "btn-success" : "btn-outline"}
                            title={isReadyToApprove ? "Aprovar motorista" : `Faltam documentos: ${missingDocs.join(', ')}`}
                            style={{ 
                              padding: '8px 16px', 
                              fontSize: '0.8rem',
                              opacity: isReadyToApprove ? 1 : 0.65,
                              cursor: isReadyToApprove ? 'pointer' : 'not-allowed',
                              border: isReadyToApprove ? undefined : '1px dashed #ef4444',
                              color: isReadyToApprove ? '#fff' : '#f87171'
                            }}
                          >
                            <CheckCircle2 size={15} /> Aprovar Motorista
                          </button>
                        )}

                        {d.verificationStatus === 'approved' && (
                          <button
                            onClick={() => handleUpdateStatus(d, 'under_review')}
                            className="btn-outline"
                            style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#f59e0b' }}
                          >
                            <Clock size={14} /> Suspender / Reavaliar
                          </button>
                        )}

                        <button
                          onClick={() => handleUpdateStatus(d, 'rejected')}
                          className="btn-outline"
                          style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#ef4444' }}
                        >
                          <XCircle size={14} /> Reprovar
                        </button>
                      </div>
                    </div>

                    {/* Documentos Anexados & Miniaturas */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Documentos para Auditoria:
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* CNH */}
                        {d.cnhUrl ? (
                          <button
                            onClick={() => setPreviewDoc({ title: `CNH - ${d.vehicleBrand} ${d.vehicleModel}`, url: d.cnhUrl! })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#818cf8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={13} /> Ver Foto CNH
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={13} /> CNH não enviada
                          </span>
                        )}

                        {/* CRLV */}
                        {d.crlvUrl ? (
                          <button
                            onClick={() => setPreviewDoc({ title: `CRLV (Doc. Veículo) - Placa ${d.vehiclePlate}`, url: d.crlvUrl! })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#818cf8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={13} /> Ver Doc. Veículo (CRLV)
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={13} /> CRLV não enviado
                          </span>
                        )}

                        {/* Selfie */}
                        {d.selfieUrl ? (
                          <button
                            onClick={() => setPreviewDoc({ title: `Selfie de Identificação - ${d.vehicleBrand} ${d.vehicleModel}`, url: d.selfieUrl! })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              color: '#818cf8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={13} /> Ver Selfie / Rosto
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={13} /> Selfie não enviada
                          </span>
                        )}
                      </div>

                      {/* Alerta de Documentos Faltantes ou Badge Completo */}
                      {!isReadyToApprove ? (
                        <div style={{
                          marginTop: '4px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#f87171',
                          fontSize: '0.75rem'
                        }}>
                          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                          <span>
                            <strong>Bloqueio de Aprovação ({missingDocs.length} pendências):</strong> Faltando {missingDocs.join(', ')}.
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          marginTop: '4px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#34d399',
                          fontSize: '0.75rem'
                        }}>
                          <Check size={14} />
                          <span><strong>Documentação completa e validada.</strong> Motorista pronto para aprovação.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

      {/* MODAL DE VISUALIZAÇÃO DE DOCUMENTO (CNH / CRLV / SELFIE) */}
      {previewDoc && (
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
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <strong style={{ fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image size={18} color="#818cf8" />
                {previewDoc.title}
              </strong>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
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

            <div style={{
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b0f19'
            }}>
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
                }}
              />
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'rgba(15, 23, 42, 0.5)'
            }}>
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noreferrer"
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px', textDecoration: 'none' }}
              >
                Abrir em Nova Aba
              </a>
              <button
                onClick={() => setPreviewDoc(null)}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 16px' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

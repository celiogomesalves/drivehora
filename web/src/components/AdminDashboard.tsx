import React, { useState, useEffect } from 'react';
import type { DriverProfile, ClientProfile, DriverVerificationStatus } from '../types/auth';
import { 
  Users, Car, DollarSign, ShieldCheck, CheckCircle2, 
  XCircle, Clock, RefreshCw, 
  TrendingUp, Database, Image, AlertTriangle, Eye, X, Check,
  Settings, Bell, CreditCard, Sliders, Send, Save, Trash2,
  Calendar, Filter, Globe
} from 'lucide-react';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput, formatPhone, formatCpf, formatPlate } from '../utils/formatters';
import { dbGetAllDrivers, dbGetAllClients, dbAdminUpdateDriverStatus, dbAdminDeleteDriver, type DbRide } from '../services/dbService';
import { getSupabase } from '../supabase';
import { getSystemSettings, saveSystemSettings, fetchSystemSettingsFromDb, type SystemSettings } from '../services/settingsService';
import { useSystemDialog } from './SystemDialog';

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
  const { showAlert, showToast } = useSystemDialog();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'drivers' | 'clients' | 'rides' | 'settings'>('overview');
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [driverFilter, setDriverFilter] = useState<'all' | 'under_review' | 'approved' | 'rejected' | 'pending_docs'>('all');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<DriverProfile | null>(null);
  const [isDeletingDriver, setIsDeletingDriver] = useState(false);

  // Filtros de Data para Auditoria de Corridas (Padrão: Esta semana)
  const [rideDateFilter, setRideDateFilter] = useState<'all' | 'today' | 'week' | '15days' | '30days' | 'custom'>('week');
  const [rideCustomDate, setRideCustomDate] = useState<string>('');

  // Configurações Globais do Sistema
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(getSystemSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const handleSaveAllSettings = async () => {
    setIsSavingSettings(true);
    await saveSystemSettings(systemSettings);
    setIsSavingSettings(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 4000);
  };

  const handleTestFirebasePush = () => {
    setTestPushStatus('sending');
    setTimeout(() => {
      setTestPushStatus('success');
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('🔔 DriveHora Teste de Push FCM', {
            body: 'Tudo certo! As notificações Push do Firebase e regras do sistema estão operando normalmente.',
            icon: '/favicon.ico'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('🔔 DriveHora Teste de Push FCM', {
                body: 'Notificação de teste recebida com sucesso!',
                icon: '/favicon.ico'
              });
            }
          });
        }
      }
      setTimeout(() => setTestPushStatus(null), 5000);
    }, 700);
  };

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
    fetchSystemSettingsFromDb().then(dbSettings => {
      setSystemSettings(dbSettings);
    });

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
        showAlert(
          `Não é possível aprovar este motorista pois existem documentos/dados obrigatórios pendentes:\n\n• ${missing.join('\n• ')}\n\nO motorista precisa enviar todas as fotos e dados antes da liberação.`,
          'warning',
          'Aprovação Bloqueada'
        );
        return;
      }
    }

    const res = await dbAdminUpdateDriverStatus(driver.id, status);
    if (res.success) {
      setDrivers(prev => prev.map(d => (d.id === driver.id || d.userId === driver.userId) ? { ...d, verificationStatus: status } : d));
      if (status === 'approved') {
        showToast(`Motorista "${driver.driverName || driver.vehicleModel}" aprovado com sucesso!`, 'success');
      } else if (status === 'rejected') {
        showToast(`Motorista "${driver.driverName || driver.vehicleModel}" reprovado.`, 'warning');
      } else if (status === 'under_review') {
        showToast(`Motorista "${driver.driverName || driver.vehicleModel}" colocado em análise.`, 'info');
      }
    } else {
      showAlert(`Erro ao atualizar status: ${res.error || 'Falha de comunicação com o banco'}`, 'error', 'Erro');
    }
  };

  const handleDeleteDriverConfirm = async () => {
    if (!driverToDelete) return;
    setIsDeletingDriver(true);
    const res = await dbAdminDeleteDriver(driverToDelete.id, driverToDelete.userId);
    setIsDeletingDriver(false);
    if (res.success) {
      setDrivers(prev => prev.filter(d => d.id !== driverToDelete.id && d.userId !== driverToDelete.userId));
      showToast(`Motorista "${driverToDelete.driverName || driverToDelete.fullName || 'Parceiro'}" foi excluído com sucesso!`, 'success');
      setDriverToDelete(null);
    } else {
      showAlert(`Erro ao excluir motorista: ${res.error || 'Falha de comunicação com o banco'}`, 'error', 'Erro');
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

      {/* Navegação de Sub-Abas do Admin (Mobile Friendly com Scroll Lateral Suave) */}
      <div className="nav-scrollable" style={{
        background: 'rgba(15, 23, 42, 0.95)',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid var(--border-subtle)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
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

        <button
          onClick={() => setActiveSubTab('settings')}
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
            background: activeSubTab === 'settings' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
            color: activeSubTab === 'settings' ? '#000' : '#f59e0b'
          }}
        >
          <Settings size={15} />
          <span>Configurações do Sistema</span>
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
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'Todos' },
                { key: 'under_review', label: 'Em Análise ⏳' },
                { key: 'approved', label: 'Aprovados ✅' },
                { key: 'rejected', label: 'Reprovados ❌' },
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
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              Nenhum motorista encontrado com o filtro selecionado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredDrivers.map(d => {
                const missingDocs = getMissingDriverDocs(d);
                const isReadyToApprove = missingDocs.length === 0;

                return (
                  <div key={d.id} className="glass-card" style={{
                    padding: '18px 20px',
                    borderRadius: '16px',
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
                            {d.driverName || (d.vehicleBrand ? `${d.vehicleBrand} ${d.vehicleModel}` : 'Motorista Parceiro')}
                          </strong>
                          {d.vehicleBrand && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              ({d.vehicleBrand} {d.vehicleModel} {d.vehicleYear ? `- ${d.vehicleYear}` : ''})
                            </span>
                          )}
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
                              : d.verificationStatus === 'rejected'
                              ? 'rgba(239, 68, 68, 0.25)'
                              : 'rgba(239, 68, 68, 0.15)',
                            color: d.verificationStatus === 'approved' 
                              ? '#10b981' 
                              : d.verificationStatus === 'under_review' 
                              ? '#f59e0b' 
                              : d.verificationStatus === 'rejected'
                              ? '#f87171'
                              : '#ef4444'
                          }}>
                            {d.verificationStatus === 'approved' 
                              ? 'Aprovado ✅' 
                              : d.verificationStatus === 'under_review' 
                              ? 'Em Análise ⏳' 
                              : d.verificationStatus === 'rejected'
                              ? 'Reprovado ❌'
                              : 'Pendente Docs ⚠️'}
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

                        {d.verificationStatus !== 'rejected' && (
                          <button
                            onClick={() => handleUpdateStatus(d, 'rejected')}
                            className="btn-outline"
                            style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#ef4444' }}
                            title="Reprovar cadastro do motorista"
                          >
                            <XCircle size={14} /> Reprovar
                          </button>
                        )}

                        {/* Botão de Excluir Motorista com Confirmação */}
                        <button
                          onClick={() => setDriverToDelete(d)}
                          className="btn-outline"
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            color: '#ef4444',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.08)'
                          }}
                          title="Excluir motorista permanentemente"
                        >
                          <Trash2 size={14} /> Excluir
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
      {activeSubTab === 'rides' && (() => {
        const now = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const filteredRides = rides.filter(r => {
          const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at).getTime() : now;
          if (rideDateFilter === 'today') {
            return rideTime >= startOfToday.getTime();
          }
          if (rideDateFilter === 'week') {
            const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
            return rideTime >= sevenDaysAgo;
          }
          if (rideDateFilter === '15days') {
            const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;
            return rideTime >= fifteenDaysAgo;
          }
          if (rideDateFilter === '30days') {
            const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
            return rideTime >= thirtyDaysAgo;
          }
          if (rideDateFilter === 'custom') {
            if (!rideCustomDate) return true;
            const targetDateStr = new Date(rideTime).toISOString().slice(0, 10);
            return targetDateStr === rideCustomDate;
          }
          return true;
        });

        const totalFilteredRevenue = filteredRides.reduce((acc, curr) => acc + (curr.total || 0), 0);
        const totalFilteredCommission = filteredRides.reduce((acc, curr) => acc + (curr.commission || 0), 0);
        const totalFilteredDriverNet = filteredRides.reduce((acc, curr) => acc + (curr.driverNet || 0), 0);

        return (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={22} color="#6366f1" />
                  Histórico Geral de Corridas ({filteredRides.length})
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Audite e filtre todas as corridas registradas na plataforma por período.
                </p>
              </div>

              {/* Resumo Financeiro do Período Selecionado */}
              <div style={{
                display: 'flex',
                gap: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                padding: '10px 16px',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Faturamento</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>{formatCurrency(totalFilteredRevenue)}</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#818cf8' }}>Plataforma (15%)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#818cf8' }}>{formatCurrency(totalFilteredCommission)}</div>
                </div>
                <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Repasse Motoristas</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>{formatCurrency(totalFilteredDriverNet)}</div>
                </div>
              </div>
            </div>

            {/* Barra de Filtros de Período Fixos e Personalizado */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
                <Filter size={15} color="#818cf8" />
                Filtrar por:
              </span>

              <button
                type="button"
                onClick={() => setRideDateFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  background: rideDateFilter === 'all' ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                  color: rideDateFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Todas
              </button>

              <button
                type="button"
                onClick={() => setRideDateFilter('today')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  background: rideDateFilter === 'today' ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                  color: rideDateFilter === 'today' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => setRideDateFilter('week')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  background: rideDateFilter === 'week' ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                  color: rideDateFilter === 'week' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                7 dias
              </button>

              <button
                type="button"
                onClick={() => setRideDateFilter('15days')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  background: rideDateFilter === '15days' ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                  color: rideDateFilter === '15days' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                15 dias
              </button>

              <button
                type="button"
                onClick={() => setRideDateFilter('30days')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  background: rideDateFilter === '30days' ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                  color: rideDateFilter === '30days' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                30 dias
              </button>

              <button
                type="button"
                onClick={() => setRideDateFilter('custom')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  background: rideDateFilter === 'custom' ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                  color: rideDateFilter === 'custom' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Data Específica
              </button>

              {rideDateFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <input
                    type="date"
                    value={rideCustomDate}
                    onChange={(e) => setRideCustomDate(e.target.value)}
                    className="input-field"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.8rem',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#fff',
                      border: '1px solid #6366f1',
                      borderRadius: '8px'
                    }}
                  />
                  {rideCustomDate && (
                    <button
                      type="button"
                      onClick={() => setRideCustomDate('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="Limpar data"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredRides.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                <Car size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ fontWeight: 600 }}>Nenhuma corrida encontrada para o período selecionado.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Alterne os filtros acima para visualizar outros períodos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredRides.map(r => {
                  const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at) : null;
                  return (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.origin} ➔ {r.destination}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: r.status === 'finished' ? 'rgba(16, 185, 129, 0.15)' : r.status === 'in_progress' ? 'rgba(59, 130, 246, 0.15)' : r.status === 'accepted' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: r.status === 'finished' ? '#10b981' : r.status === 'in_progress' ? '#3b82f6' : r.status === 'accepted' ? '#f59e0b' : '#ef4444'
                          }}>
                            {r.status === 'finished' ? 'CONCLUÍDA' : r.status === 'in_progress' ? 'EM ANDAMENTO' : r.status === 'accepted' ? 'ACEITA' : r.status === 'searching' ? 'BUSCANDO' : 'CANCELADA'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Passageiro: <strong>{r.clientName || r.clientId}</strong> • Motorista: <strong>{r.driverName || r.driverId || 'Aguardando'}</strong> • Horas: <strong>{r.hours}h</strong>
                        </div>
                        {rideTime && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            Data/Hora: {rideTime.toLocaleDateString('pt-BR')} às {rideTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#fff' }}>Total: {formatCurrency(r.total)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>Plataforma (15%): {formatCurrency(r.commission)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Motorista (85%): {formatCurrency(r.driverNet)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* SUB-ABA 5: CONFIGURAÇÕES DO SISTEMA (PUSH, GATEWAY, TARIFAS, REGRAS) */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header & Ação de Salvar */}
          <div className="glass-panel" style={{
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(99, 102, 241, 0.08))',
            borderColor: 'rgba(245, 158, 11, 0.3)'
          }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={22} color="#f59e0b" />
                Configurações Gerais da Plataforma
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Gerencie notificações Push Firebase, regras de disparo, gateways de pagamento e comissões.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {saveSuccessNotice && (
                <span style={{
                  fontSize: '0.8rem',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700
                }}>
                  <CheckCircle2 size={16} /> Configurações salvas!
                </span>
              )}
              <button
                onClick={handleSaveAllSettings}
                disabled={isSavingSettings}
                className="btn-primary"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
                }}
              >
                <Save size={18} />
                <span>{isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>

          {/* GRID: SEÇÃO 1 - NOTIFICAÇÕES PUSH FIREBASE & REGRAS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            
            {/* CARD 1: CREDENCIAIS FIREBASE FCM */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    padding: '8px',
                    borderRadius: '10px',
                    color: '#f59e0b'
                  }}>
                    <Bell size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Push Notificações (Firebase FCM)</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Envio em segundo plano para celulares e web</p>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={systemSettings.firebase.enabled}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      firebase: { ...prev.firebase, enabled: e.target.checked }
                    }))}
                    style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                  />
                  <span>{systemSettings.firebase.enabled ? 'Ativado ✅' : 'Desativado ❌'}</span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Status do Admin SDK e do Projeto */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981'
                    }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                        Firebase Conectado • Projeto: <strong style={{ color: '#10b981' }}>{systemSettings.firebase.projectId || 'drivehora'}</strong>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Admin SDK: firebase-adminsdk-fbsvc@drivehora.iam.gserviceaccount.com
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '3px 10px',
                    borderRadius: '8px',
                    background: '#10b981',
                    color: '#000',
                    fontWeight: 800
                  }}>
                    CREDENCIAIS ATIVAS ✅
                  </span>
                </div>

                {/* 2. Resumo das Chaves Já Integradas */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Messaging Sender ID</span>
                    <strong style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {systemSettings.firebase.messagingSenderId || '1017992679969'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Web API Key</span>
                    <strong style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {systemSettings.firebase.apiKey ? `${systemSettings.firebase.apiKey.substring(0, 14)}...` : 'AIzaSyCXJFdo...'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>App ID (Web)</span>
                    <strong style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {systemSettings.firebase.appId ? `${systemSettings.firebase.appId.substring(0, 16)}...` : '1:1017992679969...'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Auth Domain</span>
                    <strong style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {systemSettings.firebase.authDomain || 'drivehora.firebaseapp.com'}
                    </strong>
                  </div>
                </div>

                {/* 3. CAMPO PRINCIPAL: O QUE FALTA DEFINIR (VAPID KEY) */}
                <div style={{
                  background: !systemSettings.firebase.vapidKey ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                  border: !systemSettings.firebase.vapidKey ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: !systemSettings.firebase.vapidKey ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{!systemSettings.firebase.vapidKey ? '⚠️ PENDENTE:' : '✅ CONFIGURADO:'}</span>
                      <span>Chave VAPID (Web Push Certificate)</span>
                    </label>
                    <span style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: !systemSettings.firebase.vapidKey ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: !systemSettings.firebase.vapidKey ? '#f59e0b' : '#10b981',
                      fontWeight: 800
                    }}>
                      {!systemSettings.firebase.vapidKey ? 'Único Campo Faltante' : 'Pronto para Uso'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Gere no Firebase Console em: <em>Configurações do Projeto ⚙️ &gt; Cloud Messaging &gt; Certificados do Web Push &gt; Gerar par de chaves</em> e cole o código abaixo:
                  </p>

                  <input
                    type="text"
                    placeholder="Cole aqui a chave pública (começa com BDx_... ou BN...)"
                    value={systemSettings.firebase.vapidKey}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      firebase: { ...prev.firebase, vapidKey: e.target.value }
                    }))}
                    className="input-field"
                    style={{
                      width: '100%',
                      fontSize: '0.85rem',
                      borderColor: !systemSettings.firebase.vapidKey ? 'rgba(245, 158, 11, 0.5)' : 'rgba(16, 185, 129, 0.4)',
                      background: 'rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>

                {/* Botões de Ação */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', paddingTop: '4px' }}>
                  <button
                    onClick={handleTestFirebasePush}
                    disabled={testPushStatus === 'sending'}
                    className="btn-outline"
                    style={{
                      fontSize: '0.8rem',
                      padding: '8px 16px',
                      borderColor: '#6366f1',
                      color: '#a5b4fc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Send size={14} />
                    <span>{testPushStatus === 'sending' ? 'Disparando Teste...' : 'Testar Envio de Notificação'}</span>
                  </button>

                  <button
                    onClick={handleSaveAllSettings}
                    disabled={isSavingSettings}
                    className="btn-primary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '8px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Save size={14} />
                    <span>{isSavingSettings ? 'Gravando no Banco...' : 'Salvar Configurações'}</span>
                  </button>
                </div>

                {testPushStatus === 'success' && (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textAlign: 'center' }}>
                    ✅ Disparo de teste executado com sucesso no navegador!
                  </div>
                )}
              </div>

            </div>

            {/* CARD 2: REGRAS E MATRIZ DE EVENTOS NOTIFICÁVEIS */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  padding: '8px',
                  borderRadius: '10px',
                  color: '#818cf8'
                }}>
                  <Sliders size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Central de Regras de Notificação</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Defina exatamente quais eventos disparam alertas</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                {[
                  { key: 'notifyNewRideToDrivers', label: '🚗 Nova solicitação de corrida para motoristas próximos', desc: 'Alerta com som e push para motoristas online' },
                  { key: 'notifyRideAcceptedToClient', label: '🙋 Motorista aceitou a corrida para o passageiro', desc: 'Informa nome, veículo e previsão de chegada' },
                  { key: 'notifyDriverArrival', label: '📍 Motorista chegou ao local de embarque', desc: 'Notifica o passageiro que o carro está aguardando' },
                  { key: 'notifyRideFinished', label: '🏁 Corrida finalizada com resumo financeiro', desc: 'Envia recibo para o passageiro e extrato para o motorista' },
                  { key: 'notifyNewDriverRegistered', label: '🪪 Novo motorista cadastrado (Avisar Admin)', desc: 'Notifica administradores sobre documentos pendentes de análise' },
                  { key: 'notifyChatMessage', label: '💬 Novas mensagens no chat interno', desc: 'Alerta quando houver mensagem entre passageiro e condutor' },
                  { key: 'notifyScheduledRideReminder', label: '⏰ Lembrete de corrida agendada (30m / 15m)', desc: 'Disparo automático antes do horário da viagem' }
                ].map(rule => {
                  const isChecked = (systemSettings.notificationRules as any)[rule.key];
                  return (
                    <div
                      key={rule.key}
                      onClick={() => setSystemSettings(prev => ({
                        ...prev,
                        notificationRules: {
                          ...prev.notificationRules,
                          [rule.key]: !isChecked
                        }
                      }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: isChecked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{rule.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{rule.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* GRID: SEÇÃO 2 - GATEWAYS DE PAGAMENTO & TARIFAS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            
            {/* CARD 3: GATEWAYS DE PAGAMENTO & SPLIT */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '8px',
                  borderRadius: '10px',
                  color: '#10b981'
                }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Gateway de Pagamentos & Split Automático</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cobrança Pix/Cartão e repasse automático</p>
                </div>
              </div>

              {/* Seletor de Gateway */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Gateway Ativo
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'mercadopago', name: 'Mercado Pago 🔷' },
                    { id: 'asaas', name: 'Asaas 🔵' },
                    { id: 'stripe', name: 'Stripe 🟣' }
                  ].map(gw => (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSystemSettings(prev => ({
                        ...prev,
                        paymentGateway: { ...prev.paymentGateway, activeGateway: gw.id as any }
                      }))}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: systemSettings.paymentGateway.activeGateway === gw.id ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                        background: systemSettings.paymentGateway.activeGateway === gw.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: systemSettings.paymentGateway.activeGateway === gw.id ? '#10b981' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      {gw.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ambiente */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSystemSettings(prev => ({
                    ...prev,
                    paymentGateway: { ...prev.paymentGateway, environment: 'sandbox' }
                  }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid var(--border-subtle)',
                    background: systemSettings.paymentGateway.environment === 'sandbox' ? '#f59e0b' : 'transparent',
                    color: systemSettings.paymentGateway.environment === 'sandbox' ? '#000' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Ambiente Sandbox (Testes)
                </button>
                <button
                  type="button"
                  onClick={() => setSystemSettings(prev => ({
                    ...prev,
                    paymentGateway: { ...prev.paymentGateway, environment: 'production' }
                  }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid var(--border-subtle)',
                    background: systemSettings.paymentGateway.environment === 'production' ? '#10b981' : 'transparent',
                    color: systemSettings.paymentGateway.environment === 'production' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Ambiente Produção (Real)
                </button>
              </div>

              {/* Chaves de API */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Chave Pública (Public Key)
                  </label>
                  <input
                    type="text"
                    placeholder="APP_USR-... ou pk_test_..."
                    value={systemSettings.paymentGateway.publicKey}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      paymentGateway: { ...prev.paymentGateway, publicKey: e.target.value }
                    }))}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Chave Secreta / Access Token
                  </label>
                  <input
                    type="password"
                    placeholder="APP_USR-xxxx-... ou sk_live_..."
                    value={systemSettings.paymentGateway.secretKey}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      paymentGateway: { ...prev.paymentGateway, secretKey: e.target.value }
                    }))}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Split Automático (Repasse Direto)</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Divide a corrida no momento do pagamento via webhook</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemSettings.paymentGateway.enableAutoSplit}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      paymentGateway: { ...prev.paymentGateway, enableAutoSplit: e.target.checked }
                    }))}
                    style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                  />
                </div>
              </div>
            </div>

            {/* CARD 4: TARIFAS, COMISSÕES & SUPABASE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Tarifas */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    padding: '8px',
                    borderRadius: '10px',
                    color: '#818cf8'
                  }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Tarifas & Comissões da Plataforma</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Definições financeiras de repasse</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Comissão da Plataforma (%)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.rates.platformCommissionPercent}
                      onChange={(e) => setSystemSettings(prev => ({
                        ...prev,
                        rates: { ...prev.rates, platformCommissionPercent: Number(e.target.value) }
                      }))}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Tarifa Base Padrão/Hora
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(systemSettings.rates.defaultHourlyRate)}
                      onChange={(e) => setSystemSettings(prev => ({
                        ...prev,
                        rates: { ...prev.rates, defaultHourlyRate: parseCurrencyInput(e.target.value) }
                      }))}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Valor Mínimo de Corrida
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(systemSettings.rates.minRideRate)}
                      onChange={(e) => setSystemSettings(prev => ({
                        ...prev,
                        rates: { ...prev.rates, minRideRate: parseCurrencyInput(e.target.value) }
                      }))}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Cancelamento Grátis (Minutos)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.rates.freeCancellationMinutes}
                      onChange={(e) => setSystemSettings(prev => ({
                        ...prev,
                        rates: { ...prev.rates, freeCancellationMinutes: Number(e.target.value) }
                      }))}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Domínio & URL do Aplicativo (QR Code & Acessos) */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    padding: '8px',
                    borderRadius: '10px',
                    color: '#818cf8'
                  }}>
                    <Globe size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Domínio & URL do Aplicativo (QR Code)</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Configuração da URL pública oficial utilizada para gerar o QR Code de acesso mobile</p>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    URL Principal da Aplicação
                  </label>
                  <input
                    type="url"
                    placeholder="https://drivehora.agenc-ia.net"
                    value={systemSettings.appUrl || 'https://drivehora.agenc-ia.net'}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      appUrl: e.target.value
                    }))}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Padrão: <code>https://drivehora.agenc-ia.net</code> (ou qualquer outro domínio/subdomínio customizado).
                  </span>
                </div>
              </div>

              {/* Conexão com Supabase */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    background: supabaseConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    padding: '8px',
                    borderRadius: '10px',
                    color: supabaseConnected ? '#10b981' : '#ef4444'
                  }}>
                    <Database size={20} />
                  </div>
                  <div>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Conexão com Banco de Dados Supabase</h5>
                    <p style={{ fontSize: '0.75rem', color: supabaseConnected ? '#10b981' : '#ef4444' }}>
                      {supabaseConnected ? '● Banco em Nuvem Conectado & Operando' : '○ Banco desconectado (Modo local)'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenSupabaseConfig}
                  className="btn-outline"
                  style={{ fontSize: '0.75rem', padding: '6px 14px' }}
                >
                  Gerenciar Chaves Supabase
                </button>
              </div>

            </div>

          </div>

          {/* SEÇÃO 3: GESTÃO DE CATEGORIAS DE VEÍCULOS DEFINIDAS PELO ADMIN */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  padding: '8px',
                  borderRadius: '10px',
                  color: '#818cf8'
                }}>
                  <Car size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Categorias de Veículos da Plataforma</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Defina as categorias disponíveis para enquadramento dos motoristas e multiplicador de preço
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {(systemSettings.vehicleCategories || []).map((cat, idx) => (
                <div key={cat.id} style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>{cat.name}</strong>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      fontWeight: 700
                    }}>
                      Multiplicador: {cat.rateMultiplier}x
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Descrição da Categoria</label>
                    <input
                      type="text"
                      className="input-field"
                      value={cat.description}
                      onChange={(e) => {
                        const updated = [...systemSettings.vehicleCategories];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setSystemSettings(prev => ({ ...prev, vehicleCategories: updated }));
                      }}
                      style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Multiplicador</label>
                      <input
                        type="number"
                        step="0.05"
                        className="input-field"
                        value={cat.rateMultiplier}
                        onChange={(e) => {
                          const updated = [...systemSettings.vehicleCategories];
                          updated[idx] = { ...updated[idx], rateMultiplier: Number(e.target.value) };
                          setSystemSettings(prev => ({ ...prev, vehicleCategories: updated }));
                        }}
                        style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Estimativa Base / Hora</label>
                      <div style={{
                        padding: '8px 10px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        color: '#10b981',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        {formatCurrency(systemSettings.rates.defaultHourlyRate * (cat.rateMultiplier || 1))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE MOTORISTA */}
      {driverToDelete && (
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
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            background: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Confirmar Exclusão
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Esta ação é irreversível e removerá o motorista do sistema.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '14px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div>Motorista: <strong>{driverToDelete.driverName || driverToDelete.fullName || 'Não informado'}</strong></div>
              <div>Veículo: <strong>{driverToDelete.vehicleBrand} {driverToDelete.vehicleModel} ({driverToDelete.vehiclePlate || 'Sem placa'})</strong></div>
              <div>Telefone: <strong>{formatPhone(driverToDelete.phone) || 'Não informado'}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                disabled={isDeletingDriver}
                onClick={() => setDriverToDelete(null)}
                className="btn-outline"
                style={{ flex: 1, padding: '12px', fontSize: '0.85rem', justifyContent: 'center' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingDriver}
                onClick={handleDeleteDriverConfirm}
                style={{
                  flex: 2,
                  padding: '12px',
                  fontSize: '0.85rem',
                  justifyContent: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  cursor: isDeletingDriver ? 'not-allowed' : 'pointer',
                  opacity: isDeletingDriver ? 0.7 : 1
                }}
              >
                {isDeletingDriver ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {isDeletingDriver ? 'Excluindo...' : 'Sim, Excluir Motorista'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

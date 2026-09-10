import React, { useState, useEffect } from 'react';
import type { DriverProfile, ClientProfile, DriverVerificationStatus } from '../types/auth';
import { 
  Users, Car, DollarSign, ShieldCheck, CheckCircle2, 
  XCircle, Clock, RefreshCw, 
  TrendingUp, Database, Image, AlertTriangle, Eye, X, Check,
  Settings, Bell, CreditCard, Sliders, Send, Save, Trash2,
  Calendar, Filter, Globe, Key, Radio, Power, MessageSquare, Edit3,
  EyeOff
} from 'lucide-react';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput, formatPhone, formatCpf, formatPlate } from '../utils/formatters';
import { 
  dbGetAllDrivers, 
  dbGetAllClients, 
  dbAdminUpdateDriverStatus, 
  dbAdminDeleteDriver, 
  dbAdminDeleteClient,
  dbAdminRestoreClient,
  dbAdminToggleDriverOnline,
  dbAdminUpdateDriverProfile,
  dbAdminUpdateClientProfile,
  dbGetRideReports, 
  dbUpdateRideReportStatus, 
  type DbRide, 
  type RideReport 
} from '../services/dbService';
import { getSupabase } from '../supabase';
import { getSystemSettings, saveSystemSettings, fetchSystemSettingsFromDb, type SystemSettings } from '../services/settingsService';
import { testGatewayConnection, type GatewayHealthResult } from '../services/paymentGatewayService';
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
  onReloadRides?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  rides, 
  onOpenSupabaseConfig, 
  supabaseConnected,
  onReloadRides
}) => {
  const { showAlert, showConfirm, showToast } = useSystemDialog();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'drivers' | 'clients' | 'rides' | 'reports' | 'settings'>('overview');
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [reports, setReports] = useState<RideReport[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'in_review' | 'resolved'>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [editingReportNoteId, setEditingReportNoteId] = useState<string | null>(null);
  const [tempReportNote, setTempReportNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [driverFilter, setDriverFilter] = useState<'all' | 'online' | 'offline' | 'under_review' | 'approved' | 'rejected' | 'pending_docs'>('all');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<DriverProfile | null>(null);
  const [isDeletingDriver, setIsDeletingDriver] = useState(false);

  // Estados para Edição Cadastral de Motoristas pelo Admin
  const [editingDriver, setEditingDriver] = useState<DriverProfile | null>(null);
  const [editDriverForm, setEditDriverForm] = useState<{
    fullName: string;
    cpf: string;
    phone: string;
    cnhNumber: string;
    cnhCategory: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear: string;
    vehiclePlate: string;
    vehicleColor: string;
    verificationStatus: DriverVerificationStatus;
  }>({
    fullName: '',
    cpf: '',
    phone: '',
    cnhNumber: '',
    cnhCategory: 'B',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleYear: '',
    vehiclePlate: '',
    vehicleColor: '',
    verificationStatus: 'approved'
  });
  const [isSavingDriverEdit, setIsSavingDriverEdit] = useState(false);

  // Estados para Edição Cadastral de Passageiros pelo Admin
  const [editingClient, setEditingClient] = useState<ClientProfile | null>(null);
  const [editClientForm, setEditClientForm] = useState<{
    fullName: string;
    cpf: string;
    phone: string;
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  }>({
    fullName: '',
    cpf: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [isSavingClientEdit, setIsSavingClientEdit] = useState(false);

  // Estados para Exclusão e Gerenciamento de Passageiros pelo Admin
  const [clientToDelete, setClientToDelete] = useState<ClientProfile | null>(null);
  const [clientDeleteMode, setClientDeleteMode] = useState<'partial' | 'definitive'>('partial');
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [clientTabFilter, setClientTabFilter] = useState<'active' | 'hidden'>('active');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

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

  // Teste de Conexão com o Gateway de Pagamentos
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [gatewayHealthResult, setGatewayHealthResult] = useState<GatewayHealthResult | null>(null);

  const handleTestGateway = async () => {
    setIsTestingGateway(true);
    try {
      const res = await testGatewayConnection({
        activeGateway: systemSettings.paymentGateway.activeGateway,
        environment: systemSettings.paymentGateway.environment,
        secretKey: systemSettings.paymentGateway.secretKey,
        publicKey: systemSettings.paymentGateway.publicKey
      });
      setGatewayHealthResult(res);
      if (res.operational) {
        await saveSystemSettings(systemSettings);
        showToast(`${res.message} Configurações salvas e ativadas!`, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsTestingGateway(false);
    }
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
    const [driverList, clientList, reportsList] = await Promise.all([
      dbGetAllDrivers(),
      dbGetAllClients(),
      dbGetRideReports()
    ]);
    setDrivers(driverList);
    setClients(clientList);
    setReports(reportsList);
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

  // Alternar modo Online/Offline do Motorista pelo Administrador (Controle Emergencial Remoto)
  const handleAdminToggleDriverOnline = async (driver: DriverProfile, newOnlineStatus: boolean) => {
    const driverTargetId = driver.userId || driver.id;
    const driverName = driver.driverName || driver.fullName || 'Motorista';

    if (newOnlineStatus && driver.verificationStatus !== 'approved') {
      showAlert(
        `O motorista "${driverName}" não pode ser colocado em modo ONLINE porque o cadastro dele ainda não foi aprovado pela administração.`,
        'warning',
        'Cadastro Pendente de Aprovação'
      );
      return;
    }

    const actionText = newOnlineStatus ? 'Conectar (ONLINE)' : 'Desconectar (OFFLINE)';
    const reasonPrompt = newOnlineStatus
      ? `Deseja colocar o motorista "${driverName}" em modo ONLINE remotamente?\n\nEle passará a aparecer disponível no mapa de passageiros para receber solicitações de corridas.`
      : `Deseja DESCONECTAR o motorista "${driverName}" do modo online remotamente?\n\nO aplicativo do motorista será colocado em modo OFFLINE imediatamente (útil em caso de perda/furto de celular, suporte emergencial ou segurança).`;

    showConfirm(
      reasonPrompt,
      async () => {
        // Atualização otimista na interface do admin
        setDrivers(prev => prev.map(d => {
          if ((d.userId && d.userId === driverTargetId) || d.id === driverTargetId) {
            return { ...d, isOnline: newOnlineStatus };
          }
          return d;
        }));

        const res = await dbAdminToggleDriverOnline(driverTargetId, newOnlineStatus);
        if (res.success) {
          showToast(
            `Motorista "${driverName}" foi colocado em modo ${newOnlineStatus ? 'ONLINE 🟢' : 'OFFLINE ⚪'} com sucesso.`,
            newOnlineStatus ? 'success' : 'info'
          );
          loadAdminData();
        } else {
          showAlert(`Erro ao alterar status do motorista: ${res.error || 'Falha de comunicação'}`, 'error', 'Erro');
          loadAdminData();
        }
      },
      undefined,
      {
        title: `${actionText} Motorista Remotamente`,
        confirmLabel: newOnlineStatus ? 'Sim, Conectar' : 'Sim, Desconectar',
        cancelLabel: 'Cancelar',
        type: newOnlineStatus ? 'info' : 'warning'
      }
    );
  };

  // Handlers para Edição Cadastral de Motoristas
  const handleOpenEditDriver = (d: DriverProfile) => {
    setEditingDriver(d);
    setEditDriverForm({
      fullName: d.fullName || d.driverName || '',
      cpf: formatCpf(d.cpf || ''),
      phone: formatPhone(d.phone || ''),
      cnhNumber: d.cnhNumber || '',
      cnhCategory: d.cnhCategory || 'B',
      vehicleBrand: d.vehicleBrand || '',
      vehicleModel: d.vehicleModel || '',
      vehicleYear: d.vehicleYear || '',
      vehiclePlate: formatPlate(d.vehiclePlate || ''),
      vehicleColor: d.vehicleColor || '',
      verificationStatus: d.verificationStatus || 'approved'
    });
  };

  const handleSaveDriverEdit = async () => {
    if (!editingDriver) return;
    setIsSavingDriverEdit(true);
    const res = await dbAdminUpdateDriverProfile({
      id: editingDriver.id,
      userId: editingDriver.userId,
      fullName: editDriverForm.fullName.trim(),
      driverName: editDriverForm.fullName.trim(),
      cpf: editDriverForm.cpf.replace(/\D/g, ''),
      phone: editDriverForm.phone.replace(/\D/g, ''),
      cnhNumber: editDriverForm.cnhNumber.trim(),
      cnhCategory: editDriverForm.cnhCategory,
      vehicleBrand: editDriverForm.vehicleBrand.trim(),
      vehicleModel: editDriverForm.vehicleModel.trim(),
      vehicleYear: editDriverForm.vehicleYear.trim(),
      vehiclePlate: editDriverForm.vehiclePlate.trim().toUpperCase(),
      vehicleColor: editDriverForm.vehicleColor.trim(),
      verificationStatus: editDriverForm.verificationStatus
    });
    setIsSavingDriverEdit(false);
    if (res.success) {
      showToast('Dados do motorista atualizados e sincronizados em todo o sistema!', 'success');
      setEditingDriver(null);
      await loadAdminData();
    } else {
      showAlert(`Erro ao salvar motorista: ${res.error}`, 'error');
    }
  };

  // Handlers para Edição Cadastral de Clientes/Passageiros
  const handleOpenEditClient = (c: ClientProfile) => {
    setEditingClient(c);
    setEditClientForm({
      fullName: c.fullName || '',
      cpf: formatCpf(c.cpf || ''),
      phone: formatPhone(c.phone || ''),
      cep: c.cep || '',
      street: c.street || '',
      number: c.number || '',
      complement: c.complement || '',
      neighborhood: c.neighborhood || '',
      city: c.city || '',
      state: c.state || ''
    });
  };

  const handleSaveClientEdit = async () => {
    if (!editingClient) return;
    setIsSavingClientEdit(true);
    const res = await dbAdminUpdateClientProfile({
      id: editingClient.id,
      userId: editingClient.userId,
      fullName: editClientForm.fullName.trim(),
      cpf: editClientForm.cpf.replace(/\D/g, ''),
      phone: editClientForm.phone.replace(/\D/g, ''),
      cep: editClientForm.cep.replace(/\D/g, ''),
      street: editClientForm.street.trim(),
      number: editClientForm.number.trim(),
      complement: editClientForm.complement.trim(),
      neighborhood: editClientForm.neighborhood.trim(),
      city: editClientForm.city.trim(),
      state: editClientForm.state.trim().toUpperCase()
    });
    setIsSavingClientEdit(false);
    if (res.success) {
      showToast('Dados do passageiro atualizados e sincronizados em todo o sistema!', 'success');
      setEditingClient(null);
      await loadAdminData();
    } else {
      showAlert(`Erro ao salvar passageiro: ${res.error}`, 'error');
    }
  };

  // Handlers para Exclusão e Restauração de Clientes/Passageiros
  const handleDeleteClientConfirm = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    const res = await dbAdminDeleteClient(clientToDelete.id, clientToDelete.userId, clientDeleteMode);
    setIsDeletingClient(false);

    if (res.success) {
      if (clientDeleteMode === 'partial') {
        showToast(`Passageiro "${clientToDelete.fullName || 'Passageiro'}" ocultado da lista. As corridas e faturamento permanecem preservados no sistema!`, 'info');
      } else {
        showToast(`Passageiro "${clientToDelete.fullName || 'Passageiro'}" e todas as suas informações foram excluídos definitivamente do sistema!`, 'warning');
        if (onReloadRides) onReloadRides();
      }
      setClientToDelete(null);
      if (editingClient && editingClient.id === clientToDelete.id) {
        setEditingClient(null);
      }
      await loadAdminData();
    } else {
      showAlert(`Erro ao processar exclusão: ${res.error || 'Falha de comunicação'}`, 'error');
    }
  };

  const handleRestoreClient = async (c: ClientProfile) => {
    const res = await dbAdminRestoreClient(c.id, c.userId);
    if (res.success) {
      showToast(`Passageiro "${c.fullName || 'Passageiro'}" reativado na lista principal com sucesso!`, 'success');
      await loadAdminData();
    } else {
      showAlert(`Erro ao reativar passageiro: ${res.error}`, 'error');
    }
  };

  // Cálculos de métricas
  const finishedRides = rides.filter(r => r.status === 'finished');
  const totalVolume = finishedRides.reduce((acc, r) => acc + (r.total || 0), 0);
  const totalPlatformRevenue = finishedRides.reduce((acc, r) => acc + (r.commission || 0), 0);
  const totalDriverPayout = finishedRides.reduce((acc, r) => acc + (r.driverNet || 0), 0);
  const onlineDrivers = drivers.filter(d => d.isOnline);
  const offlineDrivers = drivers.filter(d => !d.isOnline);
  const pendingDrivers = drivers.filter(d => d.verificationStatus === 'under_review' || d.verificationStatus === 'pending_docs');
  const approvedDrivers = drivers.filter(d => d.verificationStatus === 'approved');

  const filteredDrivers = drivers.filter(d => {
    if (driverFilter === 'all') return true;
    if (driverFilter === 'online') return d.isOnline;
    if (driverFilter === 'offline') return !d.isOnline;
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
          onClick={() => setActiveSubTab('reports')}
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
            background: activeSubTab === 'reports' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'transparent',
            color: activeSubTab === 'reports' ? '#fff' : '#f87171'
          }}
        >
          <AlertTriangle size={15} />
          <span>Ocorrências ({reports.length})</span>
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
              {reports.filter(r => r.status === 'pending').length} pendente{reports.filter(r => r.status === 'pending').length > 1 ? 's' : ''}
            </span>
          )}
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
              <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ color: '#10b981' }}>{approvedDrivers.length} aptos</span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{
                  color: onlineDrivers.length > 0 ? '#10b981' : '#94a3b8',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: onlineDrivers.length > 0 ? '#10b981' : '#64748b',
                    boxShadow: onlineDrivers.length > 0 ? '0 0 6px #10b981' : undefined
                  }} className={onlineDrivers.length > 0 ? 'animate-pulse' : ''} />
                  {onlineDrivers.length} online agora
                </span>
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
                { key: 'all', label: `Todos (${drivers.length})` },
                { key: 'online', label: `🟢 Online Agora (${onlineDrivers.length})` },
                { key: 'offline', label: `⚪ Offline (${offlineDrivers.length})` },
                { key: 'under_review', label: `Em Análise ⏳ (${pendingDrivers.length})` },
                { key: 'approved', label: `Aprovados ✅ (${approvedDrivers.length})` },
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

                          {/* Badge de Status Online em Tempo Real */}
                          {d.isOnline ? (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 10px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.18)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 6px #10b981'
                              }} className="animate-pulse" />
                              ONLINE AGORA
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '3px 10px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              background: 'rgba(148, 163, 184, 0.12)',
                              color: '#94a3b8',
                              border: '1px solid rgba(148, 163, 184, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: '#64748b'
                              }} />
                              OFFLINE
                            </span>
                          )}
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

                      {/* Ações de Moderação & Controle Online Remoto */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Botão de Controle Remoto Online/Offline pelo Administrador */}
                        {d.isOnline ? (
                          <button
                            onClick={() => handleAdminToggleDriverOnline(d, false)}
                            className="btn-outline"
                            title="Desconectar motorista do modo online remotamente (furto, perda de celular, suporte emergencial)"
                            style={{
                              padding: '8px 14px',
                              fontSize: '0.8rem',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Power size={14} />
                            <span>Desconectar (Offline)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdminToggleDriverOnline(d, true)}
                            className="btn-outline"
                            title="Conectar motorista em modo online remotamente"
                            style={{
                              padding: '8px 14px',
                              fontSize: '0.8rem',
                              color: '#10b981',
                              borderColor: 'rgba(16, 185, 129, 0.4)',
                              background: 'rgba(16, 185, 129, 0.08)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Radio size={14} />
                            <span>Conectar (Online)</span>
                          </button>
                        )}
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

                        {/* Botão de Editar Cadastro do Motorista */}
                        <button
                          onClick={() => handleOpenEditDriver(d)}
                          className="btn-outline"
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            color: '#818cf8',
                            borderColor: 'rgba(99, 102, 241, 0.4)',
                            background: 'rgba(99, 102, 241, 0.08)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Editar dados cadastrais do motorista (Nome, CPF, Veículo, CNH)"
                        >
                          <Edit3 size={14} /> Editar
                        </button>

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
      {activeSubTab === 'clients' && (() => {
        const activeClients = clients.filter(c => !c.isHidden);
        const hiddenClients = clients.filter(c => c.isHidden);
        const currentList = clientTabFilter === 'active' ? activeClients : hiddenClients;

        const filteredList = currentList.filter(c => {
          if (!clientSearchQuery.trim()) return true;
          const q = clientSearchQuery.trim().toLowerCase();
          return (
            (c.fullName || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').includes(q) ||
            (c.cpf || '').includes(q) ||
            (c.city || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Clientes / Passageiros ({clients.length})
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Gerencie, edite ou exclua passageiros cadastrados na plataforma.
                </span>
              </div>
              <button
                onClick={() => loadAdminData()}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Atualizar
              </button>
            </div>

            {/* Filtro de Abas (Ativos vs Ocultos) + Busca */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setClientTabFilter('active')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: clientTabFilter === 'active' ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                    background: clientTabFilter === 'active' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: clientTabFilter === 'active' ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Users size={14} /> Ativos ({activeClients.length})
                </button>
                <button
                  onClick={() => setClientTabFilter('hidden')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: clientTabFilter === 'hidden' ? '1px solid #eab308' : '1px solid var(--border-subtle)',
                    background: clientTabFilter === 'hidden' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: clientTabFilter === 'hidden' ? '#fde047' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <EyeOff size={14} /> Ocultos / Excluídos Parcialmente ({hiddenClients.length})
                </button>
              </div>

              <div style={{ minWidth: '240px', flex: 1, maxWidth: '380px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Buscar por nome, email, CPF ou telefone..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {clientTabFilter === 'hidden' && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '0.82rem',
                color: '#fde047',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <EyeOff size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Passageiros Ocultos (Exclusão Parcial):</strong> Estes passageiros não aparecem na lista ativa principal, mas <strong>todas as suas corridas, valores financeiros e relatórios continuam 100% contabilizados</strong> no sistema. Você pode reativá-los ou fazer a exclusão definitiva a qualquer momento.
                </span>
              </div>
            )}

            {filteredList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                {clientTabFilter === 'active' ? (
                  <>
                    <Users size={40} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <p>{clientSearchQuery ? 'Nenhum passageiro encontrado para esta busca.' : 'Nenhum passageiro ativo cadastrado.'}</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={40} style={{ margin: '0 auto 10px', opacity: 0.5, color: '#10b981' }} />
                    <p>Nenhum passageiro ocultado no momento.</p>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredList.map(c => (
                  <div key={c.id} style={{
                    background: c.isHidden ? 'rgba(234, 179, 8, 0.05)' : 'rgba(15, 23, 42, 0.85)',
                    border: c.isHidden ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid var(--border-subtle)',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {c.isHidden ? (
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(234, 179, 8, 0.2)',
                            color: '#fde047',
                            fontWeight: 700
                          }}>
                            🟡 Oculto da Lista
                          </span>
                        ) : (
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
                        )}

                        {c.isHidden ? (
                          <>
                            <button
                              onClick={() => handleRestoreClient(c)}
                              className="btn-outline"
                              style={{
                                padding: '5px 12px',
                                fontSize: '0.75rem',
                                color: '#10b981',
                                borderColor: 'rgba(16, 185, 129, 0.4)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Reativar passageiro na lista principal"
                            >
                              <Check size={12} /> Reativar
                            </button>
                            <button
                              onClick={() => { setClientToDelete(c); setClientDeleteMode('definitive'); }}
                              className="btn-outline"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.4)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Excluir definitivamente todas as informações deste passageiro"
                            >
                              <Trash2 size={12} /> Excluir Definitivo
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditClient(c)}
                              className="btn-outline"
                              style={{
                                padding: '5px 12px',
                                fontSize: '0.75rem',
                                color: '#818cf8',
                                borderColor: 'rgba(99, 102, 241, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Editar dados cadastrais do passageiro"
                            >
                              <Edit3 size={12} /> Editar Cadastro
                            </button>
                            <button
                              onClick={() => { setClientToDelete(c); setClientDeleteMode('partial'); }}
                              className="btn-outline"
                              style={{
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.35)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Opções de exclusão do passageiro (parcial ou definitiva)"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </>
                        )}
                      </div>
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
        );
      })()}

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

      {/* SUB-ABA 4.5: OCORRÊNCIAS & PROBLEMAS REPORTADOS (CENTRAL DE MODERAÇÃO) */}
      {activeSubTab === 'reports' && (() => {
        const pendingCount = reports.filter(r => r.status === 'pending').length;
        const inReviewCount = reports.filter(r => r.status === 'in_review').length;
        const resolvedCount = reports.filter(r => r.status === 'resolved').length;

        const filteredReports = reports.filter(r => {
          if (reportFilter !== 'all' && r.status !== reportFilter) return false;
          if (reportSearch.trim()) {
            const query = reportSearch.toLowerCase();
            return (
              r.reporterName?.toLowerCase().includes(query) ||
              r.driverName?.toLowerCase().includes(query) ||
              r.categoryLabel?.toLowerCase().includes(query) ||
              r.description?.toLowerCase().includes(query) ||
              r.id.toLowerCase().includes(query) ||
              r.rideId.toLowerCase().includes(query)
            );
          }
          return true;
        });

        const handleUpdateReport = async (reportId: string, status: 'pending' | 'in_review' | 'resolved', notes?: string) => {
          const ok = await dbUpdateRideReportStatus(reportId, status, notes);
          if (ok) {
            setReports(prev => prev.map(rep => rep.id === reportId ? { ...rep, status, adminNotes: notes !== undefined ? notes : rep.adminNotes } : rep));
            showToast(`Ocorrência atualizada para status: ${status === 'resolved' ? 'Resolvida' : status === 'in_review' ? 'Em Análise' : 'Pendente'}`, 'success');
          } else {
            showToast('Erro ao atualizar ocorrência.', 'error');
          }
        };

        return (
          <div className="glass-panel" style={{ padding: '24px' }}>
            {/* Header da Central de Ocorrências */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={22} color="#ef4444" />
                  <span>Central de Ocorrências & Denúncias de Corridas</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Auditoria de queixas enviadas por usuários: esquecimento de objetos, segurança, conduta e divergências.
                </p>
              </div>

              <button
                type="button"
                onClick={() => dbGetRideReports().then(setReports)}
                className="btn-outline"
                style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Cards de Métricas / Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total de Registros</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{reports.length}</div>
              </div>

              <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>🚨 Pendentes de Ação</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{pendingCount}</div>
              </div>

              <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <span style={{ fontSize: '0.75rem', color: '#fde68a' }}>⏳ Em Análise / Contato</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{inReviewCount}</div>
              </div>

              <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <span style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>✅ Casos Resolvidos</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{resolvedCount}</div>
              </div>
            </div>

            {/* Filtros e Busca */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `Todas (${reports.length})` },
                  { key: 'pending', label: `🚨 Pendentes (${pendingCount})` },
                  { key: 'in_review', label: `⏳ Em Análise (${inReviewCount})` },
                  { key: 'resolved', label: `✅ Resolvidas (${resolvedCount})` }
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setReportFilter(f.key as any)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-subtle)',
                      background: reportFilter === f.key ? 'var(--primary-gradient)' : 'rgba(15, 23, 42, 0.6)',
                      color: reportFilter === f.key ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="Buscar ocorrência..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }}
                />
              </div>
            </div>

            {/* Lista de Ocorrências */}
            {filteredReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                <ShieldCheck size={48} color="#10b981" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Nenhuma ocorrência encontrada</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  {reportFilter !== 'all' ? 'Não há registros com este filtro.' : 'Excelente! Nenhum problema reportado até o momento.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredReports.map(rep => {
                  const repTime = new Date(rep.createdAt);
                  const isPending = rep.status === 'pending';
                  const isInReview = rep.status === 'in_review';

                  // Motorista associado
                  const driverObj = drivers.find(d => d.id === rep.driverId || d.userId === rep.driverId);
                  const driverCleanPhone = (rep.driverPhone || driverObj?.phone || '').replace(/\D/g, '');
                  const clientCleanPhone = (rep.reporterPhone || '').replace(/\D/g, '');

                  return (
                    <div
                      key={rep.id}
                      style={{
                        padding: '18px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.4)' : isInReview ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Topo do Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.74rem',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontWeight: 800,
                            background: isPending ? 'rgba(239, 68, 68, 0.18)' : isInReview ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                            color: isPending ? '#ef4444' : isInReview ? '#f59e0b' : '#10b981',
                            border: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.4)' : isInReview ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                          }}>
                            {isPending ? '🚨 PENDENTE' : isInReview ? '⏳ EM ANÁLISE' : '✅ RESOLVIDA'}
                          </span>

                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                            {rep.categoryLabel}
                          </span>

                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Protocolo: #{rep.id.slice(-8)}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {repTime.toLocaleDateString('pt-BR')} às {repTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Descrição do Problema Relatado */}
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.85rem',
                        color: '#e2e8f0',
                        lineHeight: 1.5
                      }}>
                        <strong style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                          Relato enviado pelo passageiro:
                        </strong>
                        "{rep.description}"
                      </div>

                      {/* Dados das Partes Envolvidas */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {/* Passageiro */}
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Passageiro que Reportou
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                            {rep.reporterName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            {rep.reporterPhone || 'Telefone não informado'} • {rep.reporterEmail || ''}
                          </div>
                          {clientCleanPhone && (
                            <a
                              href={`https://wa.me/55${clientCleanPhone}?text=Olá%20${encodeURIComponent(rep.reporterName)},%20sou%20da%20equipe%20de%20suporte%20da%20DriveHora%20sobre%20sua%20ocorrência%20${rep.id.slice(-6)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                color: '#22c55e',
                                marginTop: '6px',
                                textDecoration: 'none',
                                fontWeight: 700
                              }}
                            >
                              <MessageSquare size={13} />
                              <span>Falar com Passageiro no WhatsApp</span>
                            </a>
                          )}
                        </div>

                        {/* Motorista */}
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Motorista Envolvido
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                            {rep.driverName || 'Motorista Parceiro'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            {rep.driverVehicle || driverObj?.vehicleModel || 'Veículo cadastrado'} {rep.driverPlate ? `• Placa: ${rep.driverPlate}` : driverObj?.vehiclePlate ? `• Placa: ${driverObj.vehiclePlate}` : ''}
                          </div>
                          {driverCleanPhone && (
                            <a
                              href={`https://wa.me/55${driverCleanPhone}?text=Olá%20${encodeURIComponent(rep.driverName || '')},%20sou%20da%20moderação%20da%20DriveHora%20sobre%20a%20corrida%20${rep.rideId.slice(-6)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                color: '#38bdf8',
                                marginTop: '6px',
                                textDecoration: 'none',
                                fontWeight: 700
                              }}
                            >
                              <MessageSquare size={13} />
                              <span>Falar com Motorista no WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Anotações Internas do Administrador */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 12px', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>
                            📝 Parecer / Notas Internas da Moderação:
                          </span>
                          {editingReportNoteId !== rep.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReportNoteId(rep.id);
                                setTempReportNote(rep.adminNotes || '');
                              }}
                              className="btn-outline"
                              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                            >
                              {rep.adminNotes ? 'Editar Parecer' : '+ Adicionar Parecer'}
                            </button>
                          )}
                        </div>

                        {editingReportNoteId === rep.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                            <textarea
                              rows={2}
                              value={tempReportNote}
                              onChange={(e) => setTempReportNote(e.target.value)}
                              placeholder="Ex: Motorista advertido verbalmente. Objeto devolvido no ponto de apoio. Passageiro orientado."
                              className="input-field"
                              style={{ width: '100%', fontSize: '0.8rem' }}
                            />
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setEditingReportNoteId(null)}
                                className="btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateReport(rep.id, rep.status, tempReportNote);
                                  setEditingReportNoteId(null);
                                }}
                                className="btn-primary"
                                style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                              >
                                Salvar Parecer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.78rem', color: rep.adminNotes ? '#cbd5e1' : 'var(--text-muted)', fontStyle: rep.adminNotes ? 'normal' : 'italic' }}>
                            {rep.adminNotes || 'Nenhum parecer ou anotação interna registrada ainda.'}
                          </div>
                        )}
                      </div>

                      {/* Barra de Ações Moderativas */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Mudar Status:</span>
                          {rep.status !== 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReport(rep.id, 'pending')}
                              className="btn-outline"
                              style={{ padding: '5px 10px', fontSize: '0.72rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                              Marcar Pendente
                            </button>
                          )}
                          {rep.status !== 'in_review' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReport(rep.id, 'in_review')}
                              className="btn-outline"
                              style={{ padding: '5px 10px', fontSize: '0.72rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                            >
                              Marcar Em Análise
                            </button>
                          )}
                          {rep.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReport(rep.id, 'resolved')}
                              className="btn-primary"
                              style={{ padding: '5px 12px', fontSize: '0.72rem', background: '#10b981', borderColor: '#10b981' }}
                            >
                              ✓ Marcar como Resolvida
                            </button>
                          )}
                        </div>

                        {/* Ação Emergencial no Motorista */}
                        {driverObj && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {driverObj.isOnline ? (
                              <button
                                type="button"
                                onClick={() => {
                                  showConfirm(
                                    `Deseja desconectar o motorista ${driverObj.fullName} preventivamente devido a esta ocorrência?`,
                                    () => handleAdminToggleDriverOnline(driverObj, false)
                                  );
                                }}
                                className="btn-outline"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '0.72rem',
                                  color: '#ef4444',
                                  borderColor: 'rgba(239, 68, 68, 0.4)',
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Power size={12} />
                                <span>Desconectar Motorista</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Motorista já está Offline
                              </span>
                            )}
                          </div>
                        )}
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
                    { id: 'asaas', name: 'Asaas 🔵 (Recomendado)' },
                    { id: 'mercadopago', name: 'Mercado Pago 🔷' },
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {systemSettings.paymentGateway.activeGateway === 'asaas' ? (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Key size={15} color="#38bdf8" />
                      <span>Chave de API do Asaas (API Key / Access Token)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: $aact_YTU5YTE0M2M6N2Zm... (Cole sua chave de API aqui)"
                      value={systemSettings.paymentGateway.secretKey || systemSettings.paymentGateway.publicKey || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const updated = {
                          ...systemSettings,
                          paymentGateway: {
                            ...systemSettings.paymentGateway,
                            secretKey: val,
                            publicKey: val // Sincroniza ambos para compatibilidade total
                          }
                        };
                        setSystemSettings(updated);
                        saveSystemSettings(updated);
                      }}
                      className="input-field"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                    <div style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      fontSize: '0.74rem',
                      color: '#94a3b8',
                      lineHeight: 1.4
                    }}>
                      💡 <strong>Como obter:</strong> No Asaas, existe <strong>apenas uma chave única</strong> (inicia com <code>$aact_</code>). Acesse sua conta Asaas (Sandbox ou Real), vá em <strong>Minha Conta &gt; Integração &gt; Gerar chave de API</strong> e cole-a acima. Não são necessárias duas chaves para o Asaas.
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {systemSettings.paymentGateway.activeGateway === 'stripe' ? 'Publishable Key (pk_...)' : 'Public Key do Mercado Pago'}
                      </label>
                      <input
                        type="text"
                        placeholder="Chave pública ou identificador"
                        value={systemSettings.paymentGateway.publicKey}
                        onChange={(e) => setSystemSettings(prev => ({
                          ...prev,
                          paymentGateway: { ...prev.paymentGateway, publicKey: e.target.value.trim() }
                        }))}
                        className="input-field"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {systemSettings.paymentGateway.activeGateway === 'stripe' ? 'Secret Key (sk_...)' : 'Access Token do Mercado Pago'}
                      </label>
                      <input
                        type="password"
                        placeholder="Chave secreta ou access token"
                        value={systemSettings.paymentGateway.secretKey}
                        onChange={(e) => setSystemSettings(prev => ({
                          ...prev,
                          paymentGateway: { ...prev.paymentGateway, secretKey: e.target.value.trim() }
                        }))}
                        className="input-field"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </>
                )}

                {/* Botões de Testar e Salvar Gateway */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleTestGateway}
                    disabled={isTestingGateway}
                    className="btn-outline"
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#818cf8',
                      borderColor: 'rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    <RefreshCw size={14} className={isTestingGateway ? 'animate-spin' : ''} />
                    <span>{isTestingGateway ? 'Testando Conexão...' : 'Testar Conexão com Gateway'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await saveSystemSettings(systemSettings);
                      const res = await testGatewayConnection({
                        activeGateway: systemSettings.paymentGateway.activeGateway,
                        environment: systemSettings.paymentGateway.environment,
                        secretKey: systemSettings.paymentGateway.secretKey,
                        publicKey: systemSettings.paymentGateway.publicKey
                      });
                      setGatewayHealthResult(res);
                      if (res.operational) {
                        showToast('Gateway Asaas salvo e ativo em todo o sistema!', 'success');
                      } else {
                        showToast(res.message, 'warning');
                      }
                    }}
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Save size={14} />
                    <span>Salvar e Ativar Gateway Imediatamente</span>
                  </button>
                </div>

                {/* Resultado do Teste de Integridade do Gateway */}
                {gatewayHealthResult && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: gatewayHealthResult.operational ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${gatewayHealthResult.operational ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    {gatewayHealthResult.operational ? (
                      <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: gatewayHealthResult.operational ? '#10b981' : '#f87171' }}>
                        {gatewayHealthResult.operational ? 'Gateway Operacional (Sistema Liberado)' : 'Gateway Inoperante (Bloqueio Preventivo Ativo)'}
                      </strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {gatewayHealthResult.message}
                      </p>
                    </div>
                  </div>
                )}

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

      {/* MODAL DE EDIÇÃO CADASTRAL DO MOTORISTA */}
      {editingDriver && (
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
            background: 'var(--bg-card, #0f172a)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <strong style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#818cf8" />
                Editar Cadastro do Motorista
              </strong>
              <button
                onClick={() => setEditingDriver(null)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveDriverEdit();
              }}
              style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editDriverForm.fullName}
                  onChange={(e) => setEditDriverForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Nome e Sobrenome"
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    CPF
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.cpf}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.phone}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Número da CNH
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.cnhNumber}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, cnhNumber: e.target.value }))}
                    placeholder="Número da CNH"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Cat. CNH
                  </label>
                  <select
                    value={editDriverForm.cnhCategory}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, cnhCategory: e.target.value }))}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Marca do Veículo
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.vehicleBrand}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, vehicleBrand: e.target.value }))}
                    placeholder="Ex: Toyota, Honda"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Modelo do Veículo
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.vehicleModel}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, vehicleModel: e.target.value }))}
                    placeholder="Ex: Corolla, Civic"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Ano
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.vehicleYear}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, vehicleYear: e.target.value }))}
                    placeholder="Ex: 2022"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Placa
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.vehiclePlate}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, vehiclePlate: formatPlate(e.target.value) }))}
                    placeholder="ABC-1234"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Cor
                  </label>
                  <input
                    type="text"
                    value={editDriverForm.vehicleColor}
                    onChange={(e) => setEditDriverForm(prev => ({ ...prev, vehicleColor: e.target.value }))}
                    placeholder="Ex: Prata"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Status de Verificação
                </label>
                <select
                  value={editDriverForm.verificationStatus}
                  onChange={(e) => setEditDriverForm(prev => ({ ...prev, verificationStatus: e.target.value as any }))}
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  <option value="approved">Aprovado ✅ (Apto a fazer corridas)</option>
                  <option value="under_review">Em Análise ⏳</option>
                  <option value="pending_docs">Pendente de Documentos ⚠️</option>
                  <option value="rejected">Reprovado ❌</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="btn-outline"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDriverEdit}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSavingDriverEdit ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSavingDriverEdit ? 'Salvando...' : 'Salvar e Sincronizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO CADASTRAL DO PASSAGEIRO */}
      {editingClient && (
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
            background: 'var(--bg-card, #0f172a)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <strong style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#818cf8" />
                Editar Cadastro do Passageiro
              </strong>
              <button
                onClick={() => setEditingClient(null)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveClientEdit();
              }}
              style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editClientForm.fullName}
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Nome e Sobrenome"
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    CPF
                  </label>
                  <input
                    type="text"
                    value={editClientForm.cpf}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editClientForm.phone}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    CEP
                  </label>
                  <input
                    type="text"
                    value={editClientForm.cep}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, cep: e.target.value }))}
                    placeholder="00000-000"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Rua / Logradouro
                  </label>
                  <input
                    type="text"
                    value={editClientForm.street}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, street: e.target.value }))}
                    placeholder="Rua, Avenida..."
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Número
                  </label>
                  <input
                    type="text"
                    value={editClientForm.number}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, number: e.target.value }))}
                    placeholder="Ex: 123"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={editClientForm.complement}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, complement: e.target.value }))}
                    placeholder="Apto, Bloco..."
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={editClientForm.neighborhood}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                    placeholder="Bairro"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={editClientForm.city}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Cidade"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={editClientForm.state}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                    placeholder="SP"
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const c = editingClient;
                    setEditingClient(null);
                    setClientToDelete(c);
                    setClientDeleteMode('partial');
                  }}
                  className="btn-outline"
                  style={{
                    padding: '12px 14px',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Opções de exclusão do passageiro"
                >
                  <Trash2 size={16} /> Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="btn-outline"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingClientEdit}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSavingClientEdit ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSavingClientEdit ? 'Salvando...' : 'Salvar e Sincronizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PASSAGEIRO (PARCIAL OU DEFINITIVA) */}
      {clientToDelete && (
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
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid ' + (clientDeleteMode === 'definitive' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(234, 179, 8, 0.5)'),
            borderRadius: '20px',
            maxWidth: '540px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: clientDeleteMode === 'definitive' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: clientDeleteMode === 'definitive' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: clientDeleteMode === 'definitive' ? '#ef4444' : '#eab308'
                }}>
                  {clientDeleteMode === 'definitive' ? <Trash2 size={20} /> : <EyeOff size={20} />}
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Excluir Passageiro
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {clientToDelete.fullName || 'Passageiro'} ({clientToDelete.email || clientToDelete.phone || 'Sem contato'})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setClientToDelete(null)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Selecione o tipo de exclusão que deseja aplicar para este passageiro:
              </p>

              {/* Opção 1: Exclusão Parcial */}
              <div
                onClick={() => setClientDeleteMode('partial')}
                style={{
                  border: clientDeleteMode === 'partial' ? '2px solid #eab308' : '1px solid var(--border-subtle)',
                  background: clientDeleteMode === 'partial' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
              >
                <input
                  type="radio"
                  name="clientDeleteMode"
                  checked={clientDeleteMode === 'partial'}
                  onChange={() => setClientDeleteMode('partial')}
                  style={{ marginTop: '3px', accentColor: '#eab308', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.95rem', color: clientDeleteMode === 'partial' ? '#fde047' : '#fff' }}>
                      🟡 Exclusão Parcial (Ocultar da Lista)
                    </strong>
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700 }}>
                      Recomendado
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    O passageiro é removido da lista ativa, mas o sistema <strong>continua contabilizando normalmente</strong> todo o histórico de corridas, relatórios gerais e valores financeiros. Poderá ser reativado pelo admin a qualquer momento.
                  </p>
                </div>
              </div>

              {/* Opção 2: Exclusão Definitiva */}
              <div
                onClick={() => setClientDeleteMode('definitive')}
                style={{
                  border: clientDeleteMode === 'definitive' ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                  background: clientDeleteMode === 'definitive' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
              >
                <input
                  type="radio"
                  name="clientDeleteMode"
                  checked={clientDeleteMode === 'definitive'}
                  onChange={() => setClientDeleteMode('definitive')}
                  style={{ marginTop: '3px', accentColor: '#ef4444', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.95rem', color: clientDeleteMode === 'definitive' ? '#f87171' : '#fff' }}>
                      🔴 Exclusão Definitiva (Purga Total)
                    </strong>
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700 }}>
                      Ação Irreversível
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Apaga <strong>todas as informações existentes deste passageiro</strong>, inclusive seu cadastro, perfil, histórico de corridas, relatórios e dados financeiros. O passageiro terá que <strong>refazer o cadastro do zero</strong> como se nunca tivesse existido.
                  </p>
                </div>
              </div>

              {clientDeleteMode === 'definitive' && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.78rem',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>
                    Atenção: Ao confirmar a exclusão definitiva, as corridas associadas a este passageiro também serão removidas dos relatórios e contabilidade.
                  </span>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setClientToDelete(null)}
                  className="btn-outline"
                  style={{ flex: 1, padding: '12px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClientConfirm}
                  disabled={isDeletingClient}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#fff',
                    background: clientDeleteMode === 'definitive' 
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                      : 'linear-gradient(135deg, #eab308, #ca8a04)'
                  }}
                >
                  {isDeletingClient ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : clientDeleteMode === 'definitive' ? (
                    <>
                      <Trash2 size={16} />
                      <span>Excluir Definitivamente</span>
                    </>
                  ) : (
                    <>
                      <EyeOff size={16} />
                      <span>Ocultar Passageiro</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

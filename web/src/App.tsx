import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, Clock, DollarSign, Navigation, ShieldCheck, 
  Smartphone, Users, RefreshCw, CheckCircle2, 
  Radio, Award, PlayCircle, Compass, Database, 
  X, Check, LogOut, MapPin, Crown, AlertTriangle, UserCheck,
  BellRing, Volume2, VolumeX, Ban, AlertOctagon, Heart, ShieldAlert, RotateCcw,
  Filter, Archive, ArchiveRestore, Trash2, CreditCard,
  ChevronDown, ChevronUp, AlertCircle, Headphones,
  Calendar, Zap, Share2, Copy, Sun, Moon, Eye, EyeOff
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { getSupabase, getSupabaseCredentials, saveSupabaseCredentials, initGlobalSupabaseConfig } from './supabase';
import type { UserProfile, ClientProfile, DriverProfile, DriverPublicProfile } from './types/auth';
import { isSuperAdminEmail } from './types/auth';
import { LoginPage } from './components/LoginPage';
import { ClientOnboarding } from './components/ClientOnboarding';
import { DriverOnboarding } from './components/DriverOnboarding';
import { AdminDashboard } from './components/AdminDashboard';
import { NearbyDriversMap } from './components/NearbyDriversMap';
import { LiveRideTrackerMap } from './components/LiveRideTrackerMap';
import { DriverProfileModal } from './components/DriverProfileModal';
import { FavoriteDriversList } from './components/FavoriteDriversList';
import { ReportIssueModal } from './components/ReportIssueModal';
import { ClientProfileManager } from './components/ClientProfileManager';
import { RatingModal } from './components/RatingModal';
import { DriverCancelModal } from './components/DriverCancelModal';
import { getUserWallet, addWalletCredit, addWalletDebit, type UserWallet } from './services/walletService';
import { dbCreateRideReport } from './services/dbService';
import { GpsNavigationModal } from './components/GpsNavigationModal';
import { getDriverPreferredGps, launchNavigationApp } from './services/gpsNavigationService';
import { sendAppNotification, requestNotificationPermission } from './services/soundAndNotificationService';
import { getCurrentPosition, reverseGeocode, searchAddressPlaces, geocodeAddress } from './services/gpsService';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from './utils/formatters';
import { 
  dbGetClientProfile, dbGetDriverProfile, dbGetAllDrivers,
  dbCreateRide, dbUpdateRide, dbCancelRide, dbAcknowledgeRide, dbUpdateDriverOnlineStatus, dbUpdateDriverLocation,
  dbGetFavoriteDriverIds, dbToggleFavoriteDriver, dbSaveUserDeviceToken, dbCheckUserSession,
  dbCreditDriverCancellationFee,
  type DbRide 
} from './services/dbService';
import { requestWebPushToken, onForegroundMessage } from './services/firebase';
import { getSystemSettings, fetchSystemSettingsFromDb, type SystemSettings } from './services/settingsService';
import { testGatewayConnection, createPixPayment, simulateAsaasPayment, type PaymentMethodType } from './services/paymentGatewayService';
import { getLocalSessionToken, clearLocalSessionToken } from './utils/sessionHelper';
import { useSystemDialog } from './components/SystemDialog';

export function App() {
  const { showAlert, showConfirm, showToast } = useSystemDialog();
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(getSystemSettings);

  // Tema da Interface: 'dark' (Escuro Futurista) vs 'light' (Claro Clean Modern SaaS)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('drivehora_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark'; // Padrão seguro para preservar a experiência atual
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
    try {
      localStorage.setItem('drivehora_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };
  
  // Autenticação & Sessão (Inicialização imediata síncrona para evitar tela em branco na primeira chamada)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('drivehora_current_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (isSuperAdminEmail(parsed.email)) parsed.isAdmin = true;
      return parsed;
    } catch {
      return null;
    }
  });

  const isUserAdmin = Boolean(currentUser?.isAdmin || currentUser?.role === 'admin' || isSuperAdminEmail(currentUser?.email));

  const [activeTab, setActiveTab] = useState<'client' | 'driver' | 'admin' | 'mobile'>(() => {
    try {
      const saved = localStorage.getItem('drivehora_current_user');
      if (!saved) return 'client';
      const parsed = JSON.parse(saved);
      if (isSuperAdminEmail(parsed.email) || parsed.role === 'admin' || parsed.isAdmin) return 'admin';
      if (parsed.role === 'driver') return 'driver';
      return 'client';
    } catch {
      return 'client';
    }
  });

  const [rides, setRides] = useState<DbRide[]>([]);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  
  // Lista de IDs de corridas arquivadas pelo cliente
  const [archivedRideIds, setArchivedRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('drivehora_archived_rides');
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem('drivehora_hidden_rides');
      return legacy ? JSON.parse(legacy) : [];
    } catch {
      return [];
    }
  });

  // Lista de IDs de corridas excluídas visualmente pelo passageiro (preservadas no banco para relatórios do Admin)
  const [deletedRideIdsForClient, setDeletedRideIdsForClient] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('drivehora_deleted_rides');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Aba ativa na tela de Histórico: 'active' (principais) ou 'archived' (arquivadas)
  const [historyViewTab, setHistoryViewTab] = useState<'active' | 'archived'>('active');

  // Mover corrida para arquivadas
  const handleArchiveRide = (rideId: string) => {
    setArchivedRideIds(prev => {
      const next = [...new Set([...prev, rideId])];
      localStorage.setItem('drivehora_archived_rides', JSON.stringify(next));
      return next;
    });
    if (currentRideId === rideId) {
      setCurrentRideId(null);
    }
    showToast('Corrida arquivada com sucesso! Você pode acessá-la na aba Arquivadas.', 'info');
  };

  // Restaurar corrida arquivada para a lista principal
  const handleUnarchiveRide = (rideId: string) => {
    setArchivedRideIds(prev => {
      const next = prev.filter(id => id !== rideId);
      localStorage.setItem('drivehora_archived_rides', JSON.stringify(next));
      return next;
    });
    showToast('Corrida restaurada para o Histórico principal!', 'success');
  };

  // Exclusão visual definitiva para o passageiro (registro preservado para controle e relatórios do Admin)
  const handleDeleteArchivedRide = (rideId: string) => {
    showConfirm(
      'Tem certeza que deseja remover esta corrida do seu histórico? Ela não será mais exibida para você.',
      async () => {
        // 1. Marca como excluída para o passageiro (efeito visual na conta do cliente)
        setDeletedRideIdsForClient(prev => {
          const next = [...new Set([...prev, rideId])];
          localStorage.setItem('drivehora_deleted_rides', JSON.stringify(next));
          return next;
        });

        // 2. Remove da lista de arquivadas
        setArchivedRideIds(prev => {
          const next = prev.filter(id => id !== rideId);
          localStorage.setItem('drivehora_archived_rides', JSON.stringify(next));
          return next;
        });

        if (currentRideId === rideId) {
          setCurrentRideId(null);
        }

        // 3. Registra flag opcional no Supabase se suportado, sem deletar a linha de registro financeiro
        const sb = getSupabase();
        if (sb) {
          try {
            await sb.from('rides').update({ hidden_for_client: true }).eq('id', rideId);
          } catch {}
        }

        showToast('Corrida removida do seu histórico com sucesso.', 'info');
      },
      undefined,
      {
        title: 'Remover Corrida do Histórico?',
        confirmLabel: 'Sim, Remover',
        cancelLabel: 'Cancelar',
        type: 'warning'
      }
    );
  };

  // Alerta de Sessão Concorrente / Desconexão Forçada
  const [forcedLogoutNotice, setForcedLogoutNotice] = useState<{ activeDevice: string } | null>(null);

  // Perfis Onboarding (Recuperação síncrona imediata do cache local para evitar flicker ou tela incorreta no reload)
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(() => {
    try {
      const savedUser = localStorage.getItem('drivehora_current_user');
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      if (!parsed?.id) return null;
      const cached = localStorage.getItem(`drivehora_client_profile_${parsed.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(() => {
    try {
      const savedUser = localStorage.getItem('drivehora_current_user');
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      if (!parsed?.id) return null;
      const cached = localStorage.getItem(`drivehora_driver_profile_${parsed.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Estado de carregamento/verificação inicial de perfil
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(() => {
    try {
      const savedUser = localStorage.getItem('drivehora_current_user');
      if (!savedUser) return false;
      const parsed = JSON.parse(savedUser);
      if (!parsed) return false;
      if (isSuperAdminEmail(parsed.email) || parsed.role === 'admin' || parsed.isAdmin) return false;

      // Se for cliente e já tiver o perfil completo salvo no cache local, pode exibir direto
      if (parsed.role === 'client') {
        const cachedClient = parsed.id ? localStorage.getItem(`drivehora_client_profile_${parsed.id}`) : null;
        if (cachedClient) {
          const p = JSON.parse(cachedClient);
          if (p?.isProfileComplete) return false;
        }
        return true;
      }

      // Se for motorista e já tiver o perfil aprovado salvo no cache local, pode exibir direto
      if (parsed.role === 'driver') {
        const cachedDriver = parsed.id ? localStorage.getItem(`drivehora_driver_profile_${parsed.id}`) : null;
        if (cachedDriver) {
          const p = JSON.parse(cachedDriver);
          if (p?.verificationStatus === 'approved') return false;
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  });

  const [showDriverProfileEdit, setShowDriverProfileEdit] = useState(false);

  // Supabase state & modal
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseCredentials());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState(supabaseConfig.url);
  const [inputSupabaseKey, setInputSupabaseKey] = useState(supabaseConfig.key);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  // Formulário do cliente & Busca Automática de Endereços
  const [origin, setOrigin] = useState('Av. Paulista, 1000 - Bela Vista');
  const [destination, setDestination] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<string[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<string[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [hours, setHours] = useState(3);
  const [hourlyRate, setHourlyRate] = useState(60);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [clientOriginCoords, setClientOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Modalidade de corrida: Viagem Imediata vs Corrida Agendada
  const [isScheduledRide, setIsScheduledRide] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Cliente: Sub-aba (Solicitar Corrida, Agendadas, Radar, Favoritos VIP, Histórico ou Meus Dados/CPF)
  const [clientSubTab, setClientSubTab] = useState<'request' | 'scheduled' | 'nearby_radar' | 'favorites' | 'history' | 'profile'>('request');
  const [expandedScheduledRideIds, setExpandedScheduledRideIds] = useState<Record<string, boolean>>({});

  const toggleScheduledRideExpand = (rideId: string) => {
    setExpandedScheduledRideIds(prev => ({
      ...prev,
      [rideId]: !prev[rideId]
    }));
  };
  const [clientDateFilter, setClientDateFilter] = useState<'all' | 'today' | 'week' | '15days' | '30days' | 'custom'>('week');
  const [clientCustomDate, setClientCustomDate] = useState<string>('');
  const [selectedDriverForProfile, setSelectedDriverForProfile] = useState<DriverPublicProfile | null>(null);
  const [favoriteDriverIds, setFavoriteDriverIds] = useState<string[]>([]);
  const [selectedDirectDriver, setSelectedDirectDriver] = useState<DriverPublicProfile | null>(null);
  const [now, setNow] = useState(Date.now());
  const [dismissedCancellationIds, setDismissedCancellationIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('drivehora_dismissed_cancellations');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleDismissCancellation = async (rideId: string) => {
    // 1. Atualização imediata no estado local e cache para feedback instantâneo
    setDismissedCancellationIds(prev => {
      const updated = Array.from(new Set([...prev, rideId]));
      try {
        localStorage.setItem('drivehora_dismissed_cancellations', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Atualiza a lista de corridas na memória
    setRides(prev => prev.map(r => r.id === rideId ? { ...r, driverAcknowledgedAt: Date.now() } : r));

    // 3. Persistência definitiva no banco de dados (Supabase + Backend)
    try {
      await dbAcknowledgeRide(rideId);
    } catch (e) {
      console.warn('Erro ao persistir reconhecimento da corrida no banco:', e);
    }
  };

  // Modal de Reportar Problema com Corrida
  const [selectedRideForReport, setSelectedRideForReport] = useState<DbRide | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Modal de Seleção de GPS (Waze, Google Maps, Apple Maps)
  const [gpsModalData, setGpsModalData] = useState<{
    isOpen: boolean;
    destinationAddress: string;
    destinationLabel: string;
    coords?: { lat: number; lng: number };
  } | null>(null);

  const handleOpenGpsNavigation = (destinationAddress: string, destinationLabel: string, coords?: { lat: number; lng: number }) => {
    const pref = getDriverPreferredGps();
    if (pref !== 'ask') {
      launchNavigationApp(destinationAddress, pref, coords);
      showToast(`Iniciando navegação no ${pref === 'waze' ? 'Waze' : pref === 'google_maps' ? 'Google Maps' : 'Apple Maps'}...`, 'info');
    } else {
      setGpsModalData({
        isOpen: true,
        destinationAddress,
        destinationLabel,
        coords
      });
    }
  };

  // Status anterior da corrida do cliente para disparar notificações nas transições
  const [lastClientRideStatus, setLastClientRideStatus] = useState<string | null>(null);
  const [notifiedIncomingRideId, setNotifiedIncomingRideId] = useState<string | null>(null);

  // Meio de Pagamento Selecionado pelo Passageiro
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('pix');
  const [pixModalData, setPixModalData] = useState<{
    isOpen: boolean;
    rideId: string;
    amount: number;
    qrCodeUrl?: string;
    copiaECola?: string;
    expiresAt?: string;
    externalId?: string;
  } | null>(null);
  const [isCopiedPix, setIsCopiedPix] = useState(false);

  // Carteira, Avaliações e Cancelamento com Justificativa
  const [clientWallet, setClientWallet] = useState<UserWallet | null>(null);
  // Preferência do passageiro para ocultar saldo / valores confidenciais na tela
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    try {
      return localStorage.getItem('drivehora_hide_balance') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHideBalance = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHideBalance(prev => {
      const next = !prev;
      try {
        localStorage.setItem('drivehora_hide_balance', String(next));
      } catch {}
      return next;
    });
  };

  const [activeRatingRide, setActiveRatingRide] = useState<DbRide | null>(null);
  const [driverCancelModalRide, setDriverCancelModalRide] = useState<DbRide | null>(null);
  const [showDebtSupportModal, setShowDebtSupportModal] = useState<boolean>(false);
  const [debtSupportMessage, setDebtSupportMessage] = useState<string>('');
  const [isSubmittingDebtSupport, setIsSubmittingDebtSupport] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.id) {
      getUserWallet(currentUser.id).then(setClientWallet);
    }
  }, [currentUser?.id]);

  // Status de Integridade do Gateway (Trava de Segurança Obrigatória para o Sistema Operar)
  const [gatewayOperational, setGatewayOperational] = useState<boolean>(true);
  const [gatewayHealthMsg, setGatewayHealthMsg] = useState<string>('');

  // Checagem Contínua da Saúde do Gateway de Pagamentos (Asaas / MP / Stripe)
  const checkGatewayHealth = async (customSettings?: SystemSettings) => {
    try {
      const activeConf = (customSettings || getSystemSettings()).paymentGateway;
      const res = await testGatewayConnection({
        activeGateway: activeConf.activeGateway,
        environment: activeConf.environment,
        secretKey: activeConf.secretKey,
        publicKey: activeConf.publicKey
      });
      setGatewayOperational(res.operational);
      setGatewayHealthMsg(res.message);
      return res;
    } catch {
      setGatewayOperational(false);
      setGatewayHealthMsg('Erro de comunicação com o gateway de pagamentos.');
      return { operational: false, message: 'Erro de comunicação.' };
    }
  };

  const [driverOnboardingInitialStep, setDriverOnboardingInitialStep] = useState<number>(1);
  const [expandedDriverRideIds, setExpandedDriverRideIds] = useState<Record<string, boolean>>({});

  const toggleDriverRideExpand = (rideId: string) => {
    setExpandedDriverRideIds(prev => ({
      ...prev,
      [rideId]: !prev[rideId]
    }));
  };

  const [expandedClientRideIds, setExpandedClientRideIds] = useState<Record<string, boolean>>({});

  const toggleClientRideExpand = (rideId: string) => {
    setExpandedClientRideIds(prev => ({
      ...prev,
      [rideId]: !prev[rideId]
    }));
  };

  // Verificação de Sessão Única Concorrente (Supabase Realtime + Polling a cada 5s com Grace Period)
  useEffect(() => {
    if (!currentUser?.id) return;

    let isChecking = false;
    let isMounted = true;
    const loginTime = Date.now();

    const verifySession = async () => {
      // Ignora nos primeiros 4 segundos após o login para evitar conflito com gravação assíncrona
      if (Date.now() - loginTime < 4000) return;
      if (isChecking || !isMounted) return;
      isChecking = true;
      try {
        const localToken = getLocalSessionToken();
        if (!localToken) return;

        const sessionCheck = await dbCheckUserSession(currentUser.id, localToken);
        if (isMounted && !sessionCheck.valid) {
          console.warn('Sessão desconectada por novo login em outro aparelho:', sessionCheck.activeDevice);
          // Limpa sessão local
          clearLocalSessionToken();
          localStorage.removeItem('drivehora_current_user');
          setCurrentUser(null);
          setClientProfile(null);
          setDriverProfile(null);
          setIsDriverOnline(false);
          setForcedLogoutNotice({
            activeDevice: sessionCheck.activeDevice || 'Outro dispositivo'
          });
        }
      } catch (e) {
        console.warn('Erro ao checar integridade da sessão:', e);
      } finally {
        isChecking = false;
      }
    };

    // Verificação periódica contínua
    const pollInterval = setInterval(verifySession, 5000);

    // Verificação Realtime Supabase
    const sb = getSupabase();
    let sessionChannel: any = null;
    if (sb) {
      sessionChannel = sb
        .channel(`session_profile_${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${currentUser.id}`
          },
          () => {
            verifySession();
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (sessionChannel && sb) {
        sb.removeChannel(sessionChannel);
      }
    };
  }, [currentUser?.id]);

  // Carregar IDs de favoritos do cliente logado
  useEffect(() => {
    if (currentUser?.id) {
      dbGetFavoriteDriverIds(currentUser.id).then(ids => setFavoriteDriverIds(ids));
    }
  }, [currentUser?.id]);

  // Registro Automático do Device Token (Push FCM) ao Logar
  useEffect(() => {
    if (!currentUser?.id) return;

    const registerPushToken = async () => {
      try {
        const settings = getSystemSettings();
        if (!settings.firebase?.enabled) return;

        const token = await requestWebPushToken(settings.firebase.vapidKey);
        if (token) {
          await dbSaveUserDeviceToken(currentUser.id, token, currentUser.role);
        }
      } catch (e) {
        console.warn('Registro de push token postergado ou não autorizado:', e);
      }
    };

    // Delay suave para a interface carregar antes de pedir permissão
    const timer = setTimeout(registerPushToken, 1200);

    // Listener de mensagens recebidas em primeiro plano (In-App Push)
    const unsubscribeForeground = onForegroundMessage((payload) => {
      const title = payload.notification?.title || '🔔 DriveHora Notificação';
      const body = payload.notification?.body || '';
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    });

    return () => {
      clearTimeout(timer);
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, [currentUser?.id, currentUser?.role]);

  // Alternar favorito do cliente
  const handleToggleFavorite = async (driverId: string) => {
    if (!currentUser?.id) return;
    const res = await dbToggleFavoriteDriver(currentUser.id, driverId);
    if (res.isFavorite) {
      setFavoriteDriverIds(prev => [...new Set([...prev, driverId])]);
    } else {
      setFavoriteDriverIds(prev => prev.filter(id => id !== driverId));
    }
  };

  // Selecionar motorista para agendamento direto
  const handleSelectDriverForBooking = (driver: DriverPublicProfile) => {
    setSelectedDirectDriver(driver);
    setClientSubTab('request');
  };

  // Timer de 1 segundo para atualizar contadores regressivos
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Motorista & Alertas em Tempo Real
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
  const [dismissedRideId, setDismissedRideId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [allDriversList, setAllDriversList] = useState<DriverProfile[]>([]);
  const [driverDateFilter, setDriverDateFilter] = useState<'all' | 'today' | 'week' | '15days' | '30days' | 'custom'>('week');
  const [driverCustomDate, setDriverCustomDate] = useState<string>('');
  const [driverSubTab, setDriverSubTab] = useState<'radar' | 'history'>('radar');
  const [searchCancellationReason, setSearchCancellationReason] = useState<{
    rideId: string;
    reason: 'no_drivers_online' | 'timeout_10min';
  } | null>(null);

  // Monitorar motoristas online cadastrados no sistema
  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const list = await dbGetAllDrivers();
        setAllDriversList(list);
      } catch (e) {}
    };
    loadDrivers();
    const interval = setInterval(loadDrivers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Total de motoristas atualmente online e aprovados
  const onlineDriversCount = allDriversList.filter(
    d => d.isOnline && (d.verificationStatus === 'approved' || isSuperAdminEmail(d.phone || ''))
  ).length;

  // Formatador seguro de data e hora agendada (à prova de falhas entre navegadores e fusos)
  const formatScheduledDate = (val?: string | null): string => {
    if (!val) return 'Data marcada';
    try {
      const raw = String(val).trim();
      const dateObj = new Date(raw.length === 16 ? `${raw}:00` : raw);
      if (!isNaN(dateObj.getTime())) {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        const h = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        return `${d}/${m}/${y} às ${h}:${min}`;
      }
      if (raw.includes('T')) {
        const [dPart, tPart] = raw.split('T');
        const [y, m, d] = dPart.split('-');
        return `${d}/${m}/${y} às ${tPart}`;
      }
      return raw;
    } catch {
      return String(val || 'Data marcada');
    }
  };

  // Retorna a data local atual no formato YYYY-MM-DD
  const getTodayLocalDateStr = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Retorna o horário mínimo permitido para hoje com margem de segurança (HH:MM)
  const getMinScheduledTimeStr = (): string => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Garante que comodidades sejam sempre tratadas como um array de strings seguro
  const safeAmenitiesArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val.map(item => (typeof item === 'string' ? item : (item?.id || item?.label || String(item))));
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return safeAmenitiesArray(parsed);
      } catch {}
      if (val.startsWith('{') && val.endsWith('}')) {
        return val.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      }
      return [val];
    }
    return [];
  };

  // Normalizador de comodidades (compatibilidade entre IDs curtos e rótulos longos de onboarding)
  const normalizeAmenity = (a: any): string => {
    const raw = typeof a === 'string' ? a : (a?.id || a?.label || String(a || ''));
    const s = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (s.includes('pcd') || s.includes('acessib') || s.includes('defic')) return 'acessibilidade_pcd';
    if (s.includes('ar') || s.includes('clima') || s.includes('condicion')) return 'ar_condicionado';
    if (s.includes('pet') || s.includes('anim')) return 'pet_friendly';
    if (s.includes('mala') || s.includes('bagag')) return 'porta_malas';
    if (s.includes('cadeir') || s.includes('bebe') || s.includes('infant')) return 'cadeirinha';
    if (s.includes('wifi') || s.includes('wi-fi') || s.includes('internet')) return 'wifi';
    return s;
  };

  const driverHasAllAmenities = (driverAmenities: any, requiredAmenities: any): boolean => {
    const reqArr = safeAmenitiesArray(requiredAmenities);
    if (reqArr.length === 0) return true;
    const normalizedDriver = safeAmenitiesArray(driverAmenities).map(normalizeAmenity);
    return reqArr.every(req => normalizedDriver.includes(normalizeAmenity(req)));
  };

  // Identificar solicitação de corrida pendente em busca de motorista
  // Exclui a si próprio se o usuário logado for o passageiro da corrida
  // Prioridade para Motoristas Favoritos: se houver favoritos online, apenas eles recebem nos primeiros 45s
  const incomingRide = rides.find(r => {
    if (r.status !== 'searching') return false;
    if (currentUser && r.clientId === currentUser.id) return false;
    if (!isUserAdmin && r.requiredAmenities && r.requiredAmenities.length > 0) {
      if (!driverHasAllAmenities(driverProfile?.amenities, r.requiredAmenities)) {
        return false;
      }
    }

    // Regra de Prioridade de Despacho para Motoristas Favoritos
    const favDriverIds = r.favoriteDriverIds || [];
    if (favDriverIds.length > 0) {
      const isCurrentDriverFavorite = Boolean(
        (currentUser?.id && favDriverIds.includes(currentUser.id)) ||
        (driverProfile?.id && favDriverIds.includes(driverProfile.id))
      );

      // Verifica se há motoristas favoritos online
      const hasOnlineFavorites = allDriversList.some(
        d => d.isOnline && (d.verificationStatus === 'approved' || isSuperAdminEmail(d.phone || '')) &&
             (favDriverIds.includes(d.id) || favDriverIds.includes(d.userId))
      );

      const elapsedSeconds = Math.floor((now - (r.createdAt || now)) / 1000);
      const FAVORITE_WINDOW_SECS = 45;

      // Se há favoritos online e estamos dentro da janela de exclusividade de 45s:
      if (hasOnlineFavorites && elapsedSeconds < FAVORITE_WINDOW_SECS) {
        if (!isCurrentDriverFavorite) {
          return false; // Bloqueia outros motoristas durante os primeiros 45 segundos
        }
      }
    }

    return true;
  });

  // Tempo limite para o motorista aceitar a corrida (30s APENAS para viagens imediatas)
  const DRIVER_ACCEPT_TIMEOUT_SECS = 30;
  const isIncomingScheduled = Boolean(incomingRide?.isScheduled);
  const driverSecondsRemaining = incomingRide 
    ? (isIncomingScheduled ? 9999 : Math.max(0, DRIVER_ACCEPT_TIMEOUT_SECS - Math.floor((now - (incomingRide.createdAt || now)) / 1000)))
    : 0;

  // Auto-dispensar chamada caso o tempo de resposta do motorista expire (apenas para corridas imediatas)
  useEffect(() => {
    if (isDriverOnline && incomingRide && !incomingRide.isScheduled && incomingRide.id !== dismissedRideId) {
      if (driverSecondsRemaining <= 0) {
        setDismissedRideId(incomingRide.id);
      }
    }
  }, [isDriverOnline, incomingRide?.id, incomingRide?.isScheduled, dismissedRideId, driverSecondsRemaining]);

  // Sintetizador Web Audio API de Alerta Sonoro de Chamado
  const playRideAlertSound = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Pulsing ride request chime (Arpejo agradável e chamativo)
      playBeep(880, 0, 0.18);
      playBeep(1174.66, 0.22, 0.28);
      playBeep(1479.98, 0.52, 0.38);
    } catch (e) {}
  };

  // Tocar som em loop enquanto houver corrida em busca e o motorista estiver online
  useEffect(() => {
    if (isDriverOnline && incomingRide && incomingRide.id !== dismissedRideId && driverSecondsRemaining > 0) {
      playRideAlertSound();
      const interval = setInterval(() => {
        playRideAlertSound();
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [isDriverOnline, incomingRide?.id, dismissedRideId, isMuted, driverSecondsRemaining > 0]);

  // Carregar configurações atualizadas do sistema (Supabase + LocalStorage) com sincronização em tempo real
  useEffect(() => {
    // 1. Busca inicial imediata do Supabase
    fetchSystemSettingsFromDb().then(async (settings) => {
      setSystemSettings(settings);
      await checkGatewayHealth(settings);
    });

    // 2. Ouvir atualizações locais (mesma janela ou abas diferentes)
    const handleSettingsUpdated = async (e: any) => {
      const updated = e?.detail || getSystemSettings();
      setSystemSettings(updated);
      await checkGatewayHealth(updated);
    };

    window.addEventListener('drivehora_settings_updated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);

    // 3. Ouvir atualizações remotas em tempo real via Supabase (quando Admin salva de qualquer dispositivo)
    const sb = getSupabase();
    let channel: any = null;
    if (sb) {
      channel = sb
        .channel('public:system_settings_app')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, async () => {
          const remoteSettings = await fetchSystemSettingsFromDb();
          setSystemSettings(remoteSettings);
          await checkGatewayHealth(remoteSettings);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.app_global_system_settings' }, async () => {
          const remoteSettings = await fetchSystemSettingsFromDb();
          setSystemSettings(remoteSettings);
          await checkGatewayHealth(remoteSettings);
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('drivehora_settings_updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
      if (channel && sb) {
        sb.removeChannel(channel);
      }
    };
  }, [supabaseConnected]);

  // Informações da URL de acesso configurável pelo Administrador (Padrão: https://drivehora.agenc-ia.net)
  const appAccessUrl = (systemSettings.appUrl && systemSettings.appUrl.trim()) 
    || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
        ? window.location.origin 
        : 'https://drivehora.agenc-ia.net');

  // Cálculos financeiros
  const totalAmount = hours * hourlyRate;
  const platformFee = Number((totalAmount * 0.15).toFixed(2));
  const driverNet = Number((totalAmount * 0.85).toFixed(2));

  // Carregar perfis do banco sempre que o usuário mudar
  useEffect(() => {
    const loadUserProfiles = async () => {
      if (!currentUser) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        // Se o perfil ainda não estiver carregado ou homologado, garante tela de carregamento ativa
        const isAdmin = isSuperAdminEmail(currentUser.email) || currentUser.role === 'admin' || currentUser.isAdmin;
        if (!isAdmin) {
          if (
            (currentUser.role === 'client' && (!clientProfile || !clientProfile.isProfileComplete)) ||
            (currentUser.role === 'driver' && (!driverProfile || driverProfile.verificationStatus !== 'approved'))
          ) {
            setIsLoadingProfile(true);
          }
        }

        // Sempre carregar ambos os perfis (essencial para Admin e usuários multirrole)
        const [cp, dp] = await Promise.all([
          dbGetClientProfile(currentUser.id, currentUser.email),
          dbGetDriverProfile(currentUser.id, currentUser.email)
        ]);

        if (cp) {
          setClientProfile(cp);
        }
        if (dp) {
          setDriverProfile(dp);
          if (dp.isOnline !== undefined) {
            setIsDriverOnline(dp.isOnline);
          }
        }

        // Se houver nome completo gravado no banco, atualizar currentUser e localStorage
        const latestFullName = dp?.fullName || cp?.fullName;
        if (latestFullName && latestFullName !== currentUser.fullName) {
          setCurrentUser(prev => prev ? { ...prev, fullName: latestFullName } : prev);
          try {
            const savedStr = localStorage.getItem('drivehora_current_user');
            if (savedStr) {
              const parsed = JSON.parse(savedStr);
              parsed.fullName = latestFullName;
              localStorage.setItem('drivehora_current_user', JSON.stringify(parsed));
            }
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Erro ao carregar perfis do usuário no banco:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    loadUserProfiles();
  }, [currentUser?.id, currentUser?.email, supabaseConnected]);

  // Escuta alterações remotas de status do motorista (ex: Desconexão remota pelo Admin/Suporte)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'driver') return;

    const sb = getSupabase();
    let channel: any = null;
    if (sb) {
      channel = sb
        .channel(`driver_remote_status_${currentUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'drivers'
          },
          (payload: any) => {
            if (payload.new && (payload.new.user_id === currentUser.id || payload.new.id === currentUser.id)) {
              if (payload.new.is_online !== undefined) {
                const remoteOnline = Boolean(payload.new.is_online);
                setIsDriverOnline(prev => {
                  if (prev && !remoteOnline) {
                    showAlert(
                      'Seu aplicativo foi desconectado (modo OFFLINE) pela Central de Atendimento / Administração.\n\nCaso necessite de suporte ou queira reconectar, entre em contato com a administração.',
                      'warning',
                      'Desconectado pelo Suporte'
                    );
                  } else if (!prev && remoteOnline) {
                    showToast('Seu status foi ativado para ONLINE pela Administração.', 'info');
                  }
                  return remoteOnline;
                });
              }
            }
          }
        )
        .subscribe();
    }

    const handleRemoteOnlineEvent = (e: any) => {
      if (e.detail && e.detail.userId === currentUser.id) {
        const nextStatus = Boolean(e.detail.isOnline);
        setIsDriverOnline(prev => {
          if (prev && !nextStatus) {
            showAlert(
              'Seu aplicativo foi desconectado (modo OFFLINE) pela Central de Atendimento / Administração.',
              'warning',
              'Desconectado pelo Suporte'
            );
          }
          return nextStatus;
        });
      }
    };
    window.addEventListener('drivehora_driver_status_changed', handleRemoteOnlineEvent);

    return () => {
      if (channel && sb) sb.removeChannel(channel);
      window.removeEventListener('drivehora_driver_status_changed', handleRemoteOnlineEvent);
    };
  }, [currentUser?.id, currentUser?.role]);

  // Carregar automaticamente a localização do ponto de partida via GPS ao iniciar a solicitação
  useEffect(() => {
    if (activeTab === 'client') {
      const autoDetectClientGPS = async () => {
        try {
          setIsLocatingGPS(true);
          const coords = await getCurrentPosition();
          setClientOriginCoords({ lat: coords.latitude, lng: coords.longitude });
          const address = await reverseGeocode(coords);
          if (address) {
            setOrigin(address);
          }
        } catch (e) {
          // Mantém valor padrão caso a permissão seja recusada
        } finally {
          setIsLocatingGPS(false);
        }
      };
      autoDetectClientGPS();
    }
  }, [activeTab]);

  // Re-validação periódica e ao alternar de aba (Cliente / Motorista / Admin)
  useEffect(() => {
    checkGatewayHealth();
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => checkGatewayHealth(), 30000);
    return () => clearInterval(interval);
  }, []);

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
    if (sb) {
      try {
        const [ridesRes, profilesRes] = await Promise.all([
          sb.from('rides').select('*').order('created_at', { ascending: false }).limit(50),
          sb.from('profiles').select('id, full_name, email, active_session_token')
        ]);

        if (!ridesRes.error && ridesRes.data) {
          const profilesMap = new Map<string, string>();
          let substatusMap: Record<string, { substatus: string; updatedAt: number; cancellationReason?: string; cancelledBy?: string }> = {};

          (profilesRes.data || []).forEach((p: any) => {
            if (p.id === 'app_global_ride_substatus' && p.active_session_token) {
              try {
                substatusMap = JSON.parse(p.active_session_token);
              } catch {}
            }
            let name = p.full_name;
            if (name && name.includes('@')) {
              const userPart = name.split('@')[0];
              name = userPart.replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            }
            if (p.id && name) profilesMap.set(p.id, name);
            if (p.email && name) profilesMap.set(p.email.toLowerCase().trim(), name);
          });

          // Fallback para substatus no localStorage se necessário
          if (!substatusMap || Object.keys(substatusMap).length === 0) {
            try {
              const local = localStorage.getItem('drivehora_rides_substatus_map');
              if (local) substatusMap = JSON.parse(local);
            } catch {}
          }

          const formatted: DbRide[] = ridesRes.data.map((d: any) => {
            const sub = substatusMap[d.id];
            const effectiveStatus = (d.status === 'accepted' && sub?.substatus && (sub.substatus === 'to_pickup' || sub.substatus === 'arrived_at_pickup'))
              ? (sub.substatus as any)
              : d.status;

            return {
              id: d.id,
              clientId: d.client_id,
              clientName: profilesMap.get(d.client_id) || d.client_name || 'Passageiro',
              driverId: d.driver_id,
              driverName: profilesMap.get(d.driver_id) || d.driver_name || (d.driver_id ? 'Motorista Parceiro' : undefined),
              origin: d.origin,
              destination: d.destination,
              originLat: d.origin_lat !== undefined && d.origin_lat !== null ? Number(d.origin_lat) : d.originLat,
              originLng: d.origin_lng !== undefined && d.origin_lng !== null ? Number(d.origin_lng) : d.originLng,
              destLat: d.dest_lat !== undefined && d.dest_lat !== null ? Number(d.dest_lat) : d.destLat,
              destLng: d.dest_lng !== undefined && d.dest_lng !== null ? Number(d.dest_lng) : d.destLng,
              hours: Number(d.hours),
              hourlyRate: Number(d.hourly_rate),
              total: Number(d.total),
              commission: Number(d.commission),
              driverNet: Number(d.driver_net),
              status: effectiveStatus,
              paymentMethod: d.payment_method || d.paymentMethod,
              paymentStatus: d.payment_status || d.paymentStatus,
              cancellationReason: sub?.cancellationReason || d.cancellation_reason || d.cancellationReason,
              cancelledBy: (sub?.cancelledBy as any) || d.cancelled_by || d.cancelledBy,
              driverAcknowledgedAt: d.driver_acknowledged_at ? new Date(d.driver_acknowledged_at).getTime() : undefined,
              createdAt: new Date(d.created_at).getTime(),
              acceptedAt: d.accepted_at ? new Date(d.accepted_at).getTime() : undefined,
              startedAt: d.started_at ? new Date(d.started_at).getTime() : undefined,
              finishedAt: d.finished_at ? new Date(d.finished_at).getTime() : undefined,
              isScheduled: Boolean((sub as any)?.isScheduled || d.ride_type === 'scheduled' || d.scheduled_for || d.is_scheduled || d.isScheduled),
              scheduledFor: (sub as any)?.scheduledFor || d.scheduled_for || d.scheduledFor,
              requiredAmenities: (sub as any)?.requiredAmenities || d.required_amenities || d.requiredAmenities || [],
              favoriteDriverIds: (sub as any)?.favoriteDriverIds || d.favorite_driver_ids || d.favoriteDriverIds || []
            };
          });
          setRides(formatted);
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
        let substatusMap: Record<string, any> = {};
        try {
          const local = localStorage.getItem('drivehora_rides_substatus_map') || localStorage.getItem('drivehora_ride_substatus_map');
          if (local) substatusMap = JSON.parse(local);
        } catch {}

        const mapped = data.map((d: any) => {
          const sub = substatusMap[d.id];
          const effectiveStatus = (d.status === 'accepted' && sub?.substatus && (sub.substatus === 'to_pickup' || sub.substatus === 'arrived_at_pickup'))
            ? sub.substatus
            : d.status;

          return {
            ...d,
            status: effectiveStatus,
            cancellationReason: sub?.cancellationReason || d.cancellationReason,
            cancelledBy: sub?.cancelledBy || d.cancelledBy,
            driverAcknowledgedAt: d.driverAcknowledgedAt ? Number(d.driverAcknowledgedAt) : (d.driver_acknowledged_at ? new Date(d.driver_acknowledged_at).getTime() : undefined),
            isScheduled: Boolean((sub as any)?.isScheduled || d.ride_type === 'scheduled' || d.scheduled_for || d.is_scheduled || d.isScheduled),
            scheduledFor: (sub as any)?.scheduledFor || d.scheduled_for || d.scheduledFor,
            requiredAmenities: (sub as any)?.requiredAmenities || d.required_amenities || d.requiredAmenities || [],
            favoriteDriverIds: (sub as any)?.favoriteDriverIds || d.favorite_driver_ids || d.favoriteDriverIds || []
          };
        });
        setRides(mapped);
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
      setClientOriginCoords({ lat: coords.latitude, lng: coords.longitude });
      const address = await reverseGeocode(coords);
      setOrigin(address);
      showToast('Localização atual obtida com sucesso!', 'success');
    } catch (err: any) {
      showAlert('Não foi possível obter sua localização GPS precisa.', 'error', 'Erro de Localização');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Carregar dados na inicialização e subscrever a eventos em tempo real
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
        .channel('public:rides_and_substatus')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
          fetchRides();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.app_global_ride_substatus' }, () => {
          fetchRides();
        })
        .subscribe();
    }

    const handleSubstatusEvent = () => {
      fetchRides();
    };
    window.addEventListener('drivehora_substatus_updated', handleSubstatusEvent);

    const interval = setInterval(() => {
      fetchRides();
    }, 3000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('drivehora_substatus_updated', handleSubstatusEvent);
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
    showToast('Credenciais do Supabase configuradas com sucesso!', 'success');
  };

  // Logout do Usuário -> Volta imediatamente para a Página de Login
  // Se for motorista, garante que ele ficará OFFLINE antes de sair
  const handleLogout = async () => {
    if (currentUser?.role === 'driver' && currentUser?.id) {
      try {
        await dbUpdateDriverOnlineStatus(currentUser.id, false);
      } catch (e) {
        console.warn('Erro ao colocar motorista offline no logout:', e);
      }
    }
    clearLocalSessionToken();
    localStorage.removeItem('drivehora_current_user');
    setCurrentUser(null);
    setClientProfile(null);
    setDriverProfile(null);
    setIsDriverOnline(false);
    setIsLoadingProfile(false);
  };

  // Solicitar corrida como cliente
  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      showAlert('Por favor, informe o ponto de partida e o destino da corrida.', 'warning', 'Dados Incompletos');
      return;
    }

    // Validação estrita para corridas agendadas: não permitir dia e horário anteriores ao momento atual
    if (isScheduledRide) {
      if (!scheduledDate || !scheduledTime) {
        showAlert('Por favor, informe a data e horário para a corrida agendada.', 'warning', 'Agendamento Incompleto');
        return;
      }
      const [sYear, sMonth, sDay] = scheduledDate.split('-').map(Number);
      const [sHour, sMin] = scheduledTime.split(':').map(Number);
      const scheduledMoment = new Date(sYear, sMonth - 1, sDay, sHour, sMin, 0);
      const nowMoment = new Date();
      if (scheduledMoment.getTime() <= nowMoment.getTime()) {
        showAlert(
          'A data e o horário agendados não podem ser anteriores ao momento atual. Por favor, selecione uma data futura ou um horário posterior ao atual.',
          'warning',
          'Horário Agendado Inválido'
        );
        return;
      }
    }

    // 1. Passageiro só pode fazer uma solicitação imediata por vez se houver uma aberta
    if (!isScheduledRide && activeClientImmediateRide) {
      showAlert(
        `Você já possui uma solicitação de viagem imediata em atendimento (#${activeClientImmediateRide.id.slice(-6)}). Conclua ou cancele a corrida atual para fazer um novo pedido imediato.`,
        'warning',
        'Viagem Imediata em Andamento'
      );
      return;
    }

    // 2. Bloqueio em caso de débito pendente na conta
    if (clientWallet && clientWallet.balance < 0) {
      showAlert(
        `Você possui um saldo devedor pendente de ${formatCurrency(Math.abs(clientWallet.balance))}. Regularize a pendência junto ao nosso suporte para liberar novas solicitações.`,
        'warning',
        'Conta com Débito Pendente'
      );
      setShowDebtSupportModal(true);
      return;
    }

    if (!gatewayOperational) {
      showAlert(
        'As solicitações de corrida estão momentaneamente indisponíveis porque o sistema de pagamentos está em validação. Por favor, tente novamente em alguns instantes.',
        'warning',
        'Sistema em Manutenção Momentânea'
      );
      return;
    }

    // Exigência cadastral do passageiro (CPF obrigatório para emissão de gateway de pagamento)
    const cleanCpf = (clientProfile?.cpf || '').replace(/\D/g, '');
    if (!clientProfile || cleanCpf.length !== 11) {
      showAlert(
        'Para sua segurança e conformidade com os gateways de pagamento (Pix/Cartão), é obrigatório completar seu cadastro informando seu CPF antes de solicitar corridas.',
        'warning',
        'Cadastro Pendente'
      );
      setClientSubTab('profile');
      return;
    }

    setIsRequesting(true);
    const rideId = 'ride_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const clientId = currentUser?.id || ('client_' + Math.random().toString(36).substring(2, 6));

    // Cálculo com abatimento de créditos disponíveis
    const availableCredit = clientWallet && clientWallet.balance > 0 ? clientWallet.balance : 0;
    const creditDiscount = Math.min(availableCredit, totalAmount);
    const effectiveTotalToPay = Math.max(0, Number((totalAmount - creditDiscount).toFixed(2)));

    let pixDataResult: any = null;
    let paymentStatus: any = 'pending';
    let finalPaymentMethod = selectedPaymentMethod;

    if (creditDiscount >= totalAmount) {
      // Coberto 100% por créditos
      paymentStatus = 'paid';
      finalPaymentMethod = 'wallet' as any;
      try {
        await addWalletDebit(clientId, creditDiscount, `Pagamento integral com saldo de créditos (#${rideId.slice(-6)})`, rideId);
        if (currentUser?.id) getUserWallet(currentUser.id).then(setClientWallet);
      } catch {}
    } else if (selectedPaymentMethod === 'cash' || selectedPaymentMethod === 'card_machine') {
      paymentStatus = 'in_person_pending';
      if (creditDiscount > 0) {
        try {
          await addWalletDebit(clientId, creditDiscount, `Abatimento parcial de crédito (#${rideId.slice(-6)})`, rideId);
          if (currentUser?.id) getUserWallet(currentUser.id).then(setClientWallet);
        } catch {}
      }
    } else if (selectedPaymentMethod === 'pix') {
      try {
        pixDataResult = await createPixPayment({
          rideId,
          amount: effectiveTotalToPay,
          clientName: currentUser?.fullName || 'Passageiro',
          clientEmail: currentUser?.email,
          description: `Contratação de Motorista por ${hours} horas${creditDiscount > 0 ? ` (Abatido ${formatCurrency(creditDiscount)} de créditos)` : ''}`
        });
      } catch (e) {
        console.warn('Erro ao gerar cobrança Pix:', e);
      }
    }

    // Geocodificação real dos endereços de embarque e destino
    let oLat: number | undefined = clientOriginCoords?.lat;
    let oLng: number | undefined = clientOriginCoords?.lng;
    let dLat: number | undefined;
    let dLng: number | undefined;

    try {
      const [oGeo, dGeo] = await Promise.all([
        !oLat ? geocodeAddress(origin) : Promise.resolve(null),
        geocodeAddress(destination)
      ]);
      if (oGeo) {
        oLat = oGeo.latitude;
        oLng = oGeo.longitude;
      }
      if (dGeo) {
        dLat = dGeo.latitude;
        dLng = dGeo.longitude;
      }
    } catch (err) {
      console.warn('Erro ao geocodificar endereços:', err);
    }

    const newRide: DbRide = {
      id: rideId,
      clientId,
      clientName: currentUser?.fullName || 'Passageiro',
      origin,
      destination,
      originLat: oLat,
      originLng: oLng,
      destLat: dLat,
      destLng: dLng,
      hours,
      hourlyRate,
      total: totalAmount,
      commission: platformFee,
      driverNet: driverNet,
      status: 'searching',
      paymentMethod: finalPaymentMethod as any,
      paymentStatus: paymentStatus,
      paymentGateway: systemSettings.paymentGateway.activeGateway || 'asaas',
      paymentExternalId: pixDataResult?.externalId,
      pixQrCodeUrl: pixDataResult?.pixQrCodeUrl,
      pixCopiaECola: pixDataResult?.pixCopiaECola,
      createdAt: Date.now(),
      isScheduled: isScheduledRide,
      scheduledFor: isScheduledRide ? `${scheduledDate}T${scheduledTime}` : undefined,
      requiredAmenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
      favoriteDriverIds: favoriteDriverIds.length > 0 ? favoriteDriverIds : undefined
    };

    // 1. Atualização imediata no estado local do cliente
    if (!isScheduledRide) {
      setCurrentRideId(rideId);
    } else {
      // Para corrida agendada: não define como corrida imediata ativa
      // Limpa os campos do formulário para permitir novas solicitações imediatamente
      setOrigin('');
      setDestination('');
      setSelectedAmenities([]);
      setClientOriginCoords(null);
      setIsScheduledRide(false);
      setScheduledDate('');
      setScheduledTime('');
      setClientSubTab('scheduled');
      showToast('Corrida agendada com sucesso! Você pode acompanhá-la na aba "Agendadas".', 'success');
    }
    setRides(prev => [newRide, ...prev.filter(r => r.id !== rideId)]);

    // 2. Se for Pix e restar valor a pagar, exibe o modal de pagamento Pix
    if (finalPaymentMethod === 'pix' && pixDataResult && effectiveTotalToPay > 0) {
      setPixModalData({
        isOpen: true,
        rideId,
        amount: effectiveTotalToPay,
        qrCodeUrl: pixDataResult.pixQrCodeUrl,
        copiaECola: pixDataResult.pixCopiaECola,
        expiresAt: pixDataResult.expiresAt,
        externalId: pixDataResult.externalId
      });
    } else if (effectiveTotalToPay === 0) {
      showToast('Corrida contratada e paga com 100% de saldo em créditos!', 'success');
    }

    // 3. Gravação no Supabase
    try {
      await dbCreateRide(newRide);
    } catch (err) {
      console.warn('Erro ao criar corrida no Supabase:', err);
    }

    await fetchRides();
    setIsRequesting(false);
  };

  // Cancelar corrida pelo passageiro
  // Regra de Negócio:
  // 1) Se em busca ('searching'): cancelamento 100% gratuito e reembolso integral para a carteira (se pago online).
  // 2) Se aceita/a caminho/no local (não iniciada):
  //    - Até 5 minutos (<= 300s): cancelamento gratuito e reembolso integral em créditos.
  //    - Após 5 minutos (> 300s): taxa fixa de R$ 15,00 transferida 100% ao motorista (sem descontos da plataforma).
  //      - Se pago online: taxa é descontada do valor já pago antes do ressarcimento. Se houver saldo restante, vira crédito. Se não houver saldo suficiente, entra como débito.
  //      - Se em dinheiro / não pago: taxa de R$ 15,00 vira débito na conta do passageiro, bloqueando novas corridas até regularização.
  // 3) Se já iniciada ('in_progress' ou 'finished'): não pode ser cancelada pelo passageiro.
  const handleCancelRideByClient = (rideId: string) => {
    const targetRide = rides.find(r => r.id === rideId);
    if (!targetRide) return;

    if (targetRide.status === 'in_progress' || targetRide.status === 'finished') {
      showAlert(
        'Esta corrida já foi iniciada pelo motorista e não pode mais ser cancelada pelo passageiro.',
        'warning',
        'Corrida em Andamento'
      );
      return;
    }

    const CANCELLATION_FEE = 15.0;
    const isSearching = targetRide.status === 'searching';
    const acceptedTs = targetRide.acceptedAt || targetRide.createdAt || Date.now();
    const elapsedSeconds = Math.floor((Date.now() - acceptedTs) / 1000);
    const isWithinFreePeriod = targetRide.isScheduled || isSearching || elapsedSeconds <= 300;

    if (isWithinFreePeriod) {
      showConfirm(
        targetRide.isScheduled
          ? `Deseja realmente cancelar este agendamento?${targetRide.paymentMethod !== 'cash' ? ' O valor pago será estornado integralmente para sua carteira.' : ''}`
          : isSearching
            ? 'Deseja realmente cancelar a busca pelo motorista? Nenhum valor será cobrado.'
            : `Você está dentro do prazo de 5 minutos de cancelamento gratuito. Deseja realmente cancelar a chamada sem nenhum custo?${targetRide.paymentMethod !== 'cash' ? ' O valor pago será estornado integralmente para sua carteira.' : ''}`,
        async () => {
          await dbCancelRide(rideId, isSearching ? 'Cancelado pelo passageiro durante a busca' : 'Cancelado pelo passageiro (dentro do prazo de 5 minutos)', 'client');
          if (targetRide.paymentMethod !== 'cash' && targetRide.clientId && targetRide.total > 0) {
            try {
              await addWalletCredit(
                targetRide.clientId,
                targetRide.total,
                `Estorno de corrida #${targetRide.id.slice(-6)} cancelada gratuitamente`,
                targetRide.id
              );
              if (currentUser?.id) getUserWallet(currentUser.id).then(setClientWallet);
            } catch (err) {
              console.warn('Erro ao reembolsar passageiro:', err);
            }
          }
          setCurrentRideId(null);
          fetchRides();
          showToast('Corrida cancelada gratuitamente com sucesso.', 'info');
        },
        undefined,
        {
          title: 'Cancelar Corrida (Gratuito)',
          confirmLabel: 'Confirmar Cancelamento',
          cancelLabel: 'Voltar',
          type: 'confirm'
        }
      );
    } else {
      // Cancelamento APÓS 5 minutos -> Taxa de R$ 15,00 repassada 100% ao motorista
      let feeExplanation = '';
      if (targetRide.paymentMethod !== 'cash') {
        if (targetRide.total >= CANCELLATION_FEE) {
          const refundAmount = targetRide.total - CANCELLATION_FEE;
          feeExplanation = `O prazo gratuito de 5 minutos expirou. Será aplicada a taxa de cancelamento de ${formatCurrency(CANCELLATION_FEE)}, repassada integralmente ao motorista. O restante do valor pago (${formatCurrency(refundAmount)}) será estornado como crédito em sua carteira.`;
        } else {
          const deficit = CANCELLATION_FEE - targetRide.total;
          feeExplanation = `O prazo gratuito de 5 minutos expirou. A taxa de cancelamento é de ${formatCurrency(CANCELLATION_FEE)} (repassada ao motorista). O valor não coberto de ${formatCurrency(deficit)} entrará como débito na sua conta.`;
        }
      } else {
        feeExplanation = `O prazo gratuito de 5 minutos expirou. Como o pagamento foi definido em Dinheiro, a taxa de cancelamento de ${formatCurrency(CANCELLATION_FEE)} será repassada integralmente ao motorista e lançada como débito na sua conta de passageiro (bloqueando novas solicitações até quitação).`;
      }

      showConfirm(
        `${feeExplanation}\n\nDeseja confirmar o cancelamento?`,
        async () => {
          // 1. Creditar 100% da taxa ao motorista (sem descontos)
          if (targetRide.driverId) {
            try {
              await dbCreditDriverCancellationFee(targetRide.driverId, CANCELLATION_FEE, targetRide.id);
            } catch (err) {
              console.warn('Erro ao creditar taxa ao motorista:', err);
            }
          }

          // 2. Processar estorno ou débito na carteira do passageiro
          if (targetRide.clientId) {
            try {
              if (targetRide.paymentMethod !== 'cash') {
                if (targetRide.total >= CANCELLATION_FEE) {
                  const refund = targetRide.total - CANCELLATION_FEE;
                  if (refund > 0) {
                    await addWalletCredit(
                      targetRide.clientId,
                      refund,
                      `Reembolso de corrida #${targetRide.id.slice(-6)} cancelada após 5 min (descontada taxa de R$ 15,00 do motorista)`,
                      targetRide.id
                    );
                  }
                } else {
                  const deficit = CANCELLATION_FEE - targetRide.total;
                  if (deficit > 0) {
                    await addWalletDebit(
                      targetRide.clientId,
                      deficit,
                      `Débito residual de taxa de cancelamento após 5 min (#${targetRide.id.slice(-6)})`,
                      targetRide.id
                    );
                  }
                }
              } else {
                // Em dinheiro: taxa de R$ 15 entra como débito
                await addWalletDebit(
                  targetRide.clientId,
                  CANCELLATION_FEE,
                  `Taxa de cancelamento após 5 min repassada ao motorista (#${targetRide.id.slice(-6)})`,
                  targetRide.id
                );
              }
              if (currentUser?.id) getUserWallet(currentUser.id).then(setClientWallet);
            } catch (err) {
              console.warn('Erro ao processar carteira do passageiro:', err);
            }
          }

          // 3. Cancelar no banco com justificativa
          await dbCancelRide(rideId, 'Cancelado pelo passageiro (após 5 minutos - taxa de R$ 15,00 repassada ao motorista)', 'client');
          setCurrentRideId(null);
          fetchRides();
          showToast(`Corrida cancelada. Taxa de ${formatCurrency(CANCELLATION_FEE)} repassada ao motorista.`, 'warning');
        },
        undefined,
        {
          title: 'Cancelar Corrida com Taxa',
          confirmLabel: `Sim, Cancelar e Pagar ${formatCurrency(CANCELLATION_FEE)}`,
          cancelLabel: 'Manter Corrida',
          type: 'confirm'
        }
      );
    }
  };

  // Ações do Motorista
  const handleAcceptRide = async (rideId: string) => {
    const driverId = currentUser?.id || 'driver_demo_01';
    const driverName = currentUser?.fullName || 'Motorista Parceiro';
    setDismissedRideId(null);
    await dbUpdateRide(rideId, {
      driverId,
      driverName,
      status: 'accepted',
      acceptedAt: Date.now()
    });
    fetchRides();
    showToast('Corrida confirmada! Quando estiver pronto para sair, clique em Iniciar Deslocamento.', 'success');
  };

  const handleStartToPickup = async (rideId: string) => {
    await dbUpdateRide(rideId, {
      status: 'to_pickup'
    });
    // Se temos GPS atual do motorista, transmite imediatamente
    if (currentUser) {
      getCurrentPosition()
        .then(coords => dbUpdateDriverLocation(currentUser.id, coords))
        .catch(() => {});
    }
    fetchRides();
    showToast('Deslocamento iniciado! Passageiro notificado que você está a caminho.', 'info');
  };

  const handleArrivedAtPickup = async (rideId: string) => {
    const targetRide = rides.find(r => r.id === rideId);
    await dbUpdateRide(rideId, {
      status: 'arrived_at_pickup',
      arrivedAt: Date.now()
    });
    // Ao confirmar chegada ao embarque, alinha o GPS do motorista exatamente com o ponto de embarque
    if (currentUser && targetRide && targetRide.originLat && targetRide.originLng) {
      dbUpdateDriverLocation(currentUser.id, {
        latitude: targetRide.originLat,
        longitude: targetRide.originLng
      }).catch(() => {});
    }
    fetchRides();
    showToast('Chegada confirmada! O passageiro foi notificado para embarque.', 'success');
  };

  const handleStartRide = async (rideId: string) => {
    const targetRide = rides.find(r => r.id === rideId);
    await dbUpdateRide(rideId, {
      status: 'in_progress',
      startedAt: Date.now()
    });
    // Ao iniciar a corrida até o destino, garante transmissão do ponto inicial
    if (currentUser && targetRide && targetRide.originLat && targetRide.originLng) {
      dbUpdateDriverLocation(currentUser.id, {
        latitude: targetRide.originLat,
        longitude: targetRide.originLng
      }).catch(() => {});
    }
    fetchRides();
    showToast('Corrida iniciada! Passageiro a bordo e tempo contratado em andamento.', 'success');
  };

  const handleFinishRide = async (rideId: string) => {
    const targetRide = rides.find(r => r.id === rideId);
    await dbUpdateRide(rideId, {
      status: 'finished',
      finishedAt: Date.now()
    });

    // Atualizar contagem real de corridas do motorista no banco de dados
    if (targetRide?.driverId) {
      try {
        const sb = getSupabase();
        if (sb) {
          const { count } = await sb.from('rides').select('*', { count: 'exact', head: true })
            .eq('driver_id', targetRide.driverId)
            .in('status', ['finished', 'completed']);
          if (count !== null) {
            await sb.from('drivers').update({ total_rides: count }).or(`id.eq.${targetRide.driverId},user_id.eq.${targetRide.driverId}`);
          }
        }
      } catch (e) {}
    }

    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    fetchRides();
    showToast('Corrida finalizada com sucesso! Ganhos creditados.', 'success');

    // Abre modal de avaliação obrigatória para o motorista avaliar o passageiro
    if (targetRide) {
      setTimeout(() => {
        setActiveRatingRide(targetRide);
      }, 500);
    }
  };

  // Cancelamento pelo motorista com justificativa obrigatória e estorno em créditos
  const handleDriverCancelRide = async (rideId: string, reason: string) => {
    const targetRide = rides.find(r => r.id === rideId);
    await dbCancelRide(rideId, reason, 'driver');
    
    // Se a corrida foi paga online (Pix/Cartão), estorna para a carteira do passageiro
    if (targetRide && targetRide.paymentMethod !== 'cash' && targetRide.clientId) {
      try {
        await addWalletCredit(
          targetRide.clientId,
          targetRide.total,
          `Estorno de corrida #${targetRide.id.slice(-6)} cancelada pelo motorista (${reason})`,
          targetRide.id
        );
      } catch (err) {
        console.warn('Erro ao creditar saldo na carteira do passageiro:', err);
      }
    }

    fetchRides();
    showToast('Corrida cancelada com sucesso. O passageiro foi notificado da justificativa e ressarcido.', 'info');
  };

  // Alternar modo online do motorista aguardando validação e gravação no Supabase
  const handleToggleDriverOnline = async () => {
    if (isTogglingOnline) return;

    if (!isDriverOnline) {
      // 1. O Gateway precisa estar operacional para o motorista poder ficar online
      if (!gatewayOperational) {
        showAlert(
          'O recebimento de novos chamados está momentaneamente em manutenção preventiva no sistema de pagamentos. O serviço será normalizado em instantes para que você possa ficar online.',
          'warning',
          'Serviço em Manutenção Preventiva'
        );
        return;
      }

      // Para ficar ONLINE e receber chamados, o cadastro deve estar validado ou ser admin
      const isApproved = driverProfile?.verificationStatus === 'approved' || isUserAdmin;
      if (!isApproved) {
        showAlert(
          'Para ativar o modo ONLINE e receber solicitações de corridas, é necessário que seus dados de CNH, Veículo e Documentos estejam cadastrados e aprovados pela administração.',
          'warning',
          'Aprovação Pendente'
        );
        setShowDriverProfileEdit(true);
        return;
      }
    }

    const nextStatus = !isDriverOnline;
    setIsTogglingOnline(true);
    try {
      if (currentUser) {
        const res = await dbUpdateDriverOnlineStatus(currentUser.id, nextStatus);
        if (!res.success) {
          showAlert(`Não foi possível atualizar o status no banco: ${res.error || 'Falha de comunicação'}`, 'error', 'Erro');
          return;
        }

        // Se ativou modo ONLINE, envia imediatamente o GPS real do dispositivo
        if (nextStatus) {
          try {
            const coords = await getCurrentPosition();
            await dbUpdateDriverLocation(currentUser.id, coords);
          } catch (e) {}
        }
      }
      // SÓ efetiva a mudança na interface após confirmação de sucesso do banco!
      setIsDriverOnline(nextStatus);
      showToast(nextStatus ? 'Você está ONLINE e visível no radar!' : 'Você está OFFLINE.', nextStatus ? 'success' : 'info');
    } catch (e: any) {
      showAlert('Erro ao atualizar status online no banco de dados.', 'error', 'Erro');
    } finally {
      setIsTogglingOnline(false);
    }
  };

  // Transmissão Contínua do GPS Real do Motorista em Tempo Real quando ONLINE
  useEffect(() => {
    if (!isDriverOnline || !currentUser) return;

    // Transmissão inicial
    getCurrentPosition()
      .then(coords => dbUpdateDriverLocation(currentUser.id, coords))
      .catch(() => {});

    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          dbUpdateDriverLocation(currentUser.id, { latitude, longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    // Intervalo de segurança a cada 5 segundos
    const interval = setInterval(async () => {
      try {
        const coords = await getCurrentPosition();
        dbUpdateDriverLocation(currentUser.id, coords);
      } catch (e) {}
    }, 5000);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, [isDriverOnline, currentUser?.id]);

  // ========================================================
  // CÁLCULOS E EFEITOS DO SISTEMA (DECLARADOS ANTES DO RENDER CONDICIONAL PARA RESPEITAR AS REGRAS DOS HOOKS DO REACT)
  // ========================================================
  const isRideActive = (status?: string) => status === 'searching' || status === 'accepted' || status === 'to_pickup' || status === 'arrived_at_pickup' || status === 'in_progress';

  // Todas as corridas agendadas ativas do passageiro (exibidas na aba Agendadas com cards expansíveis)
  const clientScheduledRides = rides.filter(r => 
    currentUser && 
    r.clientId === currentUser.id && 
    r.isScheduled && 
    isRideActive(r.status)
  );

  // Solicitação imediata do passageiro (apenas esta substitui o formulário na aba Solicitar)
  const activeClientImmediateRide = 
    (currentRideId ? rides.find(r => r.id === currentRideId && !r.isScheduled && isRideActive(r.status)) : null) || 
    rides.find(r => currentUser && r.clientId === currentUser.id && !r.isScheduled && isRideActive(r.status)) ||
    null;

  // activeClientRide permanece vinculado à corrida imediata para não bloquear a interface de novos pedidos
  const activeClientRide = activeClientImmediateRide;
  const pendingRides = rides.filter(r => {
    if (r.status !== 'searching') return false;
    // Administradores veem todas para testes e controle
    if (!isUserAdmin && r.requiredAmenities && r.requiredAmenities.length > 0) {
      if (!driverHasAllAmenities(driverProfile?.amenities, r.requiredAmenities)) {
        return false;
      }
    }
    return true;
  });
  const myDriverRides = rides.filter(r => (r.status === 'accepted' || r.status === 'to_pickup' || r.status === 'arrived_at_pickup' || r.status === 'in_progress') && (r.driverId === currentUser?.id || !r.driverId));

  // Corrida cancelada recente para alertar o motorista (apenas se recente e não descartada no banco/local)
  const cancelledRideForDriver = rides.find(r => {
    if (r.status !== 'cancelled' || r.driverId !== currentUser?.id) return false;
    if (r.driverAcknowledgedAt) return false;
    if (dismissedCancellationIds.includes(r.id)) return false;
    const rideTime = (r as any).cancelledAt || r.finishedAt || r.acceptedAt || r.createdAt || 0;
    const isRecent = !rideTime || (Date.now() - rideTime) < 6 * 3600 * 1000;
    return isRecent;
  });

  // Corrida cancelada recente para alertar o passageiro com a justificativa
  // CRÍTICO: Só deve alertar se a corrida foi realmente cancelada pelo motorista com motorista atribuído, e recente (< 20 min)
  const cancelledRideForClient = rides.find(r => {
    if (r.status !== 'cancelled' || r.clientId !== currentUser?.id) return false;
    if (r.cancelledBy !== 'driver' || !r.driverId) return false;
    if (dismissedCancellationIds.includes(r.id)) return false;
    const rideTime = (r as any).cancelledAt || r.finishedAt || r.acceptedAt || r.createdAt || 0;
    return (Date.now() - rideTime) < 20 * 60 * 1000;
  });

  // Identificar se a solicitação do cliente está em busca de motorista
  const isClientRideSearching = activeClientRide?.status === 'searching';
  
  // Limite máximo de busca: 10 minutos (600 segundos)
  const MAX_SEARCH_DURATION_SECS = 600;
  const searchElapsedSeconds = isClientRideSearching 
    ? Math.max(0, Math.floor((now - (activeClientRide.createdAt || now)) / 1000))
    : 0;
  const searchSecondsRemaining = Math.max(0, MAX_SEARCH_DURATION_SECS - searchElapsedSeconds);
  const searchRemainingMinutes = Math.floor(searchSecondsRemaining / 60);
  const searchRemainingSecs = searchSecondsRemaining % 60;
  const formattedSearchCountdown = `${String(searchRemainingMinutes).padStart(2, '0')}:${String(searchRemainingSecs).padStart(2, '0')}`;

  // Efeito de auto-cancelamento quando: 1) Passar de 10 min OU 2) Não houver nenhum motorista online
  useEffect(() => {
    if (!currentUser) return;
    if (activeClientRide && activeClientRide.status === 'searching') {
      // Não auto-cancelar enquanto o passageiro ainda estiver no modal de pagamento Pix
      if (pixModalData) return;

      // Não auto-cancelar corridas agendadas (sem tempo de cancelamento por timeout para motorista planejar agenda)
      const isRideScheduled = Boolean(
        activeClientRide.isScheduled || 
        activeClientRide.scheduledFor || 
        (activeClientRide as any).ride_type === 'scheduled' || 
        (activeClientRide as any).rideType === 'scheduled'
      );
      if (isRideScheduled) return;

      // Caso 1: Passou de 10 minutos de busca
      if (searchElapsedSeconds >= MAX_SEARCH_DURATION_SECS) {
        dbCancelRide(activeClientRide.id);
        setSearchCancellationReason({
          rideId: activeClientRide.id,
          reason: 'timeout_10min'
        });
        fetchRides();
        return;
      }

      // Caso 2: Nenhum motorista online e já buscou por pelo menos 45 segundos
      if (allDriversList.length > 0 && onlineDriversCount === 0 && searchElapsedSeconds >= 45) {
        dbCancelRide(activeClientRide.id);
        setSearchCancellationReason({
          rideId: activeClientRide.id,
          reason: 'no_drivers_online'
        });
        fetchRides();
        return;
      }
    }
  }, [currentUser?.id, activeClientRide?.id, activeClientRide?.status, searchElapsedSeconds, onlineDriversCount, allDriversList.length]);

  // Contador de 5 minutos para cancelamento gratuito pelo cliente após o aceite
  const acceptedTimestamp = activeClientRide?.acceptedAt || activeClientRide?.createdAt || Date.now();
  const secondsSinceAccepted = Math.floor((now - acceptedTimestamp) / 1000);
  const cancelSecondsRemaining = Math.max(0, 300 - secondsSinceAccepted);
  const cancelMinutes = Math.floor(cancelSecondsRemaining / 60);
  const cancelSecs = cancelSecondsRemaining % 60;
  const formattedCountdown = `${String(cancelMinutes).padStart(2, '0')}:${String(cancelSecs).padStart(2, '0')}`;
  const canCancelAccepted = cancelSecondsRemaining > 0;

  // Notificações e Sons em Tempo Real para o Passageiro
  const lastActiveRideRef = useRef<DbRide | null>(null);
  useEffect(() => {
    if (activeClientRide) {
      lastActiveRideRef.current = activeClientRide;
    }
  }, [activeClientRide]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client') return;
    const currentStatus = activeClientRide?.status || null;

    if (lastClientRideStatus && currentStatus && lastClientRideStatus !== currentStatus) {
      if (lastClientRideStatus === 'searching' && currentStatus === 'accepted') {
        sendAppNotification({
          title: '✅ Motorista Confirmado!',
          body: `${activeClientRide?.driverName || 'O motorista parceiro'} confirmou sua chamada e está se preparando para sair. Aguarde o aviso de deslocamento.`,
          soundType: 'accepted'
        });
        showToast('Motorista confirmado! Aguardando início do deslocamento.', 'info');
      } else if (currentStatus === 'to_pickup') {
        sendAppNotification({
          title: '🚗 Motorista a Caminho!',
          body: `${activeClientRide?.driverName || 'O motorista parceiro'} iniciou o deslocamento e está a caminho do seu local de embarque!`,
          soundType: 'accepted'
        });
        showToast('Motorista a caminho do seu local de embarque!', 'success');
      } else if (currentStatus === 'arrived_at_pickup') {
        sendAppNotification({
          title: '📍 Motorista Chegou ao Embarque!',
          body: `${activeClientRide?.driverName || 'O motorista'} está aguardando você no local de embarque.`,
          soundType: 'accepted'
        });
        showToast('📍 Motorista chegou e está aguardando você no ponto de partida!', 'success');
      } else if (currentStatus === 'in_progress') {
        sendAppNotification({
          title: '🏁 Corrida Iniciada!',
          body: 'Sua viagem começou! O tempo de serviço contratado está sendo contabilizado.',
          soundType: 'in_progress'
        });
        showToast('Sua corrida começou! Tempo contratado em andamento.', 'info');
      } else if (currentStatus === 'finished') {
        const finishedRide = activeClientRide || lastActiveRideRef.current;
        sendAppNotification({
          title: '✅ Corrida Concluída!',
          body: 'Você chegou ao seu destino. Obrigado por viajar com o DriveHora!',
          soundType: 'finished'
        });
        showToast('Corrida concluída com sucesso!', 'success');
        if (finishedRide) {
          setTimeout(() => {
            setActiveRatingRide(finishedRide);
          }, 600);
        }
      }
    } else if (!currentStatus && lastClientRideStatus) {
      // Caso a corrida tenha sido finalizada ou cancelada e activeClientRide virou null
      const lastRide = lastActiveRideRef.current;
      if (lastRide) {
        if (lastClientRideStatus === 'in_progress') {
          // Finalizada pelo motorista
          sendAppNotification({
            title: '✅ Corrida Concluída!',
            body: 'Você chegou ao seu destino. Obrigado por viajar com o DriveHora!',
            soundType: 'finished'
          });
          showToast('Corrida concluída com sucesso!', 'success');
          setTimeout(() => {
            setActiveRatingRide(lastRide);
          }, 600);
        }
      }
    }

    setLastClientRideStatus(currentStatus);
  }, [activeClientRide?.status, currentUser?.id, currentUser?.role, lastClientRideStatus]);

  // Notificação e Alerta Sonoro para o Motorista ao receber nova chamada pendente
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'driver' || !isDriverOnline) return;
    if (incomingRide && incomingRide.id !== notifiedIncomingRideId && driverSecondsRemaining > 0) {
      setNotifiedIncomingRideId(incomingRide.id);
      sendAppNotification({
        title: '🔔 Nova Solicitação de Corrida!',
        body: `${incomingRide.hours}h de serviço (${formatCurrency(incomingRide.driverNet)} líquidos) • Partida: ${incomingRide.origin}`,
        soundType: 'new_ride'
      });
    }
  }, [incomingRide?.id, isDriverOnline, currentUser?.id, currentUser?.role, notifiedIncomingRideId, driverSecondsRemaining]);

  // ========================================================
  // 1. TELA INICIAL: PÁGINA DE LOGIN OBRIGATÓRIA (SE NÃO LOGADO)
  // ========================================================
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <LoginPage
          onLoginSuccess={(user) => {
            const isAdmin = isSuperAdminEmail(user.email) || user.role === 'admin' || user.isAdmin;
            if (isAdmin) {
              user.isAdmin = true;
              setActiveTab('admin');
            } else if (user.role === 'driver') {
              setActiveTab('driver');
            } else {
              setActiveTab('client');
            }
            setCurrentUser(user);
            setIsLoadingProfile(!isAdmin);
          }}
        />
        {forcedLogoutNotice && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 15, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div style={{
              background: '#0d1527',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '24px',
              padding: '32px 28px',
              maxWidth: '460px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.2)',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: '#ef4444'
              }}>
                <ShieldAlert size={36} />
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
                Sessão Desconectada
              </h3>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Sua conta foi conectada em outro dispositivo: <br />
                <strong style={{ color: '#ef4444' }}>{forcedLogoutNotice.activeDevice}</strong>.
              </p>

              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '0.82rem',
                color: '#fca5a5',
                marginBottom: '24px',
                lineHeight: 1.4
              }}>
                🔒 Por medidas de segurança e para evitar compartilhamento de contas entre vários motoristas/passageiros, é permitido apenas um acesso simultâneo por usuário.
              </div>

              <button
                onClick={() => setForcedLogoutNotice(null)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--primary-gradient)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)'
                }}
              >
                Entendido, Fazer Novo Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // 2. TELA DO SISTEMA LOGADO
  // ========================================================

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Barra de Notificações / Permissão do Navegador */}
      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
        <div style={{
          background: 'linear-gradient(90deg, #4338ca, #6366f1)',
          color: '#fff',
          padding: '8px 16px',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          zIndex: 60
        }}>
          <span>🔔 Ative as notificações sonoras para ser alertado quando o motorista estiver a caminho ou novos chamados chegarem:</span>
          <button
            type="button"
            onClick={() => {
              requestNotificationPermission().then(perm => {
                if (perm === 'granted') {
                  showToast('Notificações e alertas sonoros ativados com sucesso!', 'success');
                }
              });
            }}
            style={{
              background: '#fff',
              color: '#4338ca',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            Ativar Notificações
          </button>
        </div>
      )}

      {/* Top Header Logado */}
      <header className="app-header" style={{
        background: 'rgba(9, 13, 22, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '10px 16px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Linha 1: Logo & Marca na Esquerda + Usuário / Supabase na Direita */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {/* Logo & Marca */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'var(--primary-gradient)',
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                flexShrink: 0
              }}>
                <Car size={22} color="#fff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="app-brand-title">DriveHora</span>
                  {isUserAdmin ? (
                    <span style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}>
                      <Crown size={11} /> <span className="hide-on-mobile">Admin</span>
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      padding: '2px 6px',
                      borderRadius: '8px'
                    }}>v1.0</span>
                  )}
                </div>
              </div>
            </div>

            {/* Usuário & Logout & Supabase */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isUserAdmin && (
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="hide-on-mobile"
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
                  <Database size={13} />
                  <span>{supabaseConnected ? 'Supabase ✅' : 'Supabase'}</span>
                </button>
              )}

              {/* Alternador de Tema Segmentado Moderno */}
              <div
                onClick={toggleTheme}
                role="button"
                tabIndex={0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: theme === 'light' ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
                  padding: '3px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  border: `1px solid ${theme === 'light' ? '#cbd5e1' : 'var(--border-subtle)'}`,
                  userSelect: 'none',
                  transition: 'all 0.2s ease',
                  gap: '2px'
                }}
                title={theme === 'light' ? 'Modo Claro ativo (clique para alternar para Escuro)' : 'Modo Escuro ativo (clique para alternar para Claro)'}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '16px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: theme === 'light' ? '#ffffff' : 'transparent',
                  color: theme === 'light' ? '#2563eb' : 'var(--text-muted)',
                  boxShadow: theme === 'light' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}>
                  <Sun size={12} color={theme === 'light' ? '#f59e0b' : 'currentColor'} />
                  <span className="hide-on-mobile">Claro</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '16px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: theme === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: theme === 'dark' ? '#a5b4fc' : '#64748b',
                  boxShadow: theme === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none',
                  border: theme === 'dark' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}>
                  <Moon size={12} color={theme === 'dark' ? '#818cf8' : 'currentColor'} />
                  <span className="hide-on-mobile">Escuro</span>
                </div>
              </div>

              <div className="user-header-card">
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: isUserAdmin ? '#f59e0b' : currentUser.role === 'driver' ? '#10b981' : '#6366f1',
                  color: isUserAdmin ? '#000' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  flexShrink: 0
                }}>
                  {isUserAdmin ? '👑' : currentUser.fullName.charAt(0)}
                </div>
                <div className="hide-on-mobile" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="user-name" style={{ fontSize: '0.75rem', fontWeight: 700, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <span className="user-role" style={{ fontSize: '0.6rem', color: isUserAdmin ? '#f59e0b' : undefined }}>
                    {isUserAdmin ? 'Admin' : currentUser.role === 'client' ? 'Passageiro' : 'Motorista'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sair e voltar ao Login"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '6px',
                    flexShrink: 0
                  }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Linha 2: Navegação Horizontal Responsiva (Sem Quebras ou Informações Cortadas) */}
          <nav className="header-nav-container" style={{
            padding: '4px 6px',
            borderRadius: '12px'
          }}>
            {isUserAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`header-tab-btn ${activeTab === 'admin' ? 'active admin' : ''}`}
                style={{
                  background: activeTab === 'admin' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                  color: activeTab === 'admin' ? '#000' : '#f59e0b',
                  fontWeight: 700
                }}
              >
                <Crown size={14} />
                <span className="hide-on-mobile">Painel </span>
                <span>Admin</span>
              </button>
            )}

            {/* Aba do Passageiro (Exibida para Clientes e SuperAdmin) */}
            {(currentUser.role === 'client' || isUserAdmin) && (
              <button
                onClick={() => setActiveTab('client')}
                className={`header-tab-btn ${activeTab === 'client' ? 'active' : ''}`}
                style={{
                  background: activeTab === 'client' ? 'var(--primary-gradient)' : 'transparent',
                  color: activeTab === 'client' ? '#fff' : undefined
                }}
              >
                <Users size={14} />
                <span>Passageiro</span>
              </button>
            )}

            {/* Aba do Motorista (Exibida para Motoristas e SuperAdmin) */}
            {(currentUser.role === 'driver' || isUserAdmin) && (
              <button
                onClick={() => {
                  setActiveTab('driver');
                  setShowDriverProfileEdit(false);
                }}
                className={`header-tab-btn ${activeTab === 'driver' ? 'active driver' : ''}`}
                style={{
                  background: activeTab === 'driver' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                  color: activeTab === 'driver' ? '#fff' : undefined
                }}
              >
                <Car size={14} />
                <span>Motorista</span>
                {pendingRides.length > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.65rem',
                    padding: '1px 5px',
                    borderRadius: '10px'
                  }}>{pendingRides.length}</span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('mobile')}
              className={`header-tab-btn ${activeTab === 'mobile' ? 'active mobile' : ''}`}
              style={{
                background: activeTab === 'mobile' ? '#f59e0b' : 'transparent',
                color: activeTab === 'mobile' ? '#000' : undefined
              }}
            >
              <Share2 size={14} />
              <span>Compartilhar</span>
            </button>

            {/* Saldo Discreto do Passageiro com Toggle de Ocultar/Exibir (Eye) */}
            {clientWallet && (currentUser.role === 'client' || (isUserAdmin && activeTab === 'client')) && (
              <div
                className="header-saldo-badge"
                onClick={toggleHideBalance}
                style={{
                  background: clientWallet.balance >= 0 ? (theme === 'light' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.12)') : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${clientWallet.balance >= 0 ? (theme === 'light' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.35)') : 'rgba(239, 68, 68, 0.35)'}`,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  userSelect: 'none'
                }}
                title={hideBalance ? "Clique para exibir o saldo" : "Clique para ocultar o saldo"}
              >
                <span className="saldo-label" style={{ fontSize: '0.72rem', color: clientWallet.balance >= 0 ? (theme === 'light' ? '#047857' : '#a7f3d0') : '#ef4444', fontWeight: 600 }}>
                  Saldo
                </span>
                <strong className="saldo-value" style={{ fontSize: '0.82rem', color: clientWallet.balance >= 0 ? (theme === 'light' ? '#059669' : '#10b981') : '#ef4444', fontWeight: 800 }}>
                  {hideBalance ? '••••••' : formatCurrency(clientWallet.balance)}
                </strong>
                {hideBalance ? (
                  <EyeOff size={13} style={{ color: clientWallet.balance >= 0 ? (theme === 'light' ? '#059669' : '#10b981') : '#ef4444', opacity: 0.8 }} />
                ) : (
                  <Eye size={13} style={{ color: clientWallet.balance >= 0 ? (theme === 'light' ? '#059669' : '#10b981') : '#ef4444', opacity: 0.8 }} />
                )}
              </div>
            )}
          </nav>
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

      {/* ======================================================== */}
      {/* MODAL DE ALERTA VISUAL E SONORO DE NOVA CORRIDA (MOTORISTA ONLINE) */}
      {/* ======================================================== */}
      {activeTab === 'driver' && isDriverOnline && incomingRide && incomingRide.clientId !== currentUser?.id && incomingRide.id !== dismissedRideId && driverSecondsRemaining > 0 && (
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
          zIndex: 999,
          padding: '16px'
        }}>
          <div className="animate-modal-alert" style={{
            maxWidth: '540px',
            width: '100%',
            background: 'linear-gradient(145deg, #0b1120, #1e1b4b)',
            border: '2px solid #6366f1',
            borderRadius: '24px',
            padding: '26px',
            boxShadow: '0 0 50px rgba(99, 102, 241, 0.6), 0 20px 40px rgba(0,0,0,0.8)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Barra superior de contagem regressiva animada (apenas para imediatas) */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              background: 'rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                height: '100%',
                width: incomingRide.isScheduled ? '100%' : `${(driverSecondsRemaining / DRIVER_ACCEPT_TIMEOUT_SECS) * 100}%`,
                background: incomingRide.isScheduled 
                  ? 'linear-gradient(90deg, #3b82f6, #6366f1)' 
                  : driverSecondsRemaining <= 10 
                  ? 'linear-gradient(90deg, #ef4444, #f97316)' 
                  : 'linear-gradient(90deg, #10b981, #6366f1)',
                transition: 'width 1s linear'
              }} />
            </div>

            {/* Cabeçalho do Alerta com Som e Temporizador Circular */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Indicador Circular de Radar com Sino */}
                <div style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="animate-sonar-ring-1" style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `2px solid ${incomingRide.isScheduled ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)'}`
                  }}></div>
                  <div className="animate-sonar-ring-2" style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `2px solid ${incomingRide.isScheduled ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`
                  }}></div>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: incomingRide.isScheduled 
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(30, 58, 138, 0.5))' 
                      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(127, 29, 29, 0.5))',
                    border: `1.5px solid ${incomingRide.isScheduled ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: incomingRide.isScheduled ? '#60a5fa' : '#ef4444'
                  }}>
                    <BellRing size={22} className="animate-bounce" />
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                    {incomingRide.isScheduled ? '📅 CORRIDA AGENDADA!' : 'NOVA SOLICITAÇÃO!'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: incomingRide.isScheduled ? '#93c5fd' : '#a5b4fc', fontWeight: 600 }}>
                    {incomingRide.isScheduled 
                      ? `Prevista para: ${formatScheduledDate(incomingRide.scheduledFor)}`
                      : 'Aceite antes do tempo esgotar'}
                  </span>
                </div>
              </div>

              {/* Badges de Contagem Regressiva e Controle de Som */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {incomingRide.isScheduled ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    background: 'rgba(59, 130, 246, 0.25)',
                    border: '1.5px solid #3b82f6',
                    color: '#93c5fd',
                    fontWeight: 800,
                    fontSize: '0.85rem'
                  }}>
                    <Calendar size={15} />
                    <span>Na Agenda</span>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    background: driverSecondsRemaining <= 10 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.25)',
                    border: `1.5px solid ${driverSecondsRemaining <= 10 ? '#ef4444' : '#6366f1'}`,
                    color: driverSecondsRemaining <= 10 ? '#fca5a5' : '#c7d2fe',
                    fontWeight: 800,
                    fontSize: '0.9rem'
                  }}>
                    <Clock size={16} className={driverSecondsRemaining <= 10 ? 'animate-spin' : ''} />
                    <span>{driverSecondsRemaining}s</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="btn-outline"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title={isMuted ? 'Desmutar alerta sonoro' : 'Mutar alerta sonoro'}
                >
                  {isMuted ? <VolumeX size={16} color="#ef4444" /> : <Volume2 size={16} color="#10b981" />}
                </button>
              </div>
            </div>

            {/* Banner de Motorista Favorito VIP */}
            {Boolean(
              (currentUser?.id && incomingRide.favoriteDriverIds?.includes(currentUser.id)) ||
              (driverProfile?.id && incomingRide.favoriteDriverIds?.includes(driverProfile.id))
            ) && (
              <div style={{
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))',
                border: '1.5px solid rgba(245, 158, 11, 0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#fef08a',
                fontSize: '0.84rem',
                fontWeight: 800,
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)'
              }}>
                <Heart size={18} fill="#ef4444" color="#ef4444" style={{ flexShrink: 0 }} />
                <span>⭐ VOCÊ É MOTORISTA FAVORITO DESTE PASSAGEIRO! Chamada prioritária exclusiva.</span>
              </div>
            )}

            {/* Itinerário */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', marginTop: '5px' }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 Ponto de Partida</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{incomingRide.origin}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981', marginTop: '5px' }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🏁 Destino Principal / Roteiro</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{incomingRide.destination}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '6px' }}>
                <span>👤 Passageiro: <strong>{incomingRide.clientName || 'Passageiro DriveHora'}</strong></span>
                <span>⏱️ Tempo: <strong>{incomingRide.hours} Horas</strong> ({formatCurrency(incomingRide.hourlyRate)}/h)</span>
              </div>

              {/* Comodidades Requeridas (se houver) */}
              {safeAmenitiesArray(incomingRide.requiredAmenities).length > 0 && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.75rem',
                  color: '#93c5fd'
                }}>
                  <span>✨ <strong>Comodidades Requeridas:</strong></span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {safeAmenitiesArray(incomingRide.requiredAmenities).map(am => (
                      <span key={am} style={{ background: 'rgba(59, 130, 246, 0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {am === 'acessibilidade_pcd' ? '♿ Adaptado PCD' : am === 'ar_condicionado' ? '❄️ Ar-Condicionado' : am === 'pet_friendly' ? '🐾 Pet Friendly' : am}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Forma de Pagamento */}
              <div style={{
                marginTop: '4px',
                padding: '8px 12px',
                borderRadius: '10px',
                background: incomingRide.paymentMethod === 'cash' || incomingRide.paymentMethod === 'card_machine' 
                  ? 'rgba(245, 158, 11, 0.15)' 
                  : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${incomingRide.paymentMethod === 'cash' || incomingRide.paymentMethod === 'card_machine' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>💳 Pagamento:</span>
                <strong style={{
                  color: incomingRide.paymentMethod === 'cash' || incomingRide.paymentMethod === 'card_machine' ? '#f59e0b' : '#10b981',
                  fontWeight: 800
                }}>
                  {incomingRide.paymentMethod === 'pix' && '⚡ Pix pelo App'}
                  {incomingRide.paymentMethod === 'credit_card' && '💳 Cartão pelo App'}
                  {incomingRide.paymentMethod === 'cash' && `💵 Cobrar em Dinheiro (${formatCurrency(incomingRide.total)})`}
                  {incomingRide.paymentMethod === 'card_machine' && `📱 Cobrar na sua Maquininha (${formatCurrency(incomingRide.total)})`}
                  {!incomingRide.paymentMethod && '⚡ Pagamento Digital App'}
                </strong>
              </div>
            </div>

            {/* Demonstrativo Financeiro Completo com Taxa Abatida */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>Valor Total da Corrida:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{formatCurrency(incomingRide.total)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#f87171', marginBottom: '8px' }}>
                <span>Taxa da Plataforma (15%):</span>
                <span>- {formatCurrency(incomingRide.commission)}</span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '8px 0' }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>SEU GANHO LÍQUIDO:</span>
                <strong style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                  {formatCurrency(incomingRide.driverNet)}
                </strong>
              </div>
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => handleAcceptRide(incomingRide.id)}
                className="btn-success"
                style={{
                  flex: 2,
                  padding: '16px',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)'
                }}
              >
                <CheckCircle2 size={22} />
                <span>{incomingRide.isScheduled ? 'ACEITAR NA MINHA AGENDA' : 'ACEITAR'} ({formatCurrency(incomingRide.driverNet)}){!incomingRide.isScheduled ? ` • ${driverSecondsRemaining}s` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => setDismissedRideId(incomingRide.id)}
                className="btn-outline"
                style={{ flex: 1, padding: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}
              >
                {incomingRide.isScheduled ? 'Dispensar' : 'Dispensar'}
              </button>
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
            onReloadRides={fetchRides}
            onLogout={handleLogout}
          />
        )}

        {/* TAB 1: CLIENTE (PASSAGEIRO) */}
        {activeTab === 'client' && (
          <div>
            {isLoadingProfile && (!clientProfile || !clientProfile.isProfileComplete) ? (
              <div style={{
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  position: 'relative',
                  width: '84px',
                  height: '84px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '3px solid rgba(99, 102, 241, 0.15)',
                    borderTopColor: '#6366f1',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <Car size={36} color="#6366f1" style={{ animation: 'pulse 2s infinite' }} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Preparando o DriveHora...
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                  Verificando seu cadastro e carregando a tela de solicitações.
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '20px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.8rem',
                  color: '#818cf8',
                  fontWeight: 600
                }}>
                  <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>Sincronizando dados com o servidor...</span>
                </div>
              </div>
            ) : !isUserAdmin && currentUser.role === 'client' && (!clientProfile || !clientProfile.isProfileComplete) ? (
              <ClientOnboarding
                user={currentUser}
                initialProfile={clientProfile}
                onComplete={(cp) => {
                  setClientProfile(cp);
                  setIsLoadingProfile(false);
                }}
              />
            ) : (
              <div>
                {/* Switcher de Sub-Abas do Passageiro (Visível apenas em Desktop) */}
                <div className="client-subnav-desktop" style={{ gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setClientSubTab('request')}
                    className={clientSubTab === 'request' ? 'btn-primary' : 'btn-outline'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', borderRadius: '14px' }}
                  >
                    <Car size={18} />
                    <span>Solicitar Corrida</span>
                  </button>

                  <button
                    onClick={() => setClientSubTab('scheduled')}
                    className={clientSubTab === 'scheduled' ? 'btn-primary' : 'btn-outline'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', borderRadius: '14px', position: 'relative' }}
                  >
                    <Calendar size={18} />
                    <span>Agendadas</span>
                    {clientScheduledRides.length > 0 && (
                      <span style={{
                        background: '#f59e0b',
                        color: '#000',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        marginLeft: '4px'
                      }}>
                        {clientScheduledRides.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setClientSubTab('nearby_radar')}
                    className={clientSubTab === 'nearby_radar' ? 'btn-primary' : 'btn-outline'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', borderRadius: '14px' }}
                  >
                    <Radio size={18} className="animate-pulse" />
                    <span>Motoristas Próximos (Radar)</span>
                  </button>

                  <button
                    onClick={() => setClientSubTab('favorites')}
                    className={clientSubTab === 'favorites' ? 'btn-primary' : 'btn-outline'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', borderRadius: '14px' }}
                  >
                    <Heart size={18} fill={clientSubTab === 'favorites' ? '#fff' : '#ef4444'} color={clientSubTab === 'favorites' ? '#fff' : '#ef4444'} />
                    <span>Meus Favoritos (VIP)</span>
                  </button>

                  <button
                    onClick={() => setClientSubTab('history')}
                    className={clientSubTab === 'history' ? 'btn-primary' : 'btn-outline'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', borderRadius: '14px' }}
                  >
                    <Clock size={18} />
                    <span>Histórico de Corridas</span>
                  </button>

                  <button
                    onClick={() => setClientSubTab('profile')}
                    className={clientSubTab === 'profile' ? 'btn-primary' : 'btn-outline'}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.9rem', borderRadius: '14px' }}
                  >
                    <UserCheck size={18} />
                    <span>Meus Dados & CPF</span>
                    {(!clientProfile?.cpf || clientProfile.cpf.replace(/\D/g, '').length !== 11) && (
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                        Completar
                      </span>
                    )}
                  </button>
                </div>

                {clientSubTab === 'profile' && currentUser && (
                  <ClientProfileManager
                    user={currentUser}
                    initialProfile={clientProfile}
                    isApproved={Boolean(clientProfile?.isProfileComplete || (clientProfile as any)?.verificationStatus === 'approved')}
                    hasCompletedRides={rides.some(r => r.clientId === currentUser.id && (r.status === 'finished' || (r.status as string) === 'completed'))}
                    isUserAdmin={isUserAdmin}
                    onSaveSuccess={(updated) => {
                      setClientProfile(updated);
                      if (updated.fullName) {
                        setCurrentUser(prev => prev ? { ...prev, fullName: updated.fullName!, phone: updated.phone || prev.phone } : prev);
                        try {
                          const savedUser = localStorage.getItem('drivehora_current_user');
                          if (savedUser) {
                            const parsed = JSON.parse(savedUser);
                            parsed.fullName = updated.fullName;
                            if (updated.phone) parsed.phone = updated.phone;
                            localStorage.setItem('drivehora_current_user', JSON.stringify(parsed));
                          }
                        } catch (e) {}
                      }
                      setDriverProfile(prev => prev ? {
                        ...prev,
                        fullName: updated.fullName || prev.fullName,
                        driverName: updated.fullName || prev.driverName,
                        cpf: updated.cpf || prev.cpf,
                        phone: updated.phone || prev.phone
                      } : prev);
                      showToast('Dados cadastrais atualizados com sucesso em todo o sistema!', 'success');
                    }}
                  />
                )}

                {clientSubTab === 'nearby_radar' && (
                  <NearbyDriversMap 
                    clientId={currentUser.id}
                    allRides={rides}
                    favoriteDriverIds={favoriteDriverIds}
                    onOpenDriverProfile={(driver) => setSelectedDriverForProfile(driver)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectDriverToRequest={() => setClientSubTab('request')} 
                  />
                )}

                {clientSubTab === 'favorites' && (
                  <FavoriteDriversList
                    clientId={currentUser.id}
                    onOpenDriverProfile={(driver) => setSelectedDriverForProfile(driver)}
                    onSelectDriverForBooking={handleSelectDriverForBooking}
                    onExploreRadar={() => setClientSubTab('nearby_radar')}
                  />
                )}

                {/* SUB-ABA: CORRIDAS AGENDADAS DO PASSAGEIRO */}
                {clientSubTab === 'scheduled' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
                    {/* Cabeçalho da Aba Agendadas - Compacto e Elegante */}
                    <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(245, 158, 11, 0.18)',
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Calendar size={18} />
                        </div>
                        <div>
                          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Agendadas
                            {clientScheduledRides.length > 0 && (
                              <span style={{
                                background: '#f59e0b',
                                color: '#000',
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                fontWeight: 800
                              }}>
                                {clientScheduledRides.length}
                              </span>
                            )}
                          </h2>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                            Acompanhe suas viagens programadas e itinerários
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setClientSubTab('request');
                          setIsScheduledRide(true);
                        }}
                        className="btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          fontSize: '0.82rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          borderRadius: '8px'
                        }}
                      >
                        <Calendar size={14} />
                        <span>Agendar Corrida</span>
                      </button>
                    </div>

                    {/* Lista ou Estado Vazio */}
                    {clientScheduledRides.length === 0 ? (
                      <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.15)' }}>
                        <div style={{
                          width: '68px',
                          height: '68px',
                          borderRadius: '50%',
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 16px'
                        }}>
                          <Calendar size={34} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                          Nenhuma corrida agendada no momento
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                          Planeje seus deslocamentos com antecedência. Você pode marcar a data, o horário exato e selecionar comodidades especiais como transporte PCD ou veículo espaçoso.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setClientSubTab('request');
                            setIsScheduledRide(true);
                          }}
                          className="btn-primary"
                          style={{ padding: '12px 24px', fontWeight: 700 }}
                        >
                          Agendar uma Corrida Agora
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {clientScheduledRides.map(r => {
                          const isExpanded = !!expandedScheduledRideIds[r.id];
                          const assignedDriver = allDriversList.find(d => d.userId === r.driverId || d.id === r.driverId);
                          const isAssigned = Boolean(r.driverId && r.status !== 'searching');
                          const amenities = safeAmenitiesArray(r.requiredAmenities);

                          return (
                            <div
                              key={r.id}
                              className="glass-panel"
                              style={{
                                padding: 0,
                                overflow: 'hidden',
                                border: isAssigned ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                                background: isAssigned ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                                transition: 'all 0.25s ease'
                              }}
                            >
                              {/* Header do Card (Clicável para expandir) */}
                              <div
                                onClick={() => toggleScheduledRideExpand(r.id)}
                                style={{
                                  padding: '18px 20px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '14px',
                                  flexWrap: 'wrap',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                                  <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '12px',
                                    background: isAssigned ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: isAssigned ? '#10b981' : '#f59e0b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <Calendar size={20} />
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                                        {formatScheduledDate(r.scheduledFor)}
                                      </span>
                                      <span style={{
                                        fontSize: '0.7rem',
                                        padding: '3px 8px',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        background: isAssigned ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                        color: isAssigned ? '#34d399' : '#fbbf24',
                                        border: `1px solid ${isAssigned ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                                      }}>
                                        {isAssigned ? '✅ Motorista Confirmado' : '🕒 No Mural de Agendamentos'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                      {r.origin.split(',')[0]} ➔ {r.destination.split(',')[0]}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                                      {formatCurrency(r.total)}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {r.hours}h contratada{r.hours > 1 ? 's' : ''}
                                    </div>
                                  </div>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)'
                                  }}>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </div>
                              </div>

                              {/* Conteúdo Expandido com Detalhes Completos */}
                              {isExpanded && (
                                <div style={{
                                  padding: '16px 20px 20px',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                  background: 'rgba(0, 0, 0, 0.2)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '16px'
                                }}>
                                  {/* Rota Completa */}
                                  <div style={{
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>🟢 Partida:</span>
                                      <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{r.origin}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                      <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>🔴 Destino:</span>
                                      <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{r.destination}</span>
                                    </div>
                                  </div>

                                  {/* Seção do Motorista Parceiro */}
                                  {isAssigned ? (
                                    <div style={{
                                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      borderRadius: '12px',
                                      padding: '14px 16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '12px',
                                      flexWrap: 'wrap'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                          width: '44px',
                                          height: '44px',
                                          borderRadius: '50%',
                                          background: 'rgba(16, 185, 129, 0.25)',
                                          color: '#10b981',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 800,
                                          fontSize: '1.1rem'
                                        }}>
                                          {(assignedDriver?.driverName || assignedDriver?.fullName || 'M')[0].toUpperCase()}
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                                            {assignedDriver?.driverName || assignedDriver?.fullName || 'Motorista Parceiro Confirmado'}
                                          </div>
                                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                            {assignedDriver?.vehicleBrand ? `${assignedDriver.vehicleBrand} ${assignedDriver.vehicleModel} • Placa ${assignedDriver.vehiclePlate}` : 'Veículo Regularizado'}
                                          </div>
                                        </div>
                                      </div>

                                      {assignedDriver?.phone && (
                                        <div style={{ fontSize: '0.8rem', color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.15)', padding: '6px 12px', borderRadius: '8px' }}>
                                          📞 Contato: {assignedDriver.phone}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{
                                      background: 'rgba(245, 158, 11, 0.08)',
                                      border: '1px solid rgba(245, 158, 11, 0.25)',
                                      borderRadius: '12px',
                                      padding: '12px 16px',
                                      fontSize: '0.83rem',
                                      color: '#fde68a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px'
                                    }}>
                                      <Radio size={18} className="animate-pulse" color="#f59e0b" style={{ flexShrink: 0 }} />
                                      <span>
                                        <strong>Agendamento em Aberto:</strong> Esta solicitação está disponível no painel de oportunidades para os motoristas parceiros. Você receberá a confirmação assim que um motorista reservar sua agenda.
                                      </span>
                                    </div>
                                  )}

                                  {/* Comodidades Requisitadas */}
                                  {amenities.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Comodidades Requisitadas:
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {amenities.map(am => (
                                          <span
                                            key={am}
                                            style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              padding: '4px 10px',
                                              borderRadius: '8px',
                                              background: am === 'acessibilidade_pcd' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                              color: am === 'acessibilidade_pcd' ? '#93c5fd' : '#cbd5e1',
                                              border: am === 'acessibilidade_pcd' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)'
                                            }}
                                          >
                                            {am === 'acessibilidade_pcd' ? '♿ Adaptado PCD' :
                                             am === 'ar_condicionado' ? '❄️ Ar-condicionado' :
                                             am === 'porta_malas_grande' ? '🧳 Porta-malas G' :
                                             am === 'pet_friendly' ? '🐾 Pet Friendly' :
                                             am === 'cadeirinha_bebe' ? '👶 Cadeirinha' : am}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Rodapé do Card com Ações */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingTop: '10px',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                    flexWrap: 'wrap',
                                    gap: '12px'
                                  }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      ID: #{r.id.slice(-8).toUpperCase()} • Pagamento: {r.paymentMethod === 'pix' ? 'Pix' : r.paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 'Dinheiro'}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleCancelRideByClient(r.id)}
                                      className="btn-danger-outline"
                                      style={{
                                        padding: '7px 14px',
                                        fontSize: '0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                    >
                                      <Trash2 size={14} />
                                      <span>Cancelar Agendamento</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {clientSubTab === 'request' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Banner Informativo de Corridas Agendadas */}
                    {clientScheduledRides.length > 0 && !activeClientRide && (
                      <div className="glass-panel" style={{
                        padding: '14px 20px',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Calendar size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fef3c7' }}>
                              Você possui {clientScheduledRides.length} corrida{clientScheduledRides.length > 1 ? 's' : ''} agendada{clientScheduledRides.length > 1 ? 's' : ''}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '2px' }}>
                              Acompanhe os detalhes e motoristas parceiros na aba dedicada.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClientSubTab('scheduled')}
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.82rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', fontWeight: 800 }}
                        >
                          Ver Agendadas ➔
                        </button>
                      </div>
                    )}

                    {/* Banner de Aviso de Corrida Cancelada pelo Motorista com Justificativa e Estorno em Créditos */}
                    {cancelledRideForClient && !activeClientRide && (
                      <div className="glass-panel" style={{
                        padding: '18px 22px',
                        border: '1.5px solid #ef4444',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Ban size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fca5a5' }}>
                              Corrida #{cancelledRideForClient.id.slice(-6)} cancelada pelo motorista
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '3px' }}>
                              <strong>Justificativa informada:</strong> {cancelledRideForClient.cancellationReason || 'Imprevisto operacional informado pelo parceiro.'}
                              {cancelledRideForClient.paymentMethod !== 'cash' && (
                                <span style={{ color: '#34d399', display: 'block', fontWeight: 600, marginTop: '3px' }}>
                                  🎁 O valor de {formatCurrency(cancelledRideForClient.total)} já foi estornado como crédito em sua carteira!
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDismissedCancellationIds(prev => {
                              const updated = Array.from(new Set([...prev, cancelledRideForClient.id]));
                              try {
                                localStorage.setItem('drivehora_dismissed_cancellations', JSON.stringify(updated));
                              } catch {}
                              return updated;
                            });
                          }}
                          className="btn-outline"
                          style={{ padding: '8px 16px', fontSize: '0.82rem', flexShrink: 0 }}
                        >
                          Entendido
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: activeClientRide ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', maxWidth: activeClientRide ? '840px' : undefined, margin: activeClientRide ? '0 auto' : undefined, width: '100%' }}>
                      {/* Coluna da Esquerda: Ocultada quando há corrida ativa para manter a tela limpa e focada no trajeto */}
                      {!activeClientRide && (
                        clientWallet && clientWallet.balance < 0 ? (
                        <div className="glass-panel" style={{ padding: '36px 24px', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', textAlign: 'center' }}>
                          <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px'
                          }}>
                            <AlertCircle size={32} />
                          </div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                            Solicitações Bloqueadas por Débito
                          </h3>
                          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                            Identificamos um saldo devedor de <strong style={{ color: '#ef4444' }}>{formatCurrency(Math.abs(clientWallet.balance))}</strong> pendente na sua conta.
                            Para desbloquear novas viagens, envie uma mensagem ao suporte para análise e quitação.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowDebtSupportModal(true)}
                            className="btn-primary"
                            style={{
                              padding: '12px 24px',
                              fontWeight: 700,
                              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <Headphones size={18} />
                            <span>Falar com o Suporte para Quitação</span>
                          </button>
                        </div>
                      ) : (
                        /* Form de Solicitação */
                        <div className="glass-panel" style={{ padding: '28px' }}>
                          

                      
                      {/* Banner de Agendamento Direto com Motorista Favorito Selecionado */}
                      {selectedDirectDriver && (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          borderRadius: '16px',
                          padding: '14px 16px',
                          marginBottom: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              background: '#10b981',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              🚗
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ⭐ Agendamento Direto VIP
                              </div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                                {selectedDirectDriver.displayName} ({selectedDirectDriver.vehicleBrand} {selectedDirectDriver.vehicleModel})
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedDirectDriver(null)}
                            className="btn-outline"
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            title="Trocar para busca geral de motoristas"
                          >
                            Remover
                          </button>
                        </div>
                      )}

                    {/* Seletor de Modalidade: Viagem Imediata vs Corrida Agendada */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      background: theme === 'light' ? '#f1f5f9' : 'rgba(15, 23, 42, 0.65)',
                      padding: '4px',
                      borderRadius: '12px',
                      border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                      marginBottom: '16px'
                    }}>
                      <button
                        type="button"
                        onClick={() => setIsScheduledRide(false)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: !isScheduledRide ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
                          color: !isScheduledRide ? '#fff' : (theme === 'light' ? '#475569' : '#94a3b8'),
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: (!isScheduledRide && theme === 'light') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <Zap size={15} color={!isScheduledRide ? '#fef08a' : (theme === 'light' ? '#64748b' : '#94a3b8')} />
                        <span>Viagem Agora</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsScheduledRide(true)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: isScheduledRide ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'transparent',
                          color: isScheduledRide ? '#fff' : (theme === 'light' ? '#475569' : '#94a3b8'),
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: (isScheduledRide && theme === 'light') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <Calendar size={15} color={isScheduledRide ? '#93c5fd' : (theme === 'light' ? '#64748b' : '#94a3b8')} />
                        <span>Agendar Corrida</span>
                      </button>
                    </div>

                    {/* Campos Específicos para Corrida Agendada */}
                    {isScheduledRide && (
                      <div className="scheduled-ride-card">
                        <div className="schedule-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                          <Calendar size={16} />
                          <span>Data e Horário Previsto para Embarque</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Data da Viagem</label>
                            <input
                              type="date"
                              className="custom-input"
                              value={scheduledDate}
                              min={getTodayLocalDateStr()}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setScheduledDate(newDate);
                                if (newDate === getTodayLocalDateStr()) {
                                  const minTime = getMinScheduledTimeStr();
                                  if (scheduledTime < minTime) {
                                    setScheduledTime(minTime);
                                  }
                                }
                              }}
                              required={isScheduledRide}
                              style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Horário do Embarque</label>
                            <input
                              type="time"
                              className="custom-input"
                              value={scheduledTime}
                              min={scheduledDate === getTodayLocalDateStr() ? getMinScheduledTimeStr() : undefined}
                              onChange={(e) => {
                                const newTime = e.target.value;
                                if (scheduledDate === getTodayLocalDateStr()) {
                                  const minTime = getMinScheduledTimeStr();
                                  if (newTime < minTime) {
                                    showToast('O horário agendado para hoje não pode ser anterior ao atual.', 'warning');
                                    setScheduledTime(minTime);
                                    return;
                                  }
                                }
                                setScheduledTime(newTime);
                              }}
                              required={isScheduledRide}
                              style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>
                        <div className="schedule-hint" style={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
                          💡 <strong>Agenda do Parceiro:</strong> Os motoristas parceiros analisarão suas agendas para reservar o horário. Você receberá uma notificação quando um motorista aceitar!
                        </div>
                      </div>
                    )}

                  <form onSubmit={handleRequestRide} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Campo Partida com Busca Automática ao Digitar e Botão GPS Integrado */}
                    <div className="input-group" style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>📍 Ponto de Partida</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isSearchingOrigin && (
                            <span style={{ fontSize: '0.7rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <RefreshCw size={10} className="animate-spin" /> Buscando...
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleGetGpsLocation}
                            disabled={isLocatingGPS}
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              borderRadius: '8px',
                              padding: '4px 8px',
                              color: '#10b981',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}
                            title="Preencher com minha localização GPS atual"
                          >
                            <MapPin size={13} className={isLocatingGPS ? 'animate-bounce' : ''} />
                            <span>{isLocatingGPS ? 'Localizando...' : 'Meu GPS'}</span>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        className="custom-input"
                        value={origin}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrigin(val);
                          if (val.trim().length >= 2) {
                            setIsSearchingOrigin(true);
                            searchAddressPlaces(val, clientOriginCoords).then(results => {
                              setOriginSuggestions(results);
                              setIsSearchingOrigin(false);
                            });
                          } else {
                            setOriginSuggestions([]);
                          }
                        }}
                        onFocus={() => {
                          if (origin.trim().length >= 2) {
                            searchAddressPlaces(origin, clientOriginCoords).then(res => setOriginSuggestions(res));
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
                          maxHeight: '240px',
                          overflowY: 'auto'
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
                          if (val.trim().length >= 2) {
                            setIsSearchingDest(true);
                            searchAddressPlaces(val, clientOriginCoords).then(results => {
                              setDestSuggestions(results);
                              setIsSearchingDest(false);
                            });
                          } else {
                            setDestSuggestions([]);
                          }
                        }}
                        onFocus={() => {
                          if (destination.trim().length >= 2) {
                            searchAddressPlaces(destination, clientOriginCoords).then(res => setDestSuggestions(res));
                          }
                        }}
                        placeholder="Digite o destino ou local (ex: Aeroporto, Paulista, Shopping...)"
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
                          maxHeight: '240px',
                          overflowY: 'auto'
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

                    {/* Seletor de Comodidades Especiais (Ex: PCD, Ar-condicionado, Pet Friendly, etc) */}
                    <div className="input-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>✨ Comodidades do Veículo (Opcional)</label>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[
                          { id: 'acessibilidade_pcd', label: 'Adaptado PCD', icon: '♿' },
                          { id: 'ar_condicionado', label: 'Ar-Condicionado', icon: '❄️' },
                          { id: 'porta_malas', label: 'Porta-Malas Grande', icon: '🧳' },
                          { id: 'pet_friendly', label: 'Pet Friendly', icon: '🐾' },
                          { id: 'cadeirinha', label: 'Cadeirinha Bebê', icon: '👶' },
                          { id: 'wifi', label: 'Wi-Fi 5G', icon: '📶' }
                        ].map((item) => {
                          const isSelected = selectedAmenities.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedAmenities(prev =>
                                  isSelected ? prev.filter(x => x !== item.id) : [...prev, item.id]
                                );
                              }}
                              className={`amenity-chip-btn ${isSelected ? 'selected' : ''}`}
                            >
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedAmenities.includes('acessibilidade_pcd') && (
                        <div style={{
                          marginTop: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: theme === 'light' ? '#1e3a8a' : '#93c5fd',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: theme === 'light' ? '#eff6ff' : 'rgba(59, 130, 246, 0.1)',
                          border: theme === 'light' ? '1px solid #bfdbfe' : '1px solid rgba(59, 130, 246, 0.25)',
                          padding: '8px 12px',
                          borderRadius: '8px'
                        }}>
                          ♿ <span>Buscando apenas motoristas com veículo adaptado para PCD ou suporte a cadeirantes.</span>
                        </div>
                      )}
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

                    {/* Valor por hora formatado em Moeda Brasileira (R$) */}
                    <div className="input-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label>💵 Valor Ofertado por Hora (R$/h)</label>
                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                          {formatCurrency(hourlyRate)} / hora
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setHourlyRate(prev => Math.max(30, prev - 5))}
                          className="btn-outline"
                          style={{ padding: '10px 14px', fontSize: '0.9rem', fontWeight: 700, borderRadius: '10px' }}
                          title="Diminuir R$ 5 por hora"
                        >
                          - R$ 5
                        </button>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type="text"
                            className="custom-input"
                            style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}
                            value={formatCurrencyInput(hourlyRate)}
                            onChange={(e) => {
                              const parsed = parseCurrencyInput(e.target.value);
                              setHourlyRate(parsed);
                            }}
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setHourlyRate(prev => prev + 5)}
                          className="btn-outline"
                          style={{ padding: '10px 14px', fontSize: '0.9rem', fontWeight: 700, borderRadius: '10px' }}
                          title="Aumentar R$ 5 por hora"
                        >
                          + R$ 5
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>Mínimo sugerido: R$ 30,00/h</span>
                        <span>Média de mercado: R$ 50,00 - R$ 80,00/h</span>
                      </div>
                    </div>

                    {/* Seletor de Meios de Pagamento */}
                    <div className="input-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        💳 Forma de Pagamento
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                        {[
                          { id: 'pix', label: '⚡ Pix pelo App', desc: 'QR Code e Copia e Cola instantâneo' },
                          { id: 'credit_card', label: '💳 Cartão pelo App', desc: 'Crédito ou Débito online' },
                          { id: 'cash', label: '💵 Dinheiro', desc: 'Pagar ao motorista no veículo' },
                          { id: 'card_machine', label: '📱 Maquininha', desc: 'Cartão direto com o motorista' }
                        ].map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedPaymentMethod(m.id as any)}
                            className={`payment-method-card ${selectedPaymentMethod === m.id ? 'selected' : ''}`}
                          >
                            <strong style={{ fontSize: '0.8rem' }}>{m.label}</strong>
                            <span style={{ fontSize: '0.68rem' }}>{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Card de Resumo da Contratação */}
                    <div className="ride-checkout-summary-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="summary-label" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Total da Contratação:</span>
                        <strong className="summary-price" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{formatCurrency(totalAmount)}</strong>
                      </div>
                      <div className="summary-subtext" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '6px' }}>
                        <span>Período: <strong>{hours} {hours === 1 ? 'hora' : 'horas'} contratadas</strong></span>
                        <span>Valor: {formatCurrency(hourlyRate)}/h</span>
                      </div>
                    </div>

                    {/* Aviso de Indisponibilidade Momentânea caso Gateway não esteja Operacional */}
                    {!gatewayOperational && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                          <div style={{ fontSize: '0.78rem', color: '#fca5a5', lineHeight: 1.4 }}>
                            <strong>Indisponibilidade Momentânea:</strong> Estamos realizando uma breve manutenção preventiva em nosso sistema de solicitações. O serviço será normalizado em instantes. Agradecemos a compreensão.
                            {isUserAdmin && gatewayHealthMsg && (
                              <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#fecaca', opacity: 0.85 }}>
                                [Aviso Admin: {gatewayHealthMsg}]
                              </div>
                            )}
                          </div>
                        </div>
                        {isUserAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              checkGatewayHealth().then(res => {
                                if (res?.operational) {
                                  showToast('Gateway operacional! Sistema liberado.', 'success');
                                } else {
                                  showToast(res?.message || 'Gateway ainda indisponível', 'error');
                                }
                              });
                            }}
                            className="btn-outline"
                            style={{
                              padding: '6px 10px',
                              fontSize: '0.72rem',
                              whiteSpace: 'nowrap',
                              borderColor: 'rgba(252, 165, 165, 0.5)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <RefreshCw size={12} />
                            <span>Revalidar</span>
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isRequesting || !gatewayOperational}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '1rem',
                        marginTop: '8px',
                        opacity: !gatewayOperational ? 0.6 : 1,
                        cursor: !gatewayOperational ? 'not-allowed' : 'pointer',
                        background: !gatewayOperational ? 'rgba(255, 255, 255, 0.1)' : undefined
                      }}
                    >
                      {isRequesting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>Buscando motoristas disponíveis...</span>
                        </>
                      ) : !gatewayOperational ? (
                        <>
                          <AlertTriangle size={18} color="#fca5a5" />
                          <span>Solicitações Indisponíveis no Momento</span>
                        </>
                      ) : (
                        <>
                          <Car size={18} />
                          <span>
                            {clientWallet && clientWallet.balance > 0 ? (
                              clientWallet.balance >= totalAmount ? (
                                `Solicitar Motorista (Grátis via Créditos: ${formatCurrency(totalAmount)})`
                              ) : (
                                `Solicitar Motorista por ${formatCurrency(totalAmount - clientWallet.balance)} (Abatido ${formatCurrency(clientWallet.balance)})`
                              )
                            ) : (
                              `Solicitar Motorista por ${formatCurrency(totalAmount)}`
                            )}
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ))}

                {/* Status em Tempo Real da Corrida do Cliente */}
                <div id="active-ride-tracking-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {activeClientRide ? (
                    <div 
                      className={`glass-panel ${activeClientRide.status === 'searching' ? 'animate-searching-glow' : ''}`} 
                      style={{ 
                        padding: '28px', 
                        position: 'relative', 
                        overflow: 'hidden',
                        transition: 'all 0.3s ease'
                      }}
                    >
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

                      {/* Animação de Busca / Radar ou Agendamento (Visível quando procurando motorista) */}
                      {activeClientRide.status === 'searching' && (
                        activeClientRide.isScheduled ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.18) 0%, rgba(30, 41, 59, 0.5) 100%)',
                            border: '1px solid rgba(14, 165, 233, 0.4)',
                            borderRadius: '18px',
                            padding: '16px 20px',
                            marginBottom: '20px',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px',
                              flexShrink: 0,
                              boxShadow: '0 0 20px rgba(14, 165, 233, 0.5)'
                            }}>
                              📅
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>
                                  Corrida Agendada Aberta no Mural
                                </strong>
                                {activeClientRide.scheduledFor && (
                                  <span style={{
                                    fontSize: '0.78rem',
                                    color: '#38bdf8',
                                    background: 'rgba(14, 165, 233, 0.2)',
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    fontWeight: 700
                                  }}>
                                    🗓️ {formatScheduledDate(activeClientRide.scheduledFor)}
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#bae6fd', lineHeight: 1.4 }}>
                                Sua solicitação foi publicada no Mural de Agendamentos dos motoristas parceiros. Como se trata de agendamento prévio, não há prazo limite de cancelamento automático.
                              </p>
                              {safeAmenitiesArray(activeClientRide.requiredAmenities).length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                  {safeAmenitiesArray(activeClientRide.requiredAmenities).map(amenityId => (
                                    <span key={amenityId} style={{
                                      fontSize: '0.72rem',
                                      padding: '2px 8px',
                                      borderRadius: '8px',
                                      background: 'rgba(255, 255, 255, 0.1)',
                                      color: '#e2e8f0'
                                    }}>
                                      {amenityId === 'acessibilidade_pcd' ? '♿ Adaptado PCD' :
                                       amenityId === 'ar_condicionado' ? '❄️ Ar-Condicionado' :
                                       amenityId === 'porta_malas' ? '🧳 Porta-Malas Grande' :
                                       amenityId === 'pet_friendly' ? '🐾 Pet Friendly' :
                                       amenityId === 'cadeirinha' ? '👶 Cadeirinha Bebê' :
                                       amenityId === 'wifi' ? '📶 Wi-Fi 5G' : amenityId}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="passenger-radar-box">
                            {/* Ondas de Sonar Concêntricas */}
                            <div style={{
                              position: 'relative',
                              width: '56px',
                              height: '56px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <div className="animate-sonar-ring-1" style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                border: '2px solid rgba(99, 102, 241, 0.8)'
                              }} />
                              <div className="animate-sonar-ring-2" style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                border: '2px solid rgba(129, 140, 248, 0.6)'
                              }} />
                              <div className="animate-sonar-ring-3" style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                border: '2px solid rgba(165, 180, 252, 0.4)'
                              }} />
                              
                              {/* Núcleo Central do Radar */}
                              <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                boxShadow: '0 0 20px rgba(99, 102, 241, 0.8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                zIndex: 2
                              }}>
                                <Radio size={22} className="animate-radar-sweep" />
                              </div>
                            </div>

                            {/* Mensagem e Alerta de Busca Ativa com Contador de 10 min */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: onlineDriversCount > 0 ? '#10b981' : '#f59e0b',
                                    boxShadow: `0 0 8px ${onlineDriversCount > 0 ? '#10b981' : '#f59e0b'}`
                                  }} className="animate-pulse" />
                                  <strong style={{ fontSize: '0.95rem', color: '#fff', letterSpacing: '-0.01em' }}>
                                    {onlineDriversCount > 0 
                                      ? `Radar Ativo • Notificando ${onlineDriversCount} Motorista${onlineDriversCount > 1 ? 's' : ''} Online`
                                      : 'Aguardando Motoristas Ficarem Online...'}
                                  </strong>
                                </div>

                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#a5b4fc',
                                  background: 'rgba(99, 102, 241, 0.25)',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontWeight: 700
                                }}>
                                  ⏱️ Tempo restante: {formattedSearchCountdown}
                                </span>
                              </div>

                              <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: '#c7d2fe', lineHeight: 1.4 }}>
                                A solicitação permanece ativa enquanto houver motoristas disponíveis. Se não houver resposta dentro de 10 minutos, a busca será cancelada automaticamente.
                              </p>

                              {Boolean(activeClientRide.favoriteDriverIds && activeClientRide.favoriteDriverIds.length > 0) && (
                                <div style={{
                                  marginTop: '8px',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  fontSize: '0.78rem',
                                  color: '#fef08a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  <Heart size={14} fill="#ef4444" color="#ef4444" />
                                  <span>
                                    {Math.floor((now - (activeClientRide.createdAt || now)) / 1000) < 45 ? (
                                      <>⭐ <strong>Priorizando seus Motoristas Favoritos</strong> ({Math.max(0, 45 - Math.floor((now - (activeClientRide.createdAt || now)) / 1000))}s)...</>
                                    ) : (
                                      <>⭐ Busca expandida para todos os parceiros credenciados na sua região.</>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '10px' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Status da Solicitação</span>
                          <h3 style={{ fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', lineHeight: 1.35, flexWrap: 'wrap' }}>
                            {activeClientRide.status === 'searching' && (
                              activeClientRide.isScheduled ? (
                                <>
                                  <span className="animate-pulse-soft" style={{ color: '#38bdf8', fontSize: '1.1rem' }}>📅</span>
                                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8' }}>
                                    Agendamento Aberto para Motoristas
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="animate-pulse-soft" style={{ color: '#818cf8', fontSize: '1.1rem' }}>📡</span>
                                  <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Procurando motorista...</span>
                                </>
                              )
                            )}
                            {activeClientRide.status === 'accepted' && (
                              <>
                                <CheckCircle2 color="#f59e0b" size={18} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Motorista ({activeClientRide.driverName || 'Parceiro'}) Confirmado! Aguardando Saída</span>
                              </>
                            )}
                            {activeClientRide.status === 'to_pickup' && (
                              <>
                                <Car color="#f59e0b" size={18} className="animate-car" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Motorista a Caminho do Embarque!</span>
                              </>
                            )}
                            {activeClientRide.status === 'arrived_at_pickup' && (
                              <>
                                <MapPin color="#10b981" size={18} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Motorista no Ponto de Embarque!</span>
                              </>
                            )}
                            {activeClientRide.status === 'in_progress' && (
                              <>
                                <Car color="#3b82f6" size={18} className="animate-car" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Corrida em Andamento ({activeClientRide.hours}h)</span>
                              </>
                            )}
                            {activeClientRide.status === 'finished' && (
                              <>
                                <CheckCircle2 color="#10b981" size={18} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Corrida Concluída!</span>
                              </>
                            )}
                          </h3>
                        </div>

                        <span style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-secondary)',
                          flexShrink: 0
                        }}>
                          ID: #{activeClientRide.id.slice(-6)}
                        </span>
                      </div>

                      {/* Informações da Viagem */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1', marginTop: '5px', flexShrink: 0 }}></div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Partida</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{activeClientRide.origin}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981', marginTop: '5px', flexShrink: 0 }}></div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Destino</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{activeClientRide.destination}</div>
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

                      {/* Ações Exclusivas do Passageiro */}
                      {activeClientRide.status === 'searching' && (
                        <div style={{ marginTop: '20px' }}>
                          <button
                            type="button"
                            onClick={() => handleCancelRideByClient(activeClientRide.id)}
                            className="btn-outline"
                            style={{
                              width: '100%',
                              padding: '12px',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontWeight: 700
                            }}
                          >
                            <Ban size={16} />
                            <span>Cancelar Solicitação (Sem custo)</span>
                          </button>
                        </div>
                      )}

                      {/* Fase 1: Aceita / Confirmada (Motorista preparando saída) */}
                      {activeClientRide.status === 'accepted' && (
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            borderRadius: '14px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                          }}>
                            <div style={{ fontSize: '28px' }}>⏳</div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                                Motorista Confirmado • Preparando Saída
                              </h4>
                              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#c7d2fe', lineHeight: 1.4 }}>
                                O motorista aceitou sua corrida e está se preparando para iniciar o trajeto até você. Assim que ele iniciar o deslocamento, você poderá acompanhar o trajeto ao vivo no mapa!
                              </p>
                            </div>
                          </div>

                          <div style={{
                            background: canCancelAccepted ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${canCancelAccepted ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            borderRadius: '12px',
                            padding: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: canCancelAccepted ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                                {canCancelAccepted ? '⏱️ PRAZO DE CANCELAMENTO GRATUITO' : '⚠️ CANCELAMENTO COM TAXA (R$ 15,00)'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {canCancelAccepted 
                                  ? 'Você tem até 5 minutos após o aceite para cancelar a chamada gratuitamente.' 
                                  : 'Cancelamentos após 5 minutos têm taxa de R$ 15,00 repassada 100% ao motorista.'}
                              </div>
                            </div>
                            {canCancelAccepted && (
                              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>
                                {formattedCountdown}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCancelRideByClient(activeClientRide.id)}
                            className="btn-outline"
                            style={{
                              width: '100%',
                              padding: '12px',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              background: canCancelAccepted ? 'transparent' : 'rgba(239, 68, 68, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontWeight: 700
                            }}
                          >
                            <Ban size={16} />
                            <span>
                              {canCancelAccepted 
                                ? `Cancelar Corrida (Gratuito • ${formattedCountdown} restantes)` 
                                : 'Cancelar Corrida (Taxa de R$ 15,00 para o Motorista)'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Fase 2: Motorista a Caminho do Passageiro (Trajeto ao vivo até o embarque) */}
                      {activeClientRide.status === 'to_pickup' && (
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <LiveRideTrackerMap ride={activeClientRide} />

                          <div style={{
                            background: canCancelAccepted ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${canCancelAccepted ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            borderRadius: '12px',
                            padding: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: canCancelAccepted ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                                {canCancelAccepted ? '⏱️ PRAZO DE CANCELAMENTO GRATUITO' : '⚠️ MOTORISTA EM DESLOCAMENTO (TAXA R$ 15,00)'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {canCancelAccepted 
                                  ? 'Você tem até 5 minutos após o aceite para cancelar a chamada gratuitamente.' 
                                  : 'O prazo de 5 minutos expirou. O cancelamento terá taxa de R$ 15,00 repassada 100% ao motorista.'}
                              </div>
                            </div>
                            {canCancelAccepted && (
                              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>
                                {formattedCountdown}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCancelRideByClient(activeClientRide.id)}
                            className="btn-outline"
                            style={{
                              width: '100%',
                              padding: '12px',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              background: canCancelAccepted ? 'transparent' : 'rgba(239, 68, 68, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontWeight: 700
                            }}
                          >
                            <Ban size={16} />
                            <span>
                              {canCancelAccepted 
                                ? `Cancelar Corrida (Gratuito • ${formattedCountdown} restantes)` 
                                : 'Cancelar Corrida (Taxa de R$ 15,00 para o Motorista)'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Fase 2.5: Motorista no Local de Embarque */}
                      {activeClientRide.status === 'arrived_at_pickup' && (
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <LiveRideTrackerMap ride={activeClientRide} />

                          <div style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            borderRadius: '14px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                          }}>
                            <div style={{ fontSize: '28px' }}>📍</div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#6ee7b7' }}>
                                Motorista Chegou ao Ponto de Embarque!
                              </h4>
                              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                                O motorista parceiro chegou ao seu endereço e está aguardando você. Dirija-se ao veículo para iniciar a viagem.
                              </p>
                            </div>
                          </div>

                          <div style={{
                            background: canCancelAccepted ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${canCancelAccepted ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            borderRadius: '12px',
                            padding: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: canCancelAccepted ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                                {canCancelAccepted ? '⏱️ PRAZO DE CANCELAMENTO GRATUITO' : '⚠️ CANCELAMENTO COM TAXA (R$ 15,00)'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {canCancelAccepted 
                                  ? 'Você tem até 5 minutos após o aceite para cancelar a chamada gratuitamente.' 
                                  : 'Cancelamentos após 5 minutos têm taxa de R$ 15,00 repassada 100% ao motorista.'}
                              </div>
                            </div>
                            {canCancelAccepted && (
                              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>
                                {formattedCountdown}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCancelRideByClient(activeClientRide.id)}
                            className="btn-outline"
                            style={{
                              width: '100%',
                              padding: '12px',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              background: canCancelAccepted ? 'transparent' : 'rgba(239, 68, 68, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontWeight: 700
                            }}
                          >
                            <Ban size={16} />
                            <span>
                              {canCancelAccepted 
                                ? `Cancelar Corrida (Gratuito • ${formattedCountdown} restantes)` 
                                : 'Cancelar Corrida (Taxa de R$ 15,00 para o Motorista)'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Fase 3: Corrida Iniciada até o Destino (Contabilização do tempo e trajeto final) */}
                      {activeClientRide.status === 'in_progress' && (
                        <div style={{ marginTop: '20px' }}>
                          <LiveRideTrackerMap ride={activeClientRide} />
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            padding: '12px',
                            fontSize: '0.8rem',
                            color: '#10b981',
                            marginTop: '12px',
                            textAlign: 'center'
                          }}>
                            ✅ <strong>Corrida em andamento:</strong> O tempo contratado está sendo contabilizado. Acompanhe a rota até o destino no mapa.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : searchCancellationReason ? (
                    <div className="glass-panel" style={{
                      padding: '30px',
                      border: '1.5px solid #f59e0b',
                      background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)',
                      borderRadius: '18px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <AlertTriangle size={28} />
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                        {searchCancellationReason.reason === 'no_drivers_online'
                          ? 'Nenhum motorista online no momento'
                          : 'Tempo limite de busca esgotado (10 minutos)'}
                      </h3>

                      <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, maxWidth: '420px', margin: '0 auto 20px' }}>
                        {searchCancellationReason.reason === 'no_drivers_online'
                          ? 'A busca foi encerrada automaticamente pois não há motoristas parceiros conectados no radar agora. Sugerimos tentar novamente em alguns minutos ou selecionar um motorista favorito.'
                          : 'Procuramos por motoristas parceiros durante 10 minutos sem confirmação de aceite. Recomendamos realizar uma nova solicitação ajustando o valor ou horário.'}
                      </p>

                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchCancellationReason(null);
                            setCurrentRideId(null);
                          }}
                          className="btn-primary"
                          style={{ padding: '12px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <RotateCcw size={16} />
                          <span>Fazer Nova Solicitação</span>
                        </button>
                      </div>
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
                      <li>Preço fixo combinado previamente, sem taxas extras de trajeto.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            )}

            {clientSubTab === 'history' && (
              /* SUB-ABA: HISTÓRICO DE CORRIDAS DO CLIENTE COM ABAS (PRINCIPAL E ARQUIVADAS) E FILTROS */
              (() => {
                const now = Date.now();
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);

                // Corridas visíveis para o passageiro (exclui apenas da visão do cliente; admin continua visualizando tudo)
                const myRides = rides.filter(r => r.clientId === currentUser.id && !deletedRideIdsForClient.includes(r.id));

                // Separar corridas ativas no histórico das arquivadas
                const activeHistoryRides = myRides.filter(r => !archivedRideIds.includes(r.id));
                const archivedHistoryRides = myRides.filter(r => archivedRideIds.includes(r.id));

                // Filtrar corridas principais por período
                const filteredClientRides = activeHistoryRides.filter(r => {
                  const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at).getTime() : now;
                  if (clientDateFilter === 'today') {
                    return rideTime >= startOfToday.getTime();
                  }
                  if (clientDateFilter === 'week') {
                    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                    return rideTime >= sevenDaysAgo;
                  }
                  if (clientDateFilter === '15days') {
                    const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;
                    return rideTime >= fifteenDaysAgo;
                  }
                  if (clientDateFilter === '30days') {
                    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
                    return rideTime >= thirtyDaysAgo;
                  }
                  if (clientDateFilter === 'custom') {
                    if (!clientCustomDate) return true;
                    const targetDateStr = new Date(rideTime).toISOString().slice(0, 10);
                    return targetDateStr === clientCustomDate;
                  }
                  return true;
                });

                const totalSpent = filteredClientRides.reduce((acc, curr) => acc + (curr.total || 0), 0);

                return (
                  <div className="glass-panel" style={{ padding: '16px 18px' }}>
                    {/* Cabeçalho do Histórico com Totalizador Compacto */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Clock size={18} color="#818cf8" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Histórico de Corridas
                          </h3>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                            Gerencie seus registros e consulte seus gastos
                          </p>
                        </div>
                      </div>

                      {historyViewTab === 'active' && (
                        <div
                          onClick={toggleHideBalance}
                          title={hideBalance ? "Clique para exibir valor" : "Clique para ocultar valor"}
                          style={{
                            background: theme === 'light' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.12)',
                            border: theme === 'light' ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(99, 102, 241, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            textAlign: 'right',
                            flexShrink: 0,
                            cursor: 'pointer',
                            userSelect: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end'
                          }}
                        >
                          <div style={{
                            fontSize: '0.65rem',
                            color: theme === 'light' ? '#4f46e5' : '#a5b4fc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}>
                            <span>Total no Período</span>
                            {hideBalance ? <EyeOff size={11} /> : <Eye size={11} />}
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: theme === 'light' ? '#4338ca' : '#818cf8' }}>
                            {hideBalance ? '••••••' : formatCurrency(totalSpent)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alternador de Abas: Histórico Principal vs Corridas Arquivadas */}
                    <div className="history-subnav-box">
                      <button
                        type="button"
                        onClick={() => setHistoryViewTab('active')}
                        className={`history-subnav-btn ${historyViewTab === 'active' ? 'active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          background: historyViewTab === 'active' ? 'var(--primary-gradient)' : 'transparent',
                          color: historyViewTab === 'active' ? '#fff' : undefined,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Clock size={14} />
                        <span>Principal ({activeHistoryRides.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryViewTab('archived')}
                        className={`history-subnav-btn ${historyViewTab === 'archived' ? 'archived-active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          background: historyViewTab === 'archived' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                          color: historyViewTab === 'archived' ? '#000' : '#d97706',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Archive size={14} />
                        <span>Arquivadas ({archivedHistoryRides.length})</span>
                      </button>
                    </div>

                    {/* VISÃO 1: HISTÓRICO PRINCIPAL (COM FILTROS DE DATA) */}
                    {historyViewTab === 'active' && (
                      <>
                        {/* Barra de Filtros de Período Fixos e Personalizado (Padrão: 7 dias) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                          padding: '8px 12px',
                          background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '10px',
                          border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid var(--border-subtle)',
                          marginBottom: '16px'
                        }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px', whiteSpace: 'nowrap' }}>
                            <Filter size={13} color="#2563eb" />
                            Filtrar:
                          </span>

                          <button
                            type="button"
                            onClick={() => setClientDateFilter('all')}
                            className={`filter-pill-btn ${clientDateFilter === 'all' ? 'active' : ''}`}
                          >
                            Todas
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientDateFilter('today')}
                            className={`filter-pill-btn ${clientDateFilter === 'today' ? 'active' : ''}`}
                          >
                            Hoje
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientDateFilter('week')}
                            className={`filter-pill-btn ${clientDateFilter === 'week' ? 'active' : ''}`}
                          >
                            7 dias
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientDateFilter('15days')}
                            className={`filter-pill-btn ${clientDateFilter === '15days' ? 'active' : ''}`}
                          >
                            15 dias
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientDateFilter('30days')}
                            className={`filter-pill-btn ${clientDateFilter === '30days' ? 'active' : ''}`}
                          >
                            30 dias
                          </button>

                          <button
                            type="button"
                            onClick={() => setClientDateFilter('custom')}
                            className={`filter-pill-btn ${clientDateFilter === 'custom' ? 'active' : ''}`}
                          >
                            Personalizado
                          </button>

                          {clientDateFilter === 'custom' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                              <input
                                type="date"
                                value={clientCustomDate}
                                onChange={(e) => setClientCustomDate(e.target.value)}
                                className="input-field"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  color: '#fff',
                                  border: '1px solid #6366f1',
                                  borderRadius: '8px'
                                }}
                              />
                              {clientCustomDate && (
                                <button
                                  type="button"
                                  onClick={() => setClientCustomDate('')}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                                  title="Limpar data"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {filteredClientRides.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                            <Car size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                            <p style={{ fontWeight: 600 }}>Nenhuma corrida encontrada neste período.</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Alterne os filtros acima para visualizar outras datas.</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredClientRides.map(r => {
                              const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at) : null;
                              const isExpanded = !!expandedClientRideIds[r.id];
                              const assignedDriver = allDriversList.find(d => d.userId === r.driverId || d.id === r.driverId);
                              const targetDriverId = r.driverId || assignedDriver?.id || assignedDriver?.userId;
                              const isDriverFav = Boolean(targetDriverId && favoriteDriverIds.includes(targetDriverId));
                              const amenities = safeAmenitiesArray(r.requiredAmenities);

                              return (
                                <div
                                  key={r.id}
                                  className="ride-history-card"
                                  style={{
                                    border: isExpanded ? '1px solid rgba(99, 102, 241, 0.5)' : undefined,
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease-in-out'
                                  }}
                                >
                                  {/* Cabeçalho do Card (Sempre Visível, Clicável para Expandir/Recolher) */}
                                  <div
                                    onClick={() => toggleClientRideExpand(r.id)}
                                    style={{
                                      padding: '14px 16px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      gap: '12px'
                                    }}
                                    title={isExpanded ? 'Clique para recolher detalhes' : 'Clique para ver detalhes completos'}
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span
                                          className="ride-title-text"
                                          style={{
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '220px'
                                          }}
                                        >
                                          {r.origin?.split(',')[0] || r.origin} ➔ {r.destination?.split(',')[0] || r.destination}
                                        </span>
                                        <span style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          padding: '2px 8px',
                                          borderRadius: '10px',
                                          background: r.status === 'finished' ? 'rgba(16, 185, 129, 0.15)' : r.status === 'in_progress' ? 'rgba(59, 130, 246, 0.15)' : (r.status === 'accepted' || r.status === 'to_pickup') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                          color: r.status === 'finished' ? '#10b981' : r.status === 'in_progress' ? '#3b82f6' : (r.status === 'accepted' || r.status === 'to_pickup') ? '#f59e0b' : '#ef4444'
                                        }}>
                                          {r.status === 'finished' ? 'CONCLUÍDA' : r.status === 'in_progress' ? 'EM ANDAMENTO' : r.status === 'to_pickup' ? 'A CAMINHO' : r.status === 'accepted' ? 'CONFIRMADA' : r.status === 'searching' ? 'BUSCANDO' : 'CANCELADA'}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span>Motorista: <strong>{r.driverName || assignedDriver?.driverName || assignedDriver?.fullName || 'Aguardando'}</strong></span>
                                        {targetDriverId && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleFavorite(targetDriverId);
                                              showToast(isDriverFav ? 'Motorista removido dos favoritos' : '⭐ Motorista adicionado aos seus favoritos!', isDriverFav ? 'info' : 'success');
                                            }}
                                            style={{
                                              background: isDriverFav ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                              border: isDriverFav ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                                              borderRadius: '12px',
                                              padding: '2px 8px',
                                              fontSize: '0.72rem',
                                              fontWeight: 700,
                                              color: isDriverFav ? '#fca5a5' : '#cbd5e1',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              cursor: 'pointer',
                                              transition: 'all 0.15s ease'
                                            }}
                                            title={isDriverFav ? 'Clique para desfavoritar este motorista' : 'Clique para favoritar este motorista'}
                                          >
                                            <Heart size={12} fill={isDriverFav ? '#ef4444' : 'none'} color={isDriverFav ? '#ef4444' : '#cbd5e1'} />
                                            <span>{isDriverFav ? 'Favorito' : 'Favoritar'}</span>
                                          </button>
                                        )}
                                        {rideTime && (
                                          <>
                                            <span>•</span>
                                            <span>{rideTime.toLocaleDateString('pt-BR')} às {rideTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                      <div style={{ textAlign: 'right' }}>
                                        <div className="ride-price-text" style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                          {formatCurrency(r.total)}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                          {r.hours}h ({formatCurrency(r.hourlyRate)}/h)
                                        </div>
                                      </div>

                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: isExpanded ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isExpanded ? '#818cf8' : 'var(--text-secondary)',
                                        transition: 'transform 0.2s'
                                      }}>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Corpo Expandido com Detalhamento Completo */}
                                  {isExpanded && (
                                    <div className="ride-card-expanded">
                                      {/* Grid de Detalhes da Corrida */}
                                      <div className="ride-card-details-box" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                        gap: '8px',
                                        padding: '12px'
                                      }}>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total Pago:</span>
                                          <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>{formatCurrency(r.total)}</strong>
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Horas Contratadas:</span>
                                          <strong className="ride-title-text" style={{ fontSize: '0.9rem' }}>{r.hours}h de serviço</strong>
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Valor Hora:</span>
                                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatCurrency(r.hourlyRate)}/h</span>
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Forma de Pagamento:</span>
                                          <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>
                                            {r.paymentMethod === 'credit_card' ? '💳 Cartão de Crédito' : r.paymentMethod === 'cash' ? '💵 Dinheiro ao Motorista' : r.paymentMethod === 'pix' ? '🔑 Pix Direto' : '💳 Plataforma'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Endereços Completos */}
                                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                          <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>🟢 Embarque:</span>
                                          <span style={{ color: 'var(--text-secondary)' }}>{r.origin}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                          <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>🔴 Destino:</span>
                                          <span style={{ color: 'var(--text-secondary)' }}>{r.destination}</span>
                                        </div>
                                      </div>

                                      {/* Informações do Motorista e Veículo (se atribuído) */}
                                      {(assignedDriver || r.driverName) && (
                                        <div style={{
                                          background: 'rgba(255, 255, 255, 0.03)',
                                          border: '1px solid var(--border-subtle)',
                                          borderRadius: '10px',
                                          padding: '10px 12px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          flexWrap: 'wrap',
                                          gap: '8px'
                                        }}>
                                          <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                              Motorista: {r.driverName || assignedDriver?.driverName || assignedDriver?.fullName}
                                            </div>
                                            {assignedDriver?.vehicleBrand && (
                                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                🚗 {assignedDriver.vehicleBrand} {assignedDriver.vehicleModel} • Placa {assignedDriver.vehiclePlate} {assignedDriver.vehicleColor ? `• ${assignedDriver.vehicleColor}` : ''}
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {targetDriverId && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleFavorite(targetDriverId);
                                                  showToast(isDriverFav ? 'Motorista removido dos favoritos' : '⭐ Motorista adicionado aos seus favoritos!', isDriverFav ? 'info' : 'success');
                                                }}
                                                className="btn-outline"
                                                style={{
                                                  fontSize: '0.75rem',
                                                  padding: '5px 10px',
                                                  borderRadius: '8px',
                                                  background: isDriverFav ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                  borderColor: isDriverFav ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                                                  color: isDriverFav ? '#fca5a5' : '#cbd5e1',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '5px'
                                                }}
                                              >
                                                <Heart size={14} fill={isDriverFav ? '#ef4444' : 'none'} color={isDriverFav ? '#ef4444' : 'currentColor'} />
                                                <span>{isDriverFav ? 'Favorito' : 'Favoritar Motorista'}</span>
                                              </button>
                                            )}
                                            {assignedDriver?.phone && (
                                              <div style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>
                                              📞 {assignedDriver.phone}
                                            </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Comodidades Requisitadas */}
                                      {amenities.length > 0 && (
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Comodidades Solicitadas:</span>
                                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {amenities.map(am => (
                                              <span
                                                key={am}
                                                style={{
                                                  fontSize: '0.7rem',
                                                  padding: '2px 8px',
                                                  borderRadius: '6px',
                                                  background: am === 'acessibilidade_pcd' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                                  color: am === 'acessibilidade_pcd' ? '#93c5fd' : '#cbd5e1',
                                                  border: am === 'acessibilidade_pcd' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                                                  fontWeight: 600
                                                }}
                                              >
                                                {am === 'acessibilidade_pcd' ? '♿ Adaptado PCD' :
                                                 am === 'ar_condicionado' ? '❄️ Ar-condicionado' :
                                                 am === 'porta_malas_grande' ? '🧳 Porta-malas G' :
                                                 am === 'pet_friendly' ? '🐾 Pet Friendly' :
                                                 am === 'cadeirinha_bebe' ? '👶 Cadeirinha' : am}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Rodapé do Card Expandido com ID e Botões de Ação */}
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingTop: '8px',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                        flexWrap: 'wrap',
                                        gap: '8px'
                                      }}>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                          ID: #{r.id.slice(-8).toUpperCase()}
                                        </span>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedRideForReport(r);
                                              setIsReportModalOpen(true);
                                            }}
                                            className="btn-outline"
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '5px 12px',
                                              borderRadius: '8px',
                                              borderColor: 'rgba(239, 68, 68, 0.4)',
                                              color: '#f87171'
                                            }}
                                          >
                                            ⚠️ Reportar Problema
                                          </button>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleArchiveRide(r.id);
                                            }}
                                            className="btn-outline"
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '5px 12px',
                                              borderRadius: '8px',
                                              color: '#cbd5e1'
                                            }}
                                            title="Arquivar corrida para limpar a visualização principal"
                                          >
                                            📁 Arquivar
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {/* VISÃO 2: CORRIDAS ARQUIVADAS (COM OPÇÃO DE RESTAURAR OU EXCLUIR DEFINITIVAMENTE) */}
                    {historyViewTab === 'archived' && (
                      <div>
                        {archivedHistoryRides.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                            <Archive size={42} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                            <p style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>Nenhuma corrida arquivada</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '6px', maxWidth: '380px', margin: '6px auto 0', lineHeight: 1.4 }}>
                              Quando você arquiva viagens no Histórico Principal, elas vêm para cá. Você pode restaurá-las ou excluí-las permanentemente a qualquer momento.
                            </p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💡 Viagens arquivadas não aparecem na visualização principal. Você pode restaurar ou excluir permanentemente abaixo:</span>
                            </div>

                            {archivedHistoryRides.map(r => {
                              const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at) : null;
                              const isExpanded = !!expandedClientRideIds[r.id];
                              const assignedDriver = allDriversList.find(d => d.userId === r.driverId || d.id === r.driverId);
                              const targetDriverId = r.driverId || assignedDriver?.id || assignedDriver?.userId;
                              const isDriverFav = Boolean(targetDriverId && favoriteDriverIds.includes(targetDriverId));
                              const amenities = safeAmenitiesArray(r.requiredAmenities);

                              return (
                                <div
                                  key={r.id}
                                  className="ride-history-card"
                                  style={{
                                    border: isExpanded ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease-in-out'
                                  }}
                                >
                                  {/* Cabeçalho do Card (Sempre Visível, Clicável para Expandir/Recolher) */}
                                  <div
                                    onClick={() => toggleClientRideExpand(r.id)}
                                    style={{
                                      padding: '14px 16px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      gap: '12px'
                                    }}
                                    title={isExpanded ? 'Clique para recolher detalhes' : 'Clique para ver detalhes completos'}
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span
                                          className="ride-title-text"
                                          style={{
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '220px'
                                          }}
                                        >
                                          {r.origin?.split(',')[0] || r.origin} ➔ {r.destination?.split(',')[0] || r.destination}
                                        </span>
                                        <span style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 800,
                                          padding: '2px 8px',
                                          borderRadius: '8px',
                                          background: 'rgba(245, 158, 11, 0.2)',
                                          color: '#f59e0b',
                                          border: '1px solid rgba(245, 158, 11, 0.35)',
                                          letterSpacing: '0.04em'
                                        }}>
                                          ARQUIVADA
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span>Motorista: <strong>{r.driverName || assignedDriver?.driverName || assignedDriver?.fullName || 'Sem motorista'}</strong></span>
                                        {targetDriverId && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleFavorite(targetDriverId);
                                              showToast(isDriverFav ? 'Motorista removido dos favoritos' : '⭐ Motorista adicionado aos seus favoritos!', isDriverFav ? 'info' : 'success');
                                            }}
                                            style={{
                                              background: isDriverFav ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                              border: isDriverFav ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                                              borderRadius: '12px',
                                              padding: '2px 8px',
                                              fontSize: '0.72rem',
                                              fontWeight: 700,
                                              color: isDriverFav ? '#fca5a5' : '#cbd5e1',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              cursor: 'pointer',
                                              transition: 'all 0.15s ease'
                                            }}
                                            title={isDriverFav ? 'Clique para desfavoritar este motorista' : 'Clique para favoritar este motorista'}
                                          >
                                            <Heart size={12} fill={isDriverFav ? '#ef4444' : 'none'} color={isDriverFav ? '#ef4444' : '#cbd5e1'} />
                                            <span>{isDriverFav ? 'Favorito' : 'Favoritar'}</span>
                                          </button>
                                        )}
                                        {rideTime && (
                                          <>
                                            <span>•</span>
                                            <span>{rideTime.toLocaleDateString('pt-BR')} às {rideTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                      <div style={{ textAlign: 'right' }}>
                                        <div className="ride-price-text" style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                          {formatCurrency(r.total)}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                          {r.hours}h ({formatCurrency(r.hourlyRate)}/h)
                                        </div>
                                      </div>

                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: isExpanded ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isExpanded ? '#f59e0b' : 'var(--text-secondary)',
                                        transition: 'transform 0.2s'
                                      }}>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Corpo Expandido com Detalhamento Completo */}
                                  {isExpanded && (
                                    <div className="ride-card-expanded">
                                      {/* Grid de Detalhes da Corrida */}
                                      <div className="ride-card-details-box" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                        gap: '8px',
                                        padding: '12px'
                                      }}>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total Pago:</span>
                                          <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>{formatCurrency(r.total)}</strong>
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Horas Contratadas:</span>
                                          <strong className="ride-title-text" style={{ fontSize: '0.9rem' }}>{r.hours}h de serviço</strong>
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Valor Hora:</span>
                                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatCurrency(r.hourlyRate)}/h</span>
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Forma de Pagamento:</span>
                                          <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>
                                            {r.paymentMethod === 'credit_card' ? '💳 Cartão de Crédito' : r.paymentMethod === 'cash' ? '💵 Dinheiro ao Motorista' : r.paymentMethod === 'pix' ? '🔑 Pix Direto' : '💳 Plataforma'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Endereços Completos */}
                                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                          <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>🟢 Embarque:</span>
                                          <span style={{ color: 'var(--text-secondary)' }}>{r.origin}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                          <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>🔴 Destino:</span>
                                          <span style={{ color: 'var(--text-secondary)' }}>{r.destination}</span>
                                        </div>
                                      </div>

                                      {/* Informações do Motorista e Veículo (se atribuído) */}
                                      {(assignedDriver || r.driverName) && (
                                        <div style={{
                                          background: 'rgba(255, 255, 255, 0.03)',
                                          border: '1px solid var(--border-subtle)',
                                          borderRadius: '10px',
                                          padding: '10px 12px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          flexWrap: 'wrap',
                                          gap: '8px'
                                        }}>
                                          <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                              Motorista: {r.driverName || assignedDriver?.driverName || assignedDriver?.fullName}
                                            </div>
                                            {assignedDriver?.vehicleBrand && (
                                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                🚗 {assignedDriver.vehicleBrand} {assignedDriver.vehicleModel} • Placa {assignedDriver.vehiclePlate} {assignedDriver.vehicleColor ? `• ${assignedDriver.vehicleColor}` : ''}
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {targetDriverId && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleFavorite(targetDriverId);
                                                  showToast(isDriverFav ? 'Motorista removido dos favoritos' : '⭐ Motorista adicionado aos seus favoritos!', isDriverFav ? 'info' : 'success');
                                                }}
                                                className="btn-outline"
                                                style={{
                                                  fontSize: '0.75rem',
                                                  padding: '5px 10px',
                                                  borderRadius: '8px',
                                                  background: isDriverFav ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                  borderColor: isDriverFav ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                                                  color: isDriverFav ? '#fca5a5' : '#cbd5e1',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '5px'
                                                }}
                                              >
                                                <Heart size={14} fill={isDriverFav ? '#ef4444' : 'none'} color={isDriverFav ? '#ef4444' : 'currentColor'} />
                                                <span>{isDriverFav ? 'Favorito' : 'Favoritar Motorista'}</span>
                                              </button>
                                            )}
                                            {assignedDriver?.phone && (
                                              <div style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>
                                              📞 {assignedDriver.phone}
                                            </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Comodidades Requisitadas */}
                                      {amenities.length > 0 && (
                                        <div>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Comodidades Solicitadas:</span>
                                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {amenities.map(am => (
                                              <span
                                                key={am}
                                                style={{
                                                  fontSize: '0.7rem',
                                                  padding: '2px 8px',
                                                  borderRadius: '6px',
                                                  background: am === 'acessibilidade_pcd' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                                  color: am === 'acessibilidade_pcd' ? '#93c5fd' : '#cbd5e1',
                                                  border: am === 'acessibilidade_pcd' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                                                  fontWeight: 600
                                                }}
                                              >
                                                {am === 'acessibilidade_pcd' ? '♿ Adaptado PCD' :
                                                 am === 'ar_condicionado' ? '❄️ Ar-condicionado' :
                                                 am === 'porta_malas_grande' ? '🧳 Porta-malas G' :
                                                 am === 'pet_friendly' ? '🐾 Pet Friendly' :
                                                 am === 'cadeirinha_bebe' ? '👶 Cadeirinha' : am}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Rodapé do Card Expandido com ID e Botões de Ação */}
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingTop: '8px',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                        flexWrap: 'wrap',
                                        gap: '8px'
                                      }}>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                          ID: #{r.id.slice(-8).toUpperCase()}
                                        </span>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedRideForReport(r);
                                              setIsReportModalOpen(true);
                                            }}
                                            className="btn-outline"
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '5px 12px',
                                              borderRadius: '8px',
                                              borderColor: 'rgba(239, 68, 68, 0.4)',
                                              color: '#f87171'
                                            }}
                                          >
                                            ⚠️ Reportar Problema
                                          </button>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUnarchiveRide(r.id);
                                            }}
                                            className="btn-outline"
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '5px 12px',
                                              borderRadius: '8px',
                                              borderColor: 'rgba(16, 185, 129, 0.4)',
                                              color: '#10b981'
                                            }}
                                            title="Restaurar para o histórico principal"
                                          >
                                            <ArchiveRestore size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            <span>Restaurar</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteArchivedRide(r.id);
                                            }}
                                            className="btn-danger-outline"
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '5px 12px',
                                              borderRadius: '8px'
                                            }}
                                            title="Excluir permanentemente"
                                          >
                                            <Trash2 size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            <span>Excluir</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
            </div>
          )}
        </div>
      )}

        {/* TAB 2: MOTORISTA */}
        {activeTab === 'driver' && (
          <div>
            {isLoadingProfile && (!driverProfile || driverProfile.verificationStatus !== 'approved') ? (
              <div style={{
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  position: 'relative',
                  width: '84px',
                  height: '84px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '3px solid rgba(16, 185, 129, 0.15)',
                    borderTopColor: '#10b981',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <Car size={36} color="#10b981" style={{ animation: 'pulse 2s infinite' }} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Preparando Painel do Motorista...
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                  Verificando credenciais e status de homologação.
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '0.8rem',
                  color: '#34d399',
                  fontWeight: 600
                }}>
                  <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>Sincronizando dados com o servidor...</span>
                </div>
              </div>
            ) : !isUserAdmin && (!driverProfile || driverProfile.verificationStatus !== 'approved') ? (
              <DriverOnboarding
                user={currentUser}
                initialProfile={driverProfile}
                initialStep={driverOnboardingInitialStep}
                onComplete={(dp) => {
                  setDriverProfile(dp);
                  setIsLoadingProfile(false);
                  if (dp.fullName) {
                    setCurrentUser(prev => prev ? { ...prev, fullName: dp.fullName!, phone: dp.phone || prev.phone } : prev);
                    try {
                      const savedUser = localStorage.getItem('drivehora_current_user');
                      if (savedUser) {
                        const parsed = JSON.parse(savedUser);
                        parsed.fullName = dp.fullName;
                        if (dp.phone) parsed.phone = dp.phone;
                        localStorage.setItem('drivehora_current_user', JSON.stringify(parsed));
                      }
                    } catch (e) {}
                  }
                  showToast('Cadastro do motorista salvo e sincronizado com sucesso!', 'success');
                }}
                onOpenSupabaseConfig={isUserAdmin ? () => setShowConfigModal(true) : undefined}
              />
            ) : showDriverProfileEdit ? (
              <div>
                <div className="hide-on-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                  initialStep={driverOnboardingInitialStep}
                  onComplete={(dp) => {
                    setDriverProfile(dp);
                    setShowDriverProfileEdit(false);
                    if (dp.fullName) {
                      setCurrentUser(prev => prev ? { ...prev, fullName: dp.fullName!, phone: dp.phone || prev.phone } : prev);
                      try {
                        const savedUser = localStorage.getItem('drivehora_current_user');
                        if (savedUser) {
                          const parsed = JSON.parse(savedUser);
                          parsed.fullName = dp.fullName;
                          if (dp.phone) parsed.phone = dp.phone;
                          localStorage.setItem('drivehora_current_user', JSON.stringify(parsed));
                        }
                      } catch (e) {}
                    }
                    showToast('Cadastro do motorista atualizado em todo o sistema!', 'success');
                  }}
                  onOpenSupabaseConfig={isUserAdmin ? () => setShowConfigModal(true) : undefined}
                />
              </div>
            ) : (
              <div>
                {/* Banner de Aviso de Cancelamento pelo Passageiro */}
                {cancelledRideForDriver && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#ef4444', color: '#fff', padding: '10px', borderRadius: '12px' }}>
                        <AlertOctagon size={22} />
                      </div>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '1rem', display: 'block' }}>
                          Atenção: Corrida Cancelada pelo Passageiro
                        </strong>
                        <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                          O passageiro cancelou a solicitação #{cancelledRideForDriver.id.slice(-6)} ({cancelledRideForDriver.origin} ➔ {cancelledRideForDriver.destination}).
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismissCancellation(cancelledRideForDriver.id)}
                      className="btn-outline"
                      style={{ fontSize: '0.8rem', padding: '8px 14px', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                    >
                      Entendido / Fechar
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                  {driverSubTab === 'radar' ? (
                    /* Painel do Motorista (Exclusivo da Aba Radar) */
                    <div className="glass-panel" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                        {/* Indicador de Status Online/Offline visível no topo */}
                        <span style={{
                          fontSize: '0.7rem',
                          color: isDriverOnline ? '#10b981' : '#ef4444',
                          background: isDriverOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${isDriverOnline ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isDriverOnline ? '#10b981' : '#ef4444',
                            display: 'inline-block'
                          }} />
                          {isDriverOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {driverProfile?.vehicleBrand ? `${driverProfile.vehicleBrand} ${driverProfile.vehicleModel} • ${driverProfile.vehiclePlate}` : 'Complete seu veículo para atender chamados'}
                      </p>
                    </div>

                    <div className="driver-subnav-desktop" style={{ alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div className="driver-subnav-box">
                        <button
                          type="button"
                          onClick={() => setDriverSubTab('radar')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: 'var(--primary-gradient)',
                            color: '#fff'
                          }}
                        >
                          Radar & Chamados
                        </button>
                        <button
                          type="button"
                          onClick={() => setDriverSubTab('history')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: 'transparent',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          Meu Histórico
                        </button>
                      </div>

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
                        onClick={() => {
                          setDriverOnboardingInitialStep(1);
                          setShowDriverProfileEdit(true);
                        }}
                        className="btn-outline"
                        style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                        title="Editar / Cadastrar dados do veículo e CNH"
                      >
                        <UserCheck size={14} />
                        <span>Meus Documentos</span>
                      </button>

                      <button
                        onClick={handleToggleDriverOnline}
                        disabled={isTogglingOnline}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          borderRadius: '24px',
                          border: 'none',
                          cursor: isTogglingOnline ? 'not-allowed' : 'pointer',
                          opacity: isTogglingOnline ? 0.7 : 1,
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          background: isDriverOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: isDriverOnline ? '#10b981' : '#ef4444',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: isDriverOnline ? '#10b981' : '#ef4444'
                        }}
                      >
                        {isTogglingOnline ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>GRAVANDO...</span>
                          </>
                        ) : (
                          <>
                            <Radio size={16} className={isDriverOnline ? 'animate-pulse' : ''} />
                            <span>{isDriverOnline ? 'ONLINE' : 'OFFLINE'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Alerta de Gateway Inoperante para o Motorista */}
                  {!gatewayOperational && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      padding: '14px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ fontSize: '0.8rem', color: '#fca5a5', lineHeight: 1.4 }}>
                        <strong>Recepção de Corridas Suspensa:</strong> O recebimento de novas solicitações está temporariamente em manutenção preventiva. O sistema será normalizado em instantes.
                        {isUserAdmin && gatewayHealthMsg && (
                          <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#fecaca', opacity: 0.85 }}>
                            [Aviso Admin: {gatewayHealthMsg}]
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

                  {/* Cards de Métricas - Focado no dia de hoje */}
                  {(() => {
                    const isDateToday = (ts?: number | string | null) => {
                      if (!ts) return false;
                      const d = new Date(ts);
                      if (isNaN(d.getTime())) return false;
                      const nowDate = new Date();
                      return d.getDate() === nowDate.getDate() && d.getMonth() === nowDate.getMonth() && d.getFullYear() === nowDate.getFullYear();
                    };

                    const isRideCompleted = (r: any) => r.status === 'finished' || r.status === 'completed';

                    const myDriverCompletedRides = rides.filter(r => 
                      isRideCompleted(r) && 
                      (r.driverId === currentUser?.id || (!r.driverId && isUserAdmin))
                    );
                    const myDriverCompletedToday = myDriverCompletedRides.filter(r => 
                      isDateToday(r.finishedAt || (r as any).finished_at || r.startedAt || r.createdAt || (r as any).created_at)
                    );
                    const myDriverTodayEarnings = myDriverCompletedToday.reduce((acc, cur) => acc + (cur.driverNet || 0), 0);

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div className="driver-metric-card">
                          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                            <DollarSign size={16} color="#10b981" />
                            <span>Ganhos Líquidos</span>
                          </div>
                          <div className="metric-value earnings" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px' }}>
                            {formatCurrency(myDriverTodayEarnings)}
                          </div>
                          <div className="metric-desc" style={{ fontSize: '0.7rem' }}>
                            Hoje
                          </div>
                        </div>

                        <div className="driver-metric-card">
                          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                            <Award size={16} color="#f59e0b" />
                            <span>Corridas Feitas</span>
                          </div>
                          <div className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '6px' }}>
                            {myDriverCompletedToday.length}
                          </div>
                          <div className="metric-desc" style={{ fontSize: '0.7rem' }}>
                            {myDriverCompletedToday.length === 1 ? '1 completada hoje' : `${myDriverCompletedToday.length} completadas hoje`}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <>
                      {/* Status do Radar */}
                      <div style={{
                        padding: '14px',
                        borderRadius: '12px',
                        background: isDriverOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '20px'
                      }}>
                        <Compass size={20} color={isDriverOnline ? '#10b981' : 'var(--text-muted)'} />
                        <div style={{ flex: 1, fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 700, color: isDriverOnline ? '#10b981' : 'var(--text-muted)' }}>
                            {isDriverOnline ? 'Radar de Passageiros Ativo' : 'Radar Desconectado'}
                          </span>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {isDriverOnline
                              ? 'Sua localização está sendo transmitida e você receberá solicitações em tempo real.'
                              : 'Clique no botão acima para ficar ONLINE e começar a receber chamadas de passageiros.'}
                          </p>
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
                            <Radio size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} className={isDriverOnline ? 'animate-pulse' : ''} />
                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Nenhuma chamada pendente no momento</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {isDriverOnline ? 'Mantenha a tela aberta para receber chamadas de passageiros instantaneamente.' : 'Fique online para receber notificações de novos passageiros.'}
                            </p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingRides.map(r => (
                              <div
                                key={r.id}
                                className="driver-pending-ride-card"
                                style={{
                                  border: r.isScheduled 
                                    ? '1.5px solid rgba(14, 165, 233, 0.45)' 
                                    : undefined,
                                  borderRadius: '14px',
                                  padding: '16px',
                                  position: 'relative'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      background: r.isScheduled ? 'rgba(14, 165, 233, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                      color: r.isScheduled ? '#38bdf8' : '#10b981',
                                      border: r.isScheduled ? '1px solid rgba(14, 165, 233, 0.4)' : 'none',
                                      padding: '3px 8px',
                                      borderRadius: '8px',
                                      fontWeight: 700
                                    }}>
                                      {r.isScheduled ? '📅 CORRIDA AGENDADA' : '⚡ VIAGEM AGORA'}
                                    </span>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#10b981',
                                      padding: '3px 8px',
                                      borderRadius: '8px',
                                      fontWeight: 700
                                    }}>
                                      ⏱️ {r.hours}h de serviço
                                    </span>
                                  </div>

                                  <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                                    Ganho Líquido: {formatCurrency(r.driverNet)}
                                  </strong>
                                </div>

                                {r.isScheduled && r.scheduledFor && (
                                  <div style={{
                                    fontSize: '0.82rem',
                                    color: '#38bdf8',
                                    marginBottom: '8px',
                                    background: 'rgba(14, 165, 233, 0.15)',
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}>
                                    🗓️ Data/Hora Agendada: {formatScheduledDate(r.scheduledFor)}
                                  </div>
                                )}

                                {safeAmenitiesArray(r.requiredAmenities).length > 0 && (
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {safeAmenitiesArray(r.requiredAmenities).map(am => (
                                      <span key={am} className="amenity-badge-tag" style={{
                                        fontSize: '0.72rem',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: am === 'acessibilidade_pcd' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                        color: am === 'acessibilidade_pcd' ? '#93c5fd' : '#cbd5e1',
                                        border: am === 'acessibilidade_pcd' ? '1px solid #3b82f6' : 'none',
                                        fontWeight: 600
                                      }}>
                                        {am === 'acessibilidade_pcd' ? '♿ Adaptado PCD' :
                                         am === 'ar_condicionado' ? '❄️ Ar-Condicionado' :
                                         am === 'porta_malas' ? '🧳 Porta-Malas Grande' :
                                         am === 'pet_friendly' ? '🐾 Pet Friendly' :
                                         am === 'cadeirinha' ? '👶 Cadeirinha Bebê' :
                                         am === 'wifi' ? '📶 Wi-Fi 5G' : am}
                                      </span>
                                    ))}
                                  </div>
                                )}

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
                                    style={{
                                      padding: '8px 16px',
                                      fontSize: '0.85rem',
                                      background: r.isScheduled ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : undefined
                                    }}
                                  >
                                    {r.isScheduled ? '🗓️ Aceitar na Minha Agenda' : 'Aceitar Corrida'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Corridas Aceitas / Em Andamento pelo Motorista */}
                        {myDriverRides.length > 0 && (
                          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                        {/* Corridas Aceitas / Em Andamento pelo Motorista (Fila de Atendimento) */}
                        {myDriverRides.length > 0 && (() => {
                          const sortedDriverRides = [...myDriverRides].sort((a, b) => {
                            const scoreStatus = (s: string) => (s === 'in_progress' ? 4 : s === 'arrived_at_pickup' ? 3 : s === 'to_pickup' ? 2 : 1);
                            const diff = scoreStatus(b.status) - scoreStatus(a.status);
                            if (diff !== 0) return diff;
                            return (a.acceptedAt || a.createdAt || 0) - (b.acceptedAt || b.createdAt || 0);
                          });

                          return (
                            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  🚗 Fila de Atendimento ({sortedDriverRides.length})
                                </h4>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Atendimento sequencial obrigatório
                                </span>
                              </div>

                              {sortedDriverRides.map((r, index) => {
                                const isCurrentActive = index === 0;

                                return (
                                  <div
                                    key={r.id}
                                    className="driver-active-ride-card"
                                    style={{
                                      border: `1.5px solid ${isCurrentActive ? '#6366f1' : 'var(--border-subtle)'}`,
                                      borderRadius: '16px',
                                      padding: '16px',
                                      marginBottom: '14px',
                                      position: 'relative',
                                      boxShadow: isCurrentActive ? '0 0 25px rgba(99, 102, 241, 0.2)' : undefined,
                                      opacity: isCurrentActive ? 1 : 0.85
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                          fontSize: '0.72rem',
                                          fontWeight: 800,
                                          padding: '3px 10px',
                                          borderRadius: '20px',
                                          background: isCurrentActive ? '#10b981' : '#f59e0b',
                                          color: '#fff'
                                        }}>
                                          {isCurrentActive ? '🟢 Em Atendimento Agora' : `🕒 ${index + 1}ª na Fila de Espera`}
                                        </span>
                                        <strong className="ride-title-text" style={{ fontSize: '0.85rem' }}>#{r.id.slice(-6)}</strong>
                                      </div>

                                      <span style={{
                                        fontSize: '0.75rem',
                                        color: r.status === 'in_progress' ? '#10b981' : r.status === 'arrived_at_pickup' ? '#38bdf8' : r.status === 'to_pickup' ? '#a855f7' : '#f59e0b',
                                        fontWeight: 800,
                                        textTransform: 'uppercase'
                                      }}>
                                        {r.status === 'arrived_at_pickup'
                                          ? '📍 NO LOCAL DE EMBARQUE'
                                          : r.status === 'to_pickup'
                                          ? '🚗 A CAMINHO DO EMBARQUE'
                                          : r.status === 'in_progress'
                                          ? '⏱️ EM ANDAMENTO'
                                          : 'CONFIRMADA'}
                                      </span>
                                    </div>

                                    {r.isScheduled && r.scheduledFor && (
                                      <div style={{
                                        fontSize: '0.78rem',
                                        color: '#38bdf8',
                                        background: 'rgba(14, 165, 233, 0.15)',
                                        border: '1px solid rgba(14, 165, 233, 0.35)',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        marginBottom: '10px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}>
                                        📅 Corrida Agendada para: {formatScheduledDate(r.scheduledFor)}
                                      </div>
                                    )}

                                    {safeAmenitiesArray(r.requiredAmenities).length > 0 && (
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                        {safeAmenitiesArray(r.requiredAmenities).map(am => (
                                          <span key={am} className="amenity-badge-tag" style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            fontWeight: 600
                                          }}>
                                            {am === 'acessibilidade_pcd' ? '♿ Adaptado PCD' :
                                             am === 'ar_condicionado' ? '❄️ Ar-Condicionado' :
                                             am === 'porta_malas' ? '🧳 Porta-Malas Grande' :
                                             am === 'pet_friendly' ? '🐾 Pet Friendly' :
                                             am === 'cadeirinha' ? '👶 Cadeirinha Bebê' :
                                             am === 'wifi' ? '📶 Wi-Fi 5G' : am}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div>👤 <strong>Passageiro:</strong> <span className="ride-title-text">{r.clientName || 'Passageiro'}</span></div>
                                      <div>📍 <strong>Embarque:</strong> {r.origin}</div>
                                      <div>🏁 <strong>Destino:</strong> {r.destination}</div>
                                      <div style={{ color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                                        💵 Ganho Líquido: {formatCurrency(r.driverNet)} ({r.hours}h de serviço)
                                      </div>
                                    </div>

                                    {/* Alerta de Fila de Espera se não for o primeiro */}
                                    {!isCurrentActive && (
                                      <div style={{
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        color: '#fcd34d',
                                        fontSize: '0.75rem',
                                        marginBottom: '10px',
                                        lineHeight: 1.4
                                      }}>
                                        ⚠️ <strong>Aguardando conclusão da corrida atual (#{sortedDriverRides[0].id.slice(-6)}):</strong> Os botões de início e atendimento desta corrida serão liberados automaticamente assim que a anterior for finalizada ou cancelada.
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {/* Linha de Botões de GPS */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (r.status === 'in_progress') {
                                              handleOpenGpsNavigation(
                                                r.destination,
                                                'Destino Final da Corrida',
                                                r.destLat && r.destLng ? { lat: r.destLat, lng: r.destLng } : undefined
                                              );
                                            } else {
                                              handleOpenGpsNavigation(
                                                r.origin,
                                                'Ponto de Embarque do Passageiro',
                                                r.originLat && r.originLng ? { lat: r.originLat, lng: r.originLng } : undefined
                                              );
                                            }
                                          }}
                                          className="btn-outline"
                                          style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            borderColor: '#38bdf8',
                                            color: '#38bdf8',
                                            background: 'rgba(56, 189, 248, 0.08)'
                                          }}
                                        >
                                          <Navigation size={16} />
                                          <span>{r.status === 'in_progress' ? '🗺️ Abrir GPS até o Destino' : '🗺️ Abrir GPS até o Passageiro'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setGpsModalData({
                                              isOpen: true,
                                              destinationAddress: r.status === 'in_progress' ? r.destination : r.origin,
                                              destinationLabel: r.status === 'in_progress' ? 'Destino Final' : 'Ponto de Embarque',
                                              coords: r.status === 'in_progress'
                                                ? (r.destLat && r.destLng ? { lat: r.destLat, lng: r.destLng } : undefined)
                                                : (r.originLat && r.originLng ? { lat: r.originLat, lng: r.originLng } : undefined)
                                            });
                                          }}
                                          className="btn-outline"
                                          style={{ padding: '10px 12px', fontSize: '0.78rem', borderRadius: '10px', color: 'var(--text-secondary)' }}
                                          title="Alterar aplicativo padrão de GPS (Waze / Google Maps / Apple Maps)"
                                        >
                                          ⚙️ GPS
                                        </button>
                                      </div>

                                      {/* Ações de Transição de Etapa Operacional (Apenas na Corrida Ativa no Topo da Fila) */}
                                      {isCurrentActive ? (
                                        <>
                                          {r.status === 'accepted' && (
                                            <button
                                              onClick={() => handleStartToPickup(r.id)}
                                              className="btn-primary"
                                              style={{
                                                width: '100%',
                                                padding: '12px',
                                                fontSize: '0.9rem',
                                                fontWeight: 800,
                                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                              }}
                                            >
                                              <Car size={18} />
                                              <span>🚗 Iniciar Deslocamento até o Passageiro</span>
                                            </button>
                                          )}

                                          {r.status === 'to_pickup' && (
                                            <button
                                              onClick={() => handleArrivedAtPickup(r.id)}
                                              className="btn-primary"
                                              style={{
                                                width: '100%',
                                                padding: '12px',
                                                fontSize: '0.9rem',
                                                fontWeight: 800,
                                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                              }}
                                            >
                                              <MapPin size={18} />
                                              <span>📍 Cheguei ao Local de Embarque</span>
                                            </button>
                                          )}

                                          {r.status === 'arrived_at_pickup' && (
                                            <button
                                              onClick={() => handleStartRide(r.id)}
                                              className="btn-primary"
                                              style={{
                                                width: '100%',
                                                padding: '12px',
                                                fontSize: '0.9rem',
                                                fontWeight: 800,
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                              }}
                                            >
                                              <PlayCircle size={18} />
                                              <span>🏁 Iniciar Corrida até o Destino (Passageiro a Bordo)</span>
                                            </button>
                                          )}

                                          {r.status === 'in_progress' && (
                                            <button
                                              onClick={() => handleFinishRide(r.id)}
                                              className="btn-success"
                                              style={{
                                                width: '100%',
                                                padding: '12px',
                                                fontSize: '0.9rem',
                                                fontWeight: 800,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                              }}
                                            >
                                              <CheckCircle2 size={18} />
                                              <span>Concluir Corrida e Receber {formatCurrency(r.driverNet)}</span>
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <button
                                          disabled
                                          className="btn-outline"
                                          style={{
                                            width: '100%',
                                            padding: '10px',
                                            fontSize: '0.82rem',
                                            opacity: 0.5,
                                            cursor: 'not-allowed'
                                          }}
                                        >
                                          🔒 Atendimento bloqueado até finalizar a corrida anterior
                                        </button>
                                      )}

                                      {/* Botão de Cancelamento com Justificativa Obrigatória */}
                                      <button
                                        type="button"
                                        onClick={() => setDriverCancelModalRide(r)}
                                        className="btn-outline"
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          fontSize: '0.78rem',
                                          borderColor: 'rgba(239, 68, 68, 0.4)',
                                          color: '#fca5a5',
                                          background: 'rgba(239, 68, 68, 0.05)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        <Ban size={14} />
                                        <span>Cancelar Atendimento com Justificativa</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                          </div>
                        )}
                      </div>
                    </>
                    </div>
                  ) : (
                    /* SUB-ABA: HISTÓRICO DE CORRIDAS DO MOTORISTA COM FILTROS DE DATA (PADRÃO: ESTA SEMANA) */
                    (() => {
                      const now = Date.now();
                      const startOfToday = new Date();
                      startOfToday.setHours(0, 0, 0, 0);

                      const myCompletedRides = rides.filter(r => r.driverId === currentUser.id);

                      const filteredDriverRides = myCompletedRides.filter(r => {
                        const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at).getTime() : now;
                        if (driverDateFilter === 'today') {
                          return rideTime >= startOfToday.getTime();
                        }
                        if (driverDateFilter === 'week') {
                          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
                          return rideTime >= sevenDaysAgo;
                        }
                        if (driverDateFilter === '15days') {
                          const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;
                          return rideTime >= fifteenDaysAgo;
                        }
                        if (driverDateFilter === '30days') {
                          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
                          return rideTime >= thirtyDaysAgo;
                        }
                        if (driverDateFilter === 'custom') {
                          if (!driverCustomDate) return true;
                          const targetDateStr = new Date(rideTime).toISOString().slice(0, 10);
                          return targetDateStr === driverCustomDate;
                        }
                        return true;
                      });

                      const totalNetEarned = filteredDriverRides.reduce((acc, curr) => acc + (curr.driverNet || 0), 0);

                      return (
                        <div className="glass-panel" style={{ padding: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                  <Clock size={22} color="#10b981" />
                                  Meu Histórico de Corridas Atendidas ({filteredDriverRides.length})
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => setDriverSubTab('radar')}
                                  className="btn-outline driver-subnav-desktop"
                                  style={{
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Radio size={14} color="#10b981" /> Ir para o Radar
                                </button>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                                Acompanhe todas as suas corridas realizadas e os ganhos líquidos no período.
                              </p>
                            </div>

                            <div style={{
                              background: theme === 'light' ? '#ecfdf5' : 'rgba(16, 185, 129, 0.12)',
                              border: theme === 'light' ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '10px 18px',
                              borderRadius: '12px',
                              textAlign: 'right'
                            }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: theme === 'light' ? '#065f46' : '#a7f3d0' }}>Ganho Líquido no Período</div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: theme === 'light' ? '#047857' : '#10b981' }}>{formatCurrency(totalNetEarned)}</div>
                            </div>
                          </div>

                          {/* Barra de Filtros de Período Fixos e Personalizado (Padrão: Esta semana) */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            padding: '10px 14px',
                            background: theme === 'light' ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '12px',
                            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid var(--border-subtle)',
                            marginBottom: '20px'
                          }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
                              <Filter size={15} color="#10b981" />
                              Filtrar por:
                            </span>

                            <button
                              type="button"
                              onClick={() => setDriverDateFilter('all')}
                              className={`filter-pill-btn ${driverDateFilter === 'all' ? 'active' : ''}`}
                            >
                              Todas
                            </button>

                            <button
                              type="button"
                              onClick={() => setDriverDateFilter('today')}
                              className={`filter-pill-btn ${driverDateFilter === 'today' ? 'active' : ''}`}
                            >
                              Hoje
                            </button>

                            <button
                              type="button"
                              onClick={() => setDriverDateFilter('week')}
                              className={`filter-pill-btn ${driverDateFilter === 'week' ? 'active' : ''}`}
                            >
                              7 dias
                            </button>

                            <button
                              type="button"
                              onClick={() => setDriverDateFilter('15days')}
                              className={`filter-pill-btn ${driverDateFilter === '15days' ? 'active' : ''}`}
                            >
                              15 dias
                            </button>

                            <button
                              type="button"
                              onClick={() => setDriverDateFilter('30days')}
                              className={`filter-pill-btn ${driverDateFilter === '30days' ? 'active' : ''}`}
                            >
                              30 dias
                            </button>

                            <button
                              type="button"
                              onClick={() => setDriverDateFilter('custom')}
                              className={`filter-pill-btn ${driverDateFilter === 'custom' ? 'active' : ''}`}
                            >
                              Data Específica
                            </button>

                            {driverDateFilter === 'custom' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                <input
                                  type="date"
                                  value={driverCustomDate}
                                  onChange={(e) => setDriverCustomDate(e.target.value)}
                                  className="input-field"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '0.8rem',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    color: '#fff',
                                    border: '1px solid #10b981',
                                    borderRadius: '8px'
                                  }}
                                />
                                {driverCustomDate && (
                                  <button
                                    type="button"
                                    onClick={() => setDriverCustomDate('')}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                                    title="Limpar data"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {filteredDriverRides.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                              <Car size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                              <p style={{ fontWeight: 600 }}>Nenhuma corrida atendida neste período.</p>
                              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Alterne os filtros acima para visualizar outras datas.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {filteredDriverRides.map(r => {
                                const rideTime = r.createdAt || (r as any).created_at ? new Date(r.createdAt || (r as any).created_at) : null;
                                const isExpanded = !!expandedDriverRideIds[r.id];

                                return (
                                  <div
                                    key={r.id}
                                    className="ride-history-card"
                                    style={{
                                      border: isExpanded ? '1px solid rgba(16, 185, 129, 0.5)' : undefined,
                                      borderRadius: '14px',
                                      overflow: 'hidden',
                                      transition: 'all 0.2s ease-in-out'
                                    }}
                                  >
                                    {/* Cabeçalho do Card (Sempre Visível, Clicável para Expandir/Recolher) */}
                                    <div
                                      onClick={() => toggleDriverRideExpand(r.id)}
                                      style={{
                                        padding: '14px 16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        gap: '12px'
                                      }}
                                      title={isExpanded ? 'Clique para recolher detalhes' : 'Clique para ver detalhes completos'}
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                          <span
                                            className="ride-title-text"
                                            style={{
                                              fontWeight: 700,
                                              fontSize: '0.9rem',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              maxWidth: '220px'
                                            }}
                                          >
                                            {r.origin?.split(',')[0] || r.origin} ➔ {r.destination?.split(',')[0] || r.destination}
                                          </span>
                                          <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            background: r.status === 'finished' ? 'rgba(16, 185, 129, 0.15)' : r.status === 'in_progress' ? 'rgba(59, 130, 246, 0.15)' : (r.status === 'accepted' || r.status === 'to_pickup') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: r.status === 'finished' ? '#10b981' : r.status === 'in_progress' ? '#3b82f6' : (r.status === 'accepted' || r.status === 'to_pickup') ? '#f59e0b' : '#ef4444'
                                          }}>
                                            {r.status === 'finished' ? 'CONCLUÍDA' : r.status === 'in_progress' ? 'EM ANDAMENTO' : r.status === 'to_pickup' ? 'A CAMINHO' : r.status === 'accepted' ? 'CONFIRMADA' : r.status === 'searching' ? 'BUSCANDO' : 'CANCELADA'}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                          <span>{r.clientName || 'Cliente'}</span>
                                          {rideTime && (
                                            <>
                                              <span>•</span>
                                              <span>{rideTime.toLocaleDateString('pt-BR')} às {rideTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                            Ganho: {formatCurrency(r.driverNet)}
                                          </div>
                                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            {r.hours}h ({formatCurrency(r.hourlyRate)}/h)
                                          </div>
                                        </div>

                                        <div style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '50%',
                                          background: isExpanded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: isExpanded ? '#10b981' : 'var(--text-secondary)',
                                          transition: 'transform 0.2s'
                                        }}>
                                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Corpo Expandido com Detalhamento Completo */}
                                    {isExpanded && (
                                      <div style={{
                                        padding: '14px 16px 16px',
                                        borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: theme === 'light' ? '#f8fafc' : 'rgba(10, 15, 30, 0.6)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                      }}>
                                        {/* Grid Financeiro da Corrida */}
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                          gap: '8px',
                                          background: theme === 'light' ? '#ffffff' : 'rgba(15, 23, 42, 0.6)',
                                          padding: '12px',
                                          borderRadius: '10px',
                                          border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid var(--border-subtle)'
                                        }}>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total do Cliente:</span>
                                            <strong className="ride-title-text" style={{ fontSize: '0.9rem' }}>{formatCurrency(r.total)}</strong>
                                          </div>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'block' }}>Seu Repasse (85%):</span>
                                            <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>{formatCurrency(r.driverNet)}</strong>
                                          </div>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Taxa Plataforma (15%):</span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatCurrency((r as any).platformFee || (r.total - r.driverNet))}</span>
                                          </div>
                                          <div>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Pagamento:</span>
                                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>
                                              {r.paymentMethod === 'credit_card' ? '💳 Cartão de Crédito (App)' : r.paymentMethod === 'cash' ? '💵 Dinheiro ao Motorista' : r.paymentMethod === 'card_machine' ? '📱 Maquininha do Motorista' : r.paymentMethod === 'pix' ? '🔑 Pix Direto' : '💳 Plataforma'}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Endereços Completos */}
                                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                            <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>🟢 Origem:</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{r.origin}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                            <span style={{ color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>🔴 Destino:</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{r.destination}</span>
                                          </div>
                                        </div>

                                        {/* Rodapé do Card Expandido com ID e Botão de Ocorrência */}
                                        <div style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          paddingTop: '8px',
                                          borderTop: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
                                          flexWrap: 'wrap',
                                          gap: '8px'
                                        }}>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            ID: #{r.id.slice(-8).toUpperCase()}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedRideForReport(r);
                                              setIsReportModalOpen(true);
                                            }}
                                            className="btn-outline"
                                            style={{
                                              fontSize: '0.72rem',
                                              padding: '5px 12px',
                                              borderRadius: '8px',
                                              borderColor: 'rgba(239, 68, 68, 0.4)',
                                              color: '#f87171'
                                            }}
                                          >
                                            ⚠️ Reportar Ocorrência
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: COMPARTILHAR O APLICATIVO */}
        {activeTab === 'mobile' && (
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="glass-panel" style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}>
                <Share2 size={24} color="#f59e0b" />
              </div>

              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '6px', color: '#fff' }}>
                Compartilhar o DriveHora
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '440px', margin: '0 auto 20px' }}>
                Envie o link de acesso rápido para novos passageiros e motoristas parceiros ou aponte a câmera para o QR Code:
              </p>

              {/* QR Code Compacto */}
              <div style={{
                background: '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                display: 'inline-block',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                marginBottom: '20px'
              }}>
                <QRCodeSVG
                  value={appAccessUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Card de Link Direto Sem Quebra de Linha */}
              <div className="share-link-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Link de Acesso Rápido</span>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>● Online</span>
                </div>

                <div className="link-box">
                  <span className="link-url-text" style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'left'
                  }}>
                    {appAccessUrl}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(appAccessUrl);
                      showToast('Link copiado para a área de transferência!', 'success');
                    }}
                    className="btn-outline btn-copy-link"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.76rem',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.share({
                            title: 'DriveHora — Mobilidade por Hora',
                            text: 'Acesse o DriveHora e solicite seu motorista particular por hora ou agende suas viagens:',
                            url: appAccessUrl
                          });
                        } catch (e) {}
                      }}
                      className="btn-primary"
                      style={{
                        flex: '1 1 140px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Share2 size={13} />
                      <span>Compartilhar Link</span>
                    </button>
                  )}

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Acesse o DriveHora — Mobilidade por Hora: ${appAccessUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline"
                    style={{
                      flex: '1 1 140px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      borderRadius: '8px',
                      borderColor: 'rgba(16, 185, 129, 0.4)',
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>Enviar no WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Guia Rápido de Instalação no Smartphone */}
              <div className="share-instructions-card">
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '10px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={15} color="#38bdf8" />
                  <span>Como instalar como atalho no smartphone:</span>
                </h4>
                <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', margin: 0 }}>
                  <li>Acesse o link pelo navegador do celular.</li>
                  <li>No <strong>Android (Chrome)</strong>: Toque no menu (3 pontinhos) e escolha <em>"Instalar aplicativo"</em> ou <em>"Adicionar à tela inicial"</em>.</li>
                  <li>No <strong>iPhone (Safari)</strong>: Toque no botão de compartilhar e escolha <em>"Adicionar à Tela de Início"</em>.</li>
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
        background: 'var(--card-bg)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span>© 2026 DriveHora — Todos os direitos reservados</span>
        </div>
      </footer>

      {/* Modal da Ficha Executiva do Motorista (Segura e sem dados sensíveis) */}
      {selectedDriverForProfile && (
        <DriverProfileModal
          driver={selectedDriverForProfile}
          onClose={() => setSelectedDriverForProfile(null)}
          onToggleFavorite={handleToggleFavorite}
          onRequestDirectRide={handleSelectDriverForBooking}
        />
      )}

      {/* MODAL DE PAGAMENTO PIX DINÂMICO (ASAAS) */}
      {pixModalData && pixModalData.isOpen && (
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
            maxWidth: '420px',
            width: '100%',
            padding: '26px',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <strong style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ Pagamento Pix Instantâneo
              </strong>
              <button
                type="button"
                onClick={() => setPixModalData(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Abra o app do seu banco e realize o pagamento via <strong>QR Code Pix</strong> ou copie o código abaixo:
            </div>

            <div style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '16px',
              display: 'inline-block',
              margin: '0 auto 16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
            }}>
              {pixModalData.qrCodeUrl?.startsWith('http') || pixModalData.qrCodeUrl?.startsWith('data:') ? (
                <img
                  src={pixModalData.qrCodeUrl}
                  alt="QR Code Pix"
                  style={{ width: '200px', height: '200px', display: 'block', borderRadius: '8px' }}
                />
              ) : (
                <QRCodeSVG value={pixModalData.copiaECola || 'PIX_DRIVEHORA'} size={200} />
              )}
            </div>

            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginBottom: '14px' }}>
              {formatCurrency(pixModalData.amount)}
            </div>

            {pixModalData.copiaECola && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixModalData.copiaECola || '');
                    setIsCopiedPix(true);
                    showToast('Código Pix Copia e Cola copiado com sucesso!', 'success');
                    setTimeout(() => setIsCopiedPix(false), 3000);
                  }}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isCopiedPix ? <Check size={18} /> : <Smartphone size={18} />}
                  <span>{isCopiedPix ? 'Copiado para a Área de Transferência!' : 'Copiar Código Pix (Copia e Cola)'}</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={async () => {
                  const confirmedAt = Date.now();
                  try {
                    // Confirma e registra a cobrança no painel do Asaas como RECEBIDA
                    if (pixModalData.externalId) {
                      await simulateAsaasPayment(pixModalData.externalId, pixModalData.amount);
                    }
                    await dbUpdateRide(pixModalData.rideId, { 
                      paymentStatus: 'paid',
                      status: 'searching',
                      createdAt: confirmedAt 
                    });
                    setRides(prev => prev.map(r => r.id === pixModalData.rideId ? { ...r, paymentStatus: 'paid', status: 'searching', createdAt: confirmedAt } : r));
                    setCurrentRideId(pixModalData.rideId);
                    await fetchRides();
                  } catch (e) {
                    console.warn('Erro ao atualizar status de pagamento do Pix:', e);
                  }
                  setPixModalData(null);
                  showToast('Pagamento Pix confirmado no Asaas com sucesso! O motorista já foi notificado.', 'success');

                  // Rolar suavemente até o radar de busca e acompanhamento
                  setTimeout(() => {
                    const radarEl = document.getElementById('active-ride-tracking-section');
                    if (radarEl) {
                      radarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 200);
                }}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '0.9rem', background: '#10b981', borderColor: '#10b981' }}
              >
                {systemSettings.paymentGateway.environment === 'sandbox' ? '🧪 Simular Pagamento Pix (Sandbox / Teste)' : 'Já fiz o pagamento / Concluir'}
              </button>

              <button
                type="button"
                onClick={() => setPixModalData(null)}
                className="btn-outline"
                style={{ width: '100%', padding: '8px', fontSize: '0.8rem', opacity: 0.75 }}
              >
                Fechar janela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior Mobile (Menu no Rodapé Estilo App Nativo) */}
      {activeTab === 'client' && (
        <>
          <div className="mobile-nav-spacer" />
          <nav className="mobile-bottom-nav" aria-label="Menu Inferior de Navegação">
            <button
              onClick={() => {
                setClientSubTab('request');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${clientSubTab === 'request' ? 'active' : ''}`}
            >
              <div className="icon-wrapper">
                <Car size={19} />
              </div>
              <span>Solicitar</span>
            </button>
 
            <button
              onClick={() => {
                setClientSubTab('scheduled');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${clientSubTab === 'scheduled' ? 'active' : ''}`}
            >
              <div className="icon-wrapper" style={{ position: 'relative' }}>
                <Calendar size={19} />
                {clientScheduledRides.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-6px',
                    background: '#f59e0b',
                    color: '#000',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 6px rgba(245, 158, 11, 0.8)'
                  }}>
                    {clientScheduledRides.length}
                  </span>
                )}
              </div>
              <span>Agendadas</span>
            </button>

            <button
              onClick={() => {
                setClientSubTab('nearby_radar');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${clientSubTab === 'nearby_radar' ? 'active' : ''}`}
            >
              <div className="icon-wrapper">
                <Radio size={19} className={clientSubTab === 'nearby_radar' ? 'animate-pulse' : ''} />
              </div>
              <span>Radar</span>
            </button>

            <button
              onClick={() => {
                setClientSubTab('favorites');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${clientSubTab === 'favorites' ? 'active' : ''}`}
            >
              <div className="icon-wrapper">
                <Heart 
                  size={19} 
                  fill={clientSubTab === 'favorites' ? '#ef4444' : 'none'} 
                  color={clientSubTab === 'favorites' ? '#ef4444' : 'currentColor'} 
                />
              </div>
              <span>Favoritos</span>
            </button>

            <button
              onClick={() => {
                setClientSubTab('history');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${clientSubTab === 'history' ? 'active' : ''}`}
            >
              <div className="icon-wrapper">
                <Clock size={19} />
              </div>
              <span>Histórico</span>
            </button>

            <button
              onClick={() => {
                setClientSubTab('profile');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${clientSubTab === 'profile' ? 'active' : ''}`}
            >
              <div className="icon-wrapper">
                <UserCheck size={19} />
              </div>
              <span>Perfil</span>
            </button>
          </nav>
        </>
      )}

      {/* Barra de Navegação Inferior Mobile para Motorista (Menu no Rodapé Estilo App Nativo) */}
      {activeTab === 'driver' && (
        <>
          <div className="mobile-nav-spacer" />
          <nav className="mobile-bottom-nav" aria-label="Menu Inferior do Motorista">
            <button
              onClick={() => {
                setShowDriverProfileEdit(false);
                setDriverSubTab('radar');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${driverSubTab === 'radar' && !showDriverProfileEdit ? 'active driver-active' : ''}`}
            >
              <div className="icon-wrapper">
                <Radio size={19} className={isDriverOnline ? 'animate-pulse' : ''} />
              </div>
              <span>Radar</span>
            </button>

            <button
              onClick={() => {
                setShowDriverProfileEdit(false);
                setDriverSubTab('history');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${driverSubTab === 'history' && !showDriverProfileEdit ? 'active driver-active' : ''}`}
            >
              <div className="icon-wrapper">
                <Clock size={19} />
              </div>
              <span>Histórico</span>
            </button>

            {/* Botão Central de Alternância de Status Online/Offline */}
            <button
              onClick={handleToggleDriverOnline}
              disabled={isTogglingOnline}
              className={`mobile-nav-item driver-status-item ${isDriverOnline ? 'is-online' : 'is-offline'}`}
              title={isDriverOnline ? 'Toque para ficar Offline' : 'Toque para ficar Online'}
            >
              <div className="icon-wrapper driver-status-icon">
                {isTogglingOnline ? (
                  <RefreshCw size={19} className="animate-spin" />
                ) : (
                  <Radio size={19} className={isDriverOnline ? 'animate-pulse' : ''} />
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.68rem' }}>{isDriverOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </button>

            <button
              onClick={() => {
                setDriverOnboardingInitialStep(1);
                setShowDriverProfileEdit(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`mobile-nav-item ${showDriverProfileEdit && driverOnboardingInitialStep !== 4 ? 'active driver-active' : ''}`}
            >
              <div className="icon-wrapper">
                <Car size={19} />
              </div>
              <span>Veículo/Doc</span>
            </button>

            {isUserAdmin ? (
              <button
                onClick={() => {
                  setActiveTab('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="mobile-nav-item"
                style={{ color: '#f59e0b' }}
              >
                <div className="icon-wrapper">
                  <Crown size={19} color="#f59e0b" />
                </div>
                <span>Admin</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setDriverOnboardingInitialStep(4);
                  setShowDriverProfileEdit(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`mobile-nav-item ${showDriverProfileEdit && driverOnboardingInitialStep === 4 ? 'active driver-active' : ''}`}
              >
                <div className="icon-wrapper">
                  <CreditCard size={19} />
                </div>
                <span>Receber</span>
              </button>
            )}
          </nav>
        </>
      )}

      {/* Modal de Reportar Problema com a Corrida */}
      {selectedRideForReport && currentUser && (
        <ReportIssueModal
          ride={selectedRideForReport}
          currentUser={currentUser}
          isOpen={isReportModalOpen}
          reporterRole={activeTab === 'driver' ? 'driver' : 'client'}
          onClose={() => {
            setIsReportModalOpen(false);
            setSelectedRideForReport(null);
          }}
          onSuccess={() => {
            setIsReportModalOpen(false);
            setSelectedRideForReport(null);
            showToast('Ocorrência registrada! Nossa equipe analisará o ocorrido.', 'success');
          }}
        />
      )}

      {/* Modal de Navegação GPS para Motoristas (Waze / Google Maps / Apple Maps) */}
      {gpsModalData && (
        <GpsNavigationModal
          isOpen={gpsModalData.isOpen}
          destinationAddress={gpsModalData.destinationAddress}
          destinationLabel={gpsModalData.destinationLabel}
          coords={gpsModalData.coords}
          onClose={() => setGpsModalData(null)}
          onNavigateStarted={() => {
            showToast('Navegação GPS iniciada! O app DriveHora continua ativo no fundo.', 'success');
          }}
        />
      )}

      {/* Modal de Cancelamento de Atendimento pelo Motorista com Justificativa */}
      {driverCancelModalRide && (
        <DriverCancelModal
          isOpen={Boolean(driverCancelModalRide)}
          ride={driverCancelModalRide}
          onClose={() => setDriverCancelModalRide(null)}
          onConfirmCancel={async (reason) => {
            const rId = driverCancelModalRide.id;
            setDriverCancelModalRide(null);
            await handleDriverCancelRide(rId, reason);
          }}
        />
      )}

      {/* Modal de Avaliação Obrigatória Bilateral (Passageiro e Motorista) */}
      {activeRatingRide && currentUser && (
        <RatingModal
          ride={activeRatingRide}
          currentUserRole={currentUser.role === 'driver' ? 'driver' : 'client'}
          currentUserId={currentUser.id}
          isFavorite={Boolean(activeRatingRide.driverId && favoriteDriverIds.includes(activeRatingRide.driverId))}
          onToggleFavorite={handleToggleFavorite}
          onRatingCompleted={() => {
            setActiveRatingRide(null);
            setCurrentRideId(null);
            // Ao concluir a avaliação com sucesso, descarta quaisquer avisos de cancelamento residuais do passageiro
            setDismissedCancellationIds(prev => {
              const clientCancelledRides = rides.filter(r => r.status === 'cancelled' && r.clientId === currentUser?.id).map(r => r.id);
              const updated = Array.from(new Set([...prev, ...clientCancelledRides]));
              try {
                localStorage.setItem('drivehora_dismissed_cancellations', JSON.stringify(updated));
              } catch {}
              return updated;
            });
            showToast('Avaliação registrada com sucesso! Obrigado pelo feedback.', 'success');
          }}
        />
      )}

      {/* Modal de Suporte para Quitação e Regularização de Débito */}
      {showDebtSupportModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              borderRadius: '24px',
              background: '#0f172a',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <AlertCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Regularização de Débito Pendente
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                Seu saldo atual está devedor em{' '}
                <strong style={{ color: '#ef4444' }}>
                  {formatCurrency(Math.abs(clientWallet?.balance || 0))}
                </strong>
                . Descreva abaixo sua solicitação para que a equipe de administração avalie e dê baixa no débito.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '8px', fontWeight: 600 }}>
                Mensagem para a Administração / Suporte:
              </label>
              <textarea
                value={debtSupportMessage}
                onChange={(e) => setDebtSupportMessage(e.target.value)}
                placeholder="Ex: Realizei o pagamento via transferência direta / Solicito quitação por favor..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowDebtSupportModal(false)}
                className="btn-outline"
                style={{ flex: 1, padding: '12px' }}
                disabled={isSubmittingDebtSupport}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingDebtSupport || !debtSupportMessage.trim()}
                onClick={async () => {
                  if (!currentUser?.id) return;
                  setIsSubmittingDebtSupport(true);
                  try {
                    await dbCreateRideReport({
                      id: 'rep_' + Date.now(),
                      rideId: 'WALLET_DEBT',
                      reporterId: currentUser.id,
                      reporterName: currentUser.fullName || 'Passageiro',
                      reporterRole: 'client',
                      reporterPhone: currentUser.phone,
                      category: 'other',
                      categoryLabel: 'Quitação de Débito',
                      description: `Saldo devedor: ${formatCurrency(Math.abs(clientWallet?.balance || 0))}\nMensagem: ${debtSupportMessage}`,
                      status: 'pending',
                      createdAt: Date.now()
                    });
                    showToast('Solicitação enviada ao administrador com sucesso!', 'success');
                    setShowDebtSupportModal(false);
                    setDebtSupportMessage('');
                  } catch (err) {
                    console.error('Erro ao enviar solicitação:', err);
                    showToast('Erro ao enviar solicitação ao suporte. Tente novamente.', 'error');
                  } finally {
                    setIsSubmittingDebtSupport(false);
                  }
                }}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)'
                }}
              >
                {isSubmittingDebtSupport ? 'Enviando...' : 'Enviar ao Suporte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

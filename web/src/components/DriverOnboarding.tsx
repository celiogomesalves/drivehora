import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile, DriverProfile, DriverVerificationStatus } from '../types/auth';
import { 
  ShieldCheck, Camera, CheckCircle2, 
  UploadCloud, Check, AlertCircle, Eye, Database, Edit3, X,
  ArrowRight, ArrowLeft, Lock, Send, MessageSquare, CreditCard, Save, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatPhone, formatCpf, formatPlate, validateCpf, validateCnh, validatePlate, validatePhone } from '../utils/formatters';
import { dbSaveDriverProfile, dbCheckSupabaseStatus, dbUpdateDriverPaymentPrefs } from '../services/dbService';
import { getSystemSettings, type VehicleCategoryConfig } from '../services/settingsService';
import { useSystemDialog } from './SystemDialog';

interface DriverOnboardingProps {
  user: UserProfile;
  initialProfile?: DriverProfile | null;
  initialStep?: number;
  onComplete: (driverProfile: DriverProfile) => void;
  onOpenSupabaseConfig?: () => void;
}

// Lista de comodidades padrão com ícones e descrições
const AVAILABLE_AMENITIES = [
  { id: 'acessibilidade_pcd', label: 'Adaptado PCD / Acessibilidade', icon: '♿', desc: 'Carro adaptado ou suporte a passageiros com deficiência / mobilidade reduzida' },
  { id: 'ar_condicionado', label: 'Ar-Condicionado', icon: '❄️', desc: 'Climatização sempre ligada' },
  { id: 'carregador_usb', label: 'Carregador USB / Tipo-C', icon: '🔌', desc: 'Cabos para Android e iPhone' },
  { id: 'wifi', label: 'Wi-Fi 5G a Bordo', icon: '📶', desc: 'Internet rápida para o passageiro' },
  { id: 'agua_mineral', label: 'Água Mineral Fresca', icon: '💧', desc: 'Garrafinhas lacradas' },
  { id: 'balas_mimos', label: 'Balas / Mimos VIP', icon: '🍬', desc: 'Snacks e doces para a viagem' },
  { id: 'porta_malas', label: 'Porta-Malas Grande', icon: '🧳', desc: 'Espaço para malas e compras' },
  { id: 'pet_friendly', label: 'Aceita Pets (Pet Friendly)', icon: '🐾', desc: 'Transporte seguro de animais' },
  { id: 'cadeirinha', label: 'Cadeirinha / Assento Infantil', icon: '👶', desc: 'Segurança para crianças' },
  { id: 'musica_spotify', label: 'Escolha de Som / Spotify', icon: '🎵', desc: 'Passageiro escolhe a playlist' },
  { id: 'blindado', label: 'Blindagem Certificada', icon: '🛡️', desc: 'Proteção Nível III-A' }
];

// Compressor de imagem no cliente (reduz fotos pesadas para ~120KB)
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = (e.target?.result as string) || '';
      if (!result) return resolve('');

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } catch {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export const DriverOnboarding: React.FC<DriverOnboardingProps> = ({ 
  user, 
  initialProfile, 
  initialStep,
  onComplete,
  onOpenSupabaseConfig 
}) => {
  const { showAlert } = useSystemDialog();
  const getSavedDraft = () => {
    try {
      const raw = localStorage.getItem(`drivehora_driver_draft_${user.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const draft = getSavedDraft();

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear + 2 - 2010 }, (_, i) => String(currentYear + 1 - i));

  // Carregar categorias definidas no sistema
  const systemSettings = getSystemSettings();
  const categoriesList: VehicleCategoryConfig[] = systemSettings.vehicleCategories || [];

  const [step, setStep] = useState<number>(
    initialStep || (initialProfile?.verificationStatus === 'under_review' ? 6 : draft?.step || 1)
  );

  useEffect(() => {
    if (initialStep) {
      setStep(initialStep);
    }
  }, [initialStep]);

  // ABA 4: Formas de Recebimento & Chave Pix
  const [driverAcceptsCash, setDriverAcceptsCash] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`drivehora_driver_payprefs_${user.id}`);
      if (saved) return JSON.parse(saved).acceptsCash ?? true;
      return true;
    } catch { return true; }
  });
  const [driverHasCardMachine, setDriverHasCardMachine] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`drivehora_driver_payprefs_${user.id}`);
      if (saved) return JSON.parse(saved).hasCardMachine ?? true;
      return true;
    } catch { return true; }
  });
  const [driverPixKey, setDriverPixKey] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`drivehora_driver_payprefs_${user.id}`);
      if (saved) return JSON.parse(saved).pixKey || '';
      return (initialProfile as any)?.pixKey || '';
    } catch { return ''; }
  });
  const [isSavingPayPrefs, setIsSavingPayPrefs] = useState(false);
  const [payPrefsSavedNotice, setPayPrefsSavedNotice] = useState(false);
  const [amenitiesSavedNotice, setAmenitiesSavedNotice] = useState(false);

  const handleSavePaymentPrefs = async (showNotice = true) => {
    setIsSavingPayPrefs(true);
    try {
      await dbUpdateDriverPaymentPrefs(user.id, {
        acceptsCash: driverAcceptsCash,
        hasCardMachine: driverHasCardMachine,
        pixKey: driverPixKey.trim()
      });
      if (showNotice) {
        setPayPrefsSavedNotice(true);
        setTimeout(() => setPayPrefsSavedNotice(false), 3000);
      }
    } catch (err) {
      console.error('Erro ao salvar preferências de pagamento:', err);
    } finally {
      setIsSavingPayPrefs(false);
    }
  };

  const handleSaveAmenities = async (showNotice = true) => {
    setErrorMessage(null);
    if (!bio.trim() || bio.trim().length < 15) {
      setErrorMessage('Por favor, escreva uma breve descrição sobre seu perfil profissional (mínimo 15 caracteres).');
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveToDatabase(verificationStatus);
      setIsSaving(false);
      if (res.success) {
        if (showNotice) {
          setAmenitiesSavedNotice(true);
          setTimeout(() => setAmenitiesSavedNotice(false), 3000);
        }
      } else {
        setErrorMessage(`Erro ao salvar comodidades: ${res.error}`);
      }
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(`Erro ao salvar: ${err.message || 'Falha de comunicação'}`);
    }
  };
  
  const initialDriverPhone = (user.phone && user.phone !== '(11) 98765-4321')
    ? formatPhone(user.phone)
    : (initialProfile?.phone && initialProfile.phone !== '(11) 98765-4321')
    ? formatPhone(initialProfile.phone)
    : (draft?.phone && draft.phone !== '(11) 98765-4321')
    ? draft.phone
    : '';

  // ABA 1: Dados Pessoais & CNH
  const [fullName, setFullName] = useState(draft?.fullName || initialProfile?.fullName || user.fullName || '');
  const [cpf, setCpf] = useState(draft?.cpf || formatCpf(initialProfile?.cpf || ''));
  const [phone, setPhone] = useState(initialDriverPhone);
  const [cnhNumber, setCnhNumber] = useState(draft?.cnhNumber || initialProfile?.cnhNumber || '');
  const [cnhCategory, setCnhCategory] = useState(draft?.cnhCategory || initialProfile?.cnhCategory || 'B');

  // ABA 2: Dados do Veículo & Categoria de Atendimento
  const [vehicleBrand, setVehicleBrand] = useState(draft?.vehicleBrand || initialProfile?.vehicleBrand || 'Toyota');
  const [vehicleModel, setVehicleModel] = useState(draft?.vehicleModel || initialProfile?.vehicleModel || 'Corolla XEi');
  const [vehicleYear, setVehicleYear] = useState(draft?.vehicleYear || initialProfile?.vehicleYear || String(currentYear));
  const [vehiclePlate, setVehiclePlate] = useState(draft?.vehiclePlate || formatPlate(initialProfile?.vehiclePlate || 'BRA-2E19'));
  const [vehicleColor, setVehicleColor] = useState(draft?.vehicleColor || initialProfile?.vehicleColor || 'Preto');
  const [vehicleCategory, setVehicleCategory] = useState(draft?.vehicleCategory || initialProfile?.vehicleCategory || 'classico');

  // ABA 3: Comodidades & Perfil / Bio
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    draft?.amenities || initialProfile?.amenities || ['Ar-Condicionado', 'Carregador USB / Tipo-C', 'Água Mineral Fresca']
  );
  const [bio, setBio] = useState<string>(
    draft?.bio || initialProfile?.bio || 'Motorista particular experiente, pontual e atencioso. Direção suave e foco no conforto e segurança do passageiro.'
  );

  // ABA 4: Uploads de Documentos & Biometria
  const [cnhFileName, setCnhFileName] = useState<string>(draft?.cnhFileName || (initialProfile?.cnhUrl ? 'cnh_anexada.jpg' : ''));
  const [cnhUrl, setCnhUrl] = useState<string>(initialProfile?.cnhUrl || '');

  const [crlvFileName, setCrlvFileName] = useState<string>(draft?.crlvFileName || (initialProfile?.crlvUrl ? 'crlv_anexado.jpg' : ''));
  const [crlvUrl, setCrlvUrl] = useState<string>(initialProfile?.crlvUrl || '');

  const [selfieFileName, setSelfieFileName] = useState<string>(draft?.selfieFileName || (initialProfile?.selfieUrl ? 'selfie_biometria.jpg' : ''));
  const [selfieUrl, setSelfieUrl] = useState<string>(initialProfile?.selfieUrl || '');

  // Câmera ao Vivo para Selfie
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Status & Gravação
  const [verificationStatus, setVerificationStatus] = useState<DriverVerificationStatus>(
    initialProfile?.verificationStatus || 'pending_docs'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDbError, setIsDbError] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  // Modal de Solicitação de Alteração de Dados (motorista aprovado)
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeRequestText, setChangeRequestText] = useState('');
  const [changeRequestSent, setChangeRequestSent] = useState(false);

  const isApproved = verificationStatus === 'approved';

  // Sincronizar dados quando o perfil do motorista carregar do banco de dados
  useEffect(() => {
    if (initialProfile) {
      const bestName = initialProfile.fullName || initialProfile.driverName;
      if (bestName) setFullName(bestName);
      if (initialProfile.cpf) setCpf(formatCpf(initialProfile.cpf));
      if (initialProfile.phone) setPhone(formatPhone(initialProfile.phone));
      if (initialProfile.cnhNumber) setCnhNumber(initialProfile.cnhNumber);
      if (initialProfile.cnhCategory) setCnhCategory(initialProfile.cnhCategory);
      if (initialProfile.vehicleBrand) setVehicleBrand(initialProfile.vehicleBrand);
      if (initialProfile.vehicleModel) setVehicleModel(initialProfile.vehicleModel);
      if (initialProfile.vehicleYear) setVehicleYear(initialProfile.vehicleYear);
      if (initialProfile.vehiclePlate) setVehiclePlate(formatPlate(initialProfile.vehiclePlate));
      if (initialProfile.vehicleColor) setVehicleColor(initialProfile.vehicleColor);
      if (initialProfile.vehicleCategory) setVehicleCategory(initialProfile.vehicleCategory);
      if (initialProfile.verificationStatus) setVerificationStatus(initialProfile.verificationStatus);
      if (initialProfile.bio) setBio(initialProfile.bio);
      if (initialProfile.amenities && initialProfile.amenities.length > 0) setSelectedAmenities(initialProfile.amenities);
      if (initialProfile.cnhUrl) {
        setCnhUrl(initialProfile.cnhUrl);
        setCnhFileName('cnh_anexada.jpg');
      }
      if (initialProfile.crlvUrl) {
        setCrlvUrl(initialProfile.crlvUrl);
        setCrlvFileName('crlv_anexado.jpg');
      }
      if (initialProfile.selfieUrl) {
        setSelfieUrl(initialProfile.selfieUrl);
        setSelfieFileName('selfie_biometria.jpg');
      }
    } else if (user.fullName) {
      setFullName(user.fullName);
    }
  }, [initialProfile, user.fullName]);

  // Salvar rascunho em localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        `drivehora_driver_draft_${user.id}`,
        JSON.stringify({
          step,
          fullName,
          cpf,
          phone,
          cnhNumber,
          cnhCategory,
          vehicleBrand,
          vehicleModel,
          vehicleYear,
          vehiclePlate,
          vehicleColor,
          vehicleCategory,
          amenities: selectedAmenities,
          bio,
          cnhFileName,
          crlvFileName,
          selfieFileName
        })
      );
    } catch (e) {}
  }, [step, fullName, cpf, phone, cnhNumber, cnhCategory, vehicleBrand, vehicleModel, vehicleYear, vehiclePlate, vehicleColor, vehicleCategory, selectedAmenities, bio, cnhFileName, crlvFileName, selfieFileName, user.id]);

  // Câmera ao Vivo
  const startLiveCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Erro ao acessar webcam/câmera:', err);
      setCameraError('Não foi possível abrir a câmera diretamente. Utilize a opção de anexar foto dos arquivos abaixo.');
    }
  };

  const stopLiveCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setSelfieUrl(dataUrl);
      setSelfieFileName('selfie_capturada_ao_vivo.jpg');
      stopLiveCamera();
    } catch (err) {
      console.error('Erro ao capturar foto da câmera:', err);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setFileName: (name: string) => void,
    setUrl: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      try {
        if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
          const compressed = await compressImageFile(file);
          setUrl(compressed);
        } else {
          const reader = new FileReader();
          reader.onloadend = () => setUrl((reader.result as string) || '');
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
      }
    }
  };

  const toggleAmenity = (amenity: { id: string; label: string }) => {
    setSelectedAmenities(prev => {
      const isSelected = prev.includes(amenity.label) || prev.includes(amenity.id);
      if (isSelected) {
        return prev.filter(a => a !== amenity.label && a !== amenity.id);
      } else {
        return [...prev, amenity.label, amenity.id];
      }
    });
  };

  // Função de Gravação no Banco de Dados Supabase
  const saveToDatabase = async (status: DriverVerificationStatus): Promise<{ success: boolean; error?: string }> => {
    const profile: DriverProfile = {
      id: 'driver_' + user.id,
      userId: user.id,
      fullName: fullName.trim(),
      driverName: fullName.trim(),
      cpf: cpf.replace(/\D/g, ''),
      phone: phone.replace(/\D/g, ''),
      cnhNumber: cnhNumber.trim(),
      cnhCategory,
      vehicleBrand: vehicleBrand.trim(),
      vehicleModel: vehicleModel.trim(),
      vehicleYear: vehicleYear.trim(),
      vehiclePlate: vehiclePlate.trim().toUpperCase(),
      vehicleColor: vehicleColor.trim(),
      vehicleCategory,
      amenities: selectedAmenities,
      bio: bio.trim(),
      languages: ['Português'],
      cnhUrl: cnhUrl || undefined,
      crlvUrl: crlvUrl || undefined,
      selfieUrl: selfieUrl || undefined,
      verificationStatus: status,
      rating: initialProfile?.rating || 5.0,
      totalRides: initialProfile?.totalRides || 0
    };

    const res = await dbSaveDriverProfile(profile, user);
    return res;
  };

  // Salvar alterações imediatamente sem precisar percorrer todas as etapas
  const handleDirectSave = async () => {
    setErrorMessage(null);
    if (!fullName.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveToDatabase(verificationStatus);
      setIsSaving(false);
      if (res.success) {
        const savedProfile: DriverProfile = {
          id: 'driver_' + user.id,
          userId: user.id,
          fullName: fullName.trim(),
          driverName: fullName.trim(),
          cpf: cpf.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
          cnhNumber: cnhNumber.trim(),
          cnhCategory,
          vehicleBrand: vehicleBrand.trim(),
          vehicleModel: vehicleModel.trim(),
          vehicleYear: vehicleYear.trim(),
          vehiclePlate: vehiclePlate.trim().toUpperCase(),
          vehicleColor: vehicleColor.trim(),
          vehicleCategory,
          amenities: selectedAmenities,
          bio: bio.trim(),
          languages: ['Português'],
          cnhUrl: cnhUrl || undefined,
          crlvUrl: crlvUrl || undefined,
          selfieUrl: selfieUrl || undefined,
          verificationStatus,
          rating: initialProfile?.rating || 5.0,
          totalRides: initialProfile?.totalRides || 0
        };
        onComplete(savedProfile);
      } else {
        setErrorMessage(`Erro ao salvar: ${res.error}`);
      }
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(`Erro ao salvar: ${err.message || 'Falha de comunicação'}`);
    }
  };

  // Validadores de Etapas com Auto-Persistência no Banco
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!fullName.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }
    if (!validateCpf(cpf)) {
      setErrorMessage('CPF inválido. Digite um CPF válido com 11 dígitos.');
      return;
    }
    if (!validatePhone(phone)) {
      setErrorMessage('Telefone inválido. Digite o número com DDD.');
      return;
    }
    if (!validateCnh(cnhNumber)) {
      setErrorMessage('Registro de CNH inválido. Verifique o número de 11 dígitos da sua CNH.');
      return;
    }

    // Persistir imediatamente no banco os dados preenchidos da Etapa 1
    try {
      await saveToDatabase(verificationStatus);
    } catch (err) {}

    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!vehicleBrand.trim() || !vehicleModel.trim()) {
      setErrorMessage('Informe a marca e o modelo do veículo.');
      return;
    }
    if (!validatePlate(vehiclePlate)) {
      setErrorMessage('Placa do veículo inválida. Digite no padrão Mercosul (ABC1D23) ou Tradicional (ABC-1234).');
      return;
    }

    // Persistir imediatamente no banco os dados preenchidos da Etapa 2
    try {
      await saveToDatabase(verificationStatus);
    } catch (err) {}

    setStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!bio.trim() || bio.trim().length < 15) {
      setErrorMessage('Por favor, escreva uma breve descrição sobre seu perfil profissional (mínimo 15 caracteres).');
      return;
    }

    // Persistir imediatamente no banco os dados preenchidos da Etapa 3
    try {
      await saveToDatabase(verificationStatus);
    } catch (err) {}

    setStep(4);
  };

  const handleStep4Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    await handleSavePaymentPrefs(false);
    setStep(5);
  };

  const handleStep5Submit = async () => {
    setErrorMessage(null);
    setIsDbError(false);

    if (!cnhUrl || !crlvUrl || !selfieUrl) {
      setErrorMessage('Documentação incompleta. É obrigatório anexar os 3 arquivos: Foto da CNH, CRLV do Veículo e Selfie Facial.');
      return;
    }

    setIsSaving(true);
    try {
      const dbStatus = await dbCheckSupabaseStatus();
      if (!dbStatus.connected) {
        setIsDbError(true);
        setErrorMessage(`⚠️ Não foi possível salvar: Banco Supabase desconectado (${dbStatus.message || 'Erro de conexão'}).`);
        return;
      }

      const saveResult = await saveToDatabase('under_review');
      if (!saveResult.success) {
        setIsDbError(true);
        setErrorMessage(`Falha ao gravar perfil: ${saveResult.error}`);
        return;
      }

      setVerificationStatus('under_review');
      setStep(6);
    } catch (err: any) {
      setIsDbError(true);
      setErrorMessage(`Erro ao salvar: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveImmediate = async () => {
    setIsSaving(true);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    const res = await saveToDatabase('approved');
    setIsSaving(false);
    if (res.success) {
      setVerificationStatus('approved');
      const profile: DriverProfile = {
        id: 'driver_' + user.id,
        userId: user.id,
        fullName,
        driverName: fullName,
        cpf,
        phone,
        cnhNumber,
        cnhCategory,
        vehicleBrand,
        vehicleModel,
        vehicleYear,
        vehiclePlate,
        vehicleColor,
        vehicleCategory,
        amenities: selectedAmenities,
        bio,
        languages: ['Português'],
        cnhUrl,
        crlvUrl,
        selfieUrl,
        verificationStatus: 'approved',
        rating: 5.0,
        totalRides: 0
      };
      onComplete(profile);
    } else {
      showAlert(`Falha ao aprovar: ${res.error || 'Erro desconhecido'}`, 'error', 'Erro');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* BANNER: MOTORISTA APROVADO — EDIÇÃO BLOQUEADA */}
      {isApproved && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.08))',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Lock size={20} color="#10b981" />
            </div>
            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', margin: 0 }}>
                ✅ Cadastro Aprovado e Protegido
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Dados do veículo e documentos são protegidos após a homologação. Você pode navegar livremente pelas abas e editar comodidades e formas de recebimento.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowChangeRequest(true); setChangeRequestSent(false); setChangeRequestText(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981', fontWeight: 700, fontSize: '0.85rem',
              cursor: 'pointer', flexShrink: 0
            }}
          >
            <MessageSquare size={16} />
            Solicitar Alteração de Dados
          </button>
        </div>
      )}

      {/* HEADER DE ETAPAS — GRADE RESPONSIVA (todas as abas navegáveis diretamente) */}
      <div className="glass-panel" style={{ padding: '12px 16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '4px'
        }}>
          {[
            { num: 1, label: 'Identificação & CNH', short: 'Identificação' },
            { num: 2, label: 'Veículo & Categoria', short: 'Veículo' },
            { num: 3, label: 'Comodidades & Perfil', short: 'Comodidades' },
            { num: 4, label: 'Formas de Recebimento', short: 'Recebimento' },
            { num: 5, label: 'Documentos & Fotos', short: 'Documentos' },
            { num: 6, label: 'Homologação', short: 'Homologação' }
          ].map(s => {
            const isActive = step === s.num;
            const isDone = isApproved || step > s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`driver-step-tab-btn ${isActive ? 'active' : isDone ? 'done' : ''}`}
              >
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: isActive ? '#6366f1' : isDone ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', flexShrink: 0
                }}>
                  {isDone && !isActive ? <Check size={12} /> : s.num}
                </span>
                <span style={{ lineHeight: 1.2, wordBreak: 'break-word' }}>{s.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MENSAGEM DE ERRO GERAL */}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          color: '#f87171',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Atenção:</strong> {errorMessage}
            {isDbError && onOpenSupabaseConfig && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={onOpenSupabaseConfig}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '6px 14px' }}
                >
                  <Database size={13} /> Conectar Banco Supabase
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 1: IDENTIFICAÇÃO & CNH (EAR)
      ======================================================== */}
      {step === 1 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>1. Identificação e Habilitação Profissional (EAR)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Informe seus dados pessoais e número de registro da CNH.
            </p>
          </div>

          <form onSubmit={isApproved ? e => e.preventDefault() : handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label>Nome Completo do Motorista *</label>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Carlos Eduardo da Silva"
                required
                disabled={isApproved}
                style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              />
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label>CPF *</label>
                <input
                  type="tel"
                  className="input-field"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>

              <div className="input-group">
                <label>WhatsApp / Celular com DDD *</label>
                <input
                  type="tel"
                  className="input-field"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  required
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label>Número de Registro da CNH (11 dígitos) *</label>
                <input
                  type="tel"
                  className="input-field"
                  value={cnhNumber}
                  onChange={(e) => setCnhNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="12345678900"
                  maxLength={11}
                  required
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>

              <div className="input-group">
                <label>Categoria CNH *</label>
                <select
                  className="select-field"
                  value={cnhCategory}
                  onChange={(e) => setCnhCategory(e.target.value)}
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  <option value="B">B (Carros de Passeio)</option>
                  <option value="C">C (Veículos de Carga)</option>
                  <option value="D">D (Vans e Passageiros)</option>
                  <option value="E">E (Veículos Articulados)</option>
                  <option value="AB">AB (Carro e Moto)</option>
                </select>
              </div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '0.8rem',
              color: '#c7d2fe'
            }}>
              💡 <strong>Requisito Legal:</strong> Sua CNH deve conter a observação <em>"Exerce Atividade Remunerada" (EAR)</em> para prestação de serviços como motorista parceiro.
            </div>

            {isApproved ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary"
                  style={{ flex: 1, padding: '14px', fontSize: '0.95rem' }}
                >
                  <span>Avançar para Dados do Veículo</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleDirectSave}
                  disabled={isSaving}
                  className="btn-outline"
                  style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
                >
                  {isSaving ? 'Salvando...' : '💾 Salvar'}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
                >
                  <span>Avançar para Veículo</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ========================================================
          ABA 2: DADOS DO VEÍCULO & CATEGORIA
      ======================================================== */}
      {step === 2 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>2. Dados do Veículo & Categoria de Atendimento</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Selecione o enquadramento do seu automóvel na frota DriveHora.
            </p>
          </div>

          {isApproved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', borderRadius: '10px',
              background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#eab308', fontSize: '0.85rem', marginBottom: '16px'
            }}>
              <Lock size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>Dados do Veículo Homologados:</strong> Veículo e categoria aprovados pela plataforma não podem ser alterados diretamente. Para solicitar alteração da sua frota, utilize o botão de solicitação no topo.
              </span>
            </div>
          )}

          <form onSubmit={isApproved ? (e) => { e.preventDefault(); setStep(3); } : handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Seletor de Categoria com Cards Visuais */}
            <div className="input-group">
              <label>Categoria de Serviço do Veículo *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                {categoriesList.map(cat => {
                  const isSelected = vehicleCategory === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onClick={isApproved ? undefined : () => setVehicleCategory(cat.id)}
                      className={`driver-category-card ${isSelected ? 'selected' : ''}`}
                      style={{ opacity: isApproved && !isSelected ? 0.5 : 1 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                        {isSelected && <Check size={16} color="#2563eb" />}
                      </div>
                      <strong>{cat.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{cat.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label>Marca do Veículo *</label>
                <input
                  type="text"
                  className="input-field"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Ex: Toyota, Honda, Hyundai"
                  required
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>

              <div className="input-group">
                <label>Modelo do Veículo *</label>
                <input
                  type="text"
                  className="input-field"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Ex: Corolla XEi, Civic, Creta"
                  required
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="input-group">
                <label>Ano de Fabricação *</label>
                <select
                  className="select-field"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Placa do Veículo *</label>
                <input
                  type="text"
                  className="input-field"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(formatPlate(e.target.value))}
                  placeholder="ABC-1234 ou ABC1D23"
                  maxLength={8}
                  required
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>

              <div className="input-group">
                <label>Cor Predominante *</label>
                <select
                  className="select-field"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  disabled={isApproved}
                  style={isApproved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  <option value="Preto">Preto</option>
                  <option value="Prata">Prata</option>
                  <option value="Branco">Branco</option>
                  <option value="Cinza">Cinza</option>
                  <option value="Azul">Azul</option>
                  <option value="Vermelho">Vermelho</option>
                  <option value="Outra">Outra</option>
                </select>
              </div>
            </div>

            {isApproved ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-outline"
                  style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary"
                  style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
                >
                  <span>Avançar para Comodidades</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-outline"
                  style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  onClick={handleDirectSave}
                  disabled={isSaving}
                  className="btn-outline"
                  style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
                >
                  {isSaving ? 'Salvando...' : '💾 Salvar'}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
                >
                  <span>Avançar para Comodidades</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ========================================================
          ABA 3: COMODIDADES DO VEÍCULO & PERFIL / BIO
      ======================================================== */}
      {step === 3 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>3. Comodidades Oferecidas & Apresentação</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Destaque os diferenciais do seu atendimento para atrair mais clientes VIPs.
            </p>
          </div>

          {isApproved && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '18px',
              fontSize: '0.8rem',
              color: '#a7f3d0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Sparkles size={18} color="#10b981" style={{ flexShrink: 0 }} />
              <span>
                <strong>Edição Livre:</strong> Você pode atualizar suas comodidades e apresentação a qualquer momento para personalizar seu atendimento aos passageiros.
              </span>
            </div>
          )}

          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Lista de Comodidades Interativa */}
            <div className="input-group">
              <label>Comodidades Disponíveis no seu Carro (Selecione todas que se aplicam):</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {AVAILABLE_AMENITIES.map(amenity => {
                  const isChecked = selectedAmenities.includes(amenity.label) || selectedAmenities.includes(amenity.id);

                  return (
                    <div
                      key={amenity.id}
                      onClick={() => toggleAmenity(amenity)}
                      className={`driver-amenity-card ${isChecked ? 'checked' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{amenity.icon}</span>
                        <div>
                          <strong style={{ fontSize: '0.85rem', display: 'block' }}>{amenity.label}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{amenity.desc}</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bio / Apresentação do Motorista */}
            <div className="input-group">
              <label>Descrição Breve / Apresentação Pessoal *</label>
              <textarea
                className="input-field"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte aos passageiros sobre sua experiência como motorista, rotas preferidas, pontualidade, anos de habilitação e diferenciais..."
                style={{ resize: 'vertical', minHeight: '90px' }}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Essa apresentação será exibida na sua Ficha de Motorista para os clientes agendarem corridas.
              </span>
            </div>

            {amenitiesSavedNotice && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#10b981',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                Comodidades e perfil salvos com sucesso!
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-outline"
                style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                type="button"
                onClick={() => handleSaveAmenities(true)}
                disabled={isSaving}
                className="btn-outline"
                style={{ flex: 1, padding: '14px', fontSize: '0.9rem', borderColor: '#10b981', color: '#10b981' }}
              >
                <Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
              >
                <span>Avançar para Recebimento</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          ABA 4: FORMAS DE RECEBIMENTO & CHAVE PIX
      ======================================================== */}
      {step === 4 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={22} color="#818cf8" />
              <h3 className="driver-step-title" style={{ margin: 0 }}>
                4. Formas de Recebimento & Chave Pix
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Configure como você deseja receber o pagamento das suas corridas e informe sua chave Pix para repasses.
            </p>
          </div>

          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '0.8rem',
            color: '#a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Sparkles size={18} color="#10b981" style={{ flexShrink: 0 }} />
            <span>
              <strong>Acesso Livre:</strong> Suas preferências de recebimento e chave Pix podem ser atualizadas a qualquer momento, mesmo após a homologação da sua conta.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Opção 1: Dinheiro */}
            <div
              onClick={() => {
                const nextVal = !driverAcceptsCash;
                setDriverAcceptsCash(nextVal);
                dbUpdateDriverPaymentPrefs(user.id, {
                  acceptsCash: nextVal,
                  hasCardMachine: driverHasCardMachine,
                  pixKey: driverPixKey.trim()
                });
              }}
              className={`driver-payment-card ${driverAcceptsCash ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem' }}>💵</span>
                <div>
                  <strong style={{ fontSize: '0.95rem', display: 'block' }}>
                    Aceito receber corridas em Dinheiro
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    O passageiro paga o valor total em dinheiro diretamente a você no desembarque.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={driverAcceptsCash}
                onChange={() => {}}
                style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>

            {/* Opção 2: Maquininha Própria */}
            <div
              onClick={() => {
                const nextVal = !driverHasCardMachine;
                setDriverHasCardMachine(nextVal);
                dbUpdateDriverPaymentPrefs(user.id, {
                  acceptsCash: driverAcceptsCash,
                  hasCardMachine: nextVal,
                  pixKey: driverPixKey.trim()
                });
              }}
              className={`driver-payment-card ${driverHasCardMachine ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem' }}>📱</span>
                <div>
                  <strong style={{ fontSize: '0.95rem', display: 'block' }}>
                    Possuo maquininha própria de cartão
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Permite aceitar passageiros que optam por pagar via cartão na sua maquininha física.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={driverHasCardMachine}
                onChange={() => {}}
                style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
              />
            </div>

            {/* Opção 3: Chave Pix */}
            <div className="driver-pix-card">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>
                <span>🔑</span>
                <span>Minha Chave Pix (para conferência e repasses da plataforma):</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="CPF, E-mail, Celular ou Chave Aleatória"
                value={driverPixKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setDriverPixKey(val);
                  dbUpdateDriverPaymentPrefs(user.id, {
                    acceptsCash: driverAcceptsCash,
                    hasCardMachine: driverHasCardMachine,
                    pixKey: val.trim()
                  });
                }}
                style={{ width: '100%', padding: '12px 14px', fontSize: '0.9rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Utilizada para repasses rápidos das corridas quitadas pelo passageiro via Cartão Online ou Pix no aplicativo.
              </span>
            </div>

            {payPrefsSavedNotice && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#10b981',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                Preferências de recebimento salvas com sucesso!
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-outline"
                style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>

              <button
                type="button"
                onClick={() => handleSavePaymentPrefs(true)}
                className="btn-outline"
                style={{ flex: 1, padding: '14px', fontSize: '0.9rem', borderColor: '#10b981', color: '#10b981' }}
                disabled={isSavingPayPrefs}
              >
                <Save size={16} /> {isSavingPayPrefs ? 'Salvando...' : 'Salvar Preferências'}
              </button>

              <button
                type="button"
                onClick={() => handleStep4Submit()}
                className="btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
              >
                <span>Avançar para Documentos & Fotos</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 5: DOCUMENTOS & FOTOS (CNH, CRLV, SELFIE)
      ======================================================== */}
      {step === 5 && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>5. Envio de Documentos e Biometria Facial</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Anexe fotos nítidas dos documentos para auditoria de segurança da plataforma.
            </p>
          </div>

          {isApproved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', borderRadius: '10px',
              background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#eab308', fontSize: '0.85rem'
            }}>
              <Lock size={18} style={{ flexShrink: 0 }} />
              <span>
                <strong>Documentos Homologados e Protegidos:</strong> Seus documentos foram validados e aprovados pelo administrador e não podem ser alterados ou substituídos diretamente. Caso precise atualizar CNH ou CRLV, solicite alteração ao suporte/administrador.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Foto da CNH */}
            <div className={`driver-doc-card ${cnhUrl ? 'attached' : ''}`}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.95rem' }}>🪪 Foto da CNH Aberta</strong>
                  {cnhUrl ? (
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>✅ Anexada</span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>* Obrigatório</span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {cnhFileName || 'Foto nítida da CNH aberta com EAR'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {cnhUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ title: 'Foto da CNH', url: cnhUrl })}
                    className="btn-outline"
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    <Eye size={13} /> Ver Documento
                  </button>
                )}
                {!isApproved && (
                  <label className="btn-primary" style={{ fontSize: '0.75rem', padding: '8px 14px', cursor: 'pointer' }}>
                    <UploadCloud size={14} /> {cnhUrl ? 'Trocar Foto' : 'Anexar CNH'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setCnhFileName, setCnhUrl)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 2. Foto do CRLV */}
            <div className={`driver-doc-card ${crlvUrl ? 'attached' : ''}`}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.95rem' }}>🚗 Foto do Documento do Veículo (CRLV)</strong>
                  {crlvUrl ? (
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>✅ Anexado</span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>* Obrigatório</span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {crlvFileName || `Documento do carro (Placa: ${vehiclePlate})`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {crlvUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ title: 'Documento do Veículo (CRLV)', url: crlvUrl })}
                    className="btn-outline"
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    <Eye size={13} /> Ver Documento
                  </button>
                )}
                {!isApproved && (
                  <label className="btn-primary" style={{ fontSize: '0.75rem', padding: '8px 14px', cursor: 'pointer' }}>
                    <UploadCloud size={14} /> {crlvUrl ? 'Trocar Doc' : 'Anexar CRLV'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, setCrlvFileName, setCrlvUrl)}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 3. Selfie de Identificação / Câmera ao Vivo */}
            <div className={`driver-doc-card ${selfieUrl ? 'attached' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.95rem' }}>🤳 Selfie de Identificação Facial</strong>
                    {selfieUrl ? (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>✅ Foto Pronta</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>* Obrigatório</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {selfieFileName || 'Foto nítida do seu rosto em local bem iluminado'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selfieUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'Selfie de Identificação', url: selfieUrl })}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                      <Eye size={13} /> Ver Selfie
                    </button>
                  )}

                  {!isApproved && !isCameraOpen && (
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', borderColor: '#6366f1', color: '#818cf8' }}
                    >
                      <Camera size={14} /> Tirar Foto Agora
                    </button>
                  )}

                  {!isApproved && (
                    <label className="btn-primary" style={{ fontSize: '0.75rem', padding: '8px 14px', cursor: 'pointer' }}>
                      <UploadCloud size={14} /> {selfieUrl ? 'Trocar Foto' : 'Carregar dos Arquivos'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setSelfieFileName, setSelfieUrl)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Prévia da Câmera ao Vivo */}
              {!isApproved && isCameraOpen && (
                <div style={{
                  background: '#000',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxWidth: '380px', borderRadius: '8px', transform: 'scaleX(-1)' }}
                  />
                  {cameraError && <span style={{ fontSize: '0.75rem', color: '#f87171' }}>{cameraError}</span>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      className="btn-success"
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                    >
                      <Camera size={16} /> Capturar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="btn-outline"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="btn-outline"
              style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            {isApproved ? (
              <button
                type="button"
                onClick={() => setStep(6)}
                className="btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
              >
                <span>Avançar para Status de Homologação</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStep5Submit}
                disabled={isSaving || !cnhUrl || !crlvUrl || !selfieUrl}
                className="btn-success"
                style={{
                  flex: 2,
                  padding: '14px',
                  fontSize: '0.95rem',
                  opacity: (!cnhUrl || !crlvUrl || !selfieUrl) ? 0.6 : 1
                }}
              >
                <CheckCircle2 size={18} />
                <span>{isSaving ? 'Enviando ao Banco...' : 'Enviar Documentos para Homologação'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 6: STATUS DE HOMOLOGAÇÃO & REVISÃO
      ======================================================== */}
      {step === 6 && (
        <div className="glass-panel" style={{ padding: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
          
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: verificationStatus === 'approved' 
              ? 'rgba(16, 185, 129, 0.2)' 
              : 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: verificationStatus === 'approved' ? '#10b981' : '#f59e0b',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
          }}>
            {verificationStatus === 'approved' ? <CheckCircle2 size={36} /> : <ShieldCheck size={36} />}
          </div>

          <div>
            <h3 className="driver-step-title" style={{ fontSize: '1.4rem' }}>
              {verificationStatus === 'approved' 
                ? 'Cadastro Homologado & Ativo!' 
                : 'Documentação em Análise'}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '520px' }}>
              {verificationStatus === 'approved'
                ? 'Parabéns! Seu perfil e veículo foram aprovados e você já pode ficar online para aceitar corridas.'
                : 'Seus dados e documentos (CNH, CRLV, Selfie) foram gravados no sistema e estão sob análise do administrador.'}
            </p>
          </div>

          {/* Resumo do Veículo e Comodidades */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '16px',
            width: '100%',
            maxWidth: '520px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem' }}>{vehicleBrand} {vehicleModel} ({vehicleYear})</strong>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1' }}>
                Placa: {vehiclePlate}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Categoria: <strong>{categoriesList.find(c => c.id === vehicleCategory)?.name || vehicleCategory}</strong> • Cor: {vehicleColor}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {selectedAmenities
                .filter(a => !AVAILABLE_AMENITIES.some(m => m.id === a))
                .map(a => (
                  <span key={a} style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                    ✓ {a}
                  </span>
                ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '520px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-outline"
              style={{ flex: 1, padding: '12px' }}
            >
              <Edit3 size={15} /> {isApproved ? 'Ver Cadastro / Comodidades' : 'Editar Dados'}
            </button>

            {verificationStatus === 'approved' ? (
              <button
                type="button"
                onClick={() => {
                  const profile: DriverProfile = {
                    id: 'driver_' + user.id,
                    userId: user.id,
                    fullName,
                    driverName: fullName,
                    cpf,
                    phone,
                    cnhNumber,
                    cnhCategory,
                    vehicleBrand,
                    vehicleModel,
                    vehicleYear,
                    vehiclePlate,
                    vehicleColor,
                    vehicleCategory,
                    amenities: selectedAmenities,
                    bio,
                    languages: ['Português'],
                    cnhUrl,
                    crlvUrl,
                    selfieUrl,
                    verificationStatus: 'approved',
                    rating: 5.0,
                    totalRides: 0
                  };
                  onComplete(profile);
                }}
                className="btn-success"
                style={{ flex: 1, padding: '12px' }}
              >
                Acessar Painel do Motorista →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApproveImmediate}
                className="btn-primary"
                title="Aprovação imediata para testes e demonstração"
                style={{ flex: 1, padding: '12px' }}
              >
                ⚡ Homologar Agora (Aprovação Demo)
              </button>
            )}
          </div>

        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE DOCUMENTO */}
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
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <strong style={{ fontSize: '1rem', color: '#fff' }}>{previewDoc.title}</strong>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', background: '#0b0f19' }}>
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SOLICITAÇÃO DE ALTERAÇÃO DE DADOS */}
      {showChangeRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0d1527',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '24px',
            padding: '28px 24px',
            maxWidth: '500px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  📝 Solicitar Alteração de Dados
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Informe quais dados precisam ser alterados. O administrador irá avaliar e atualizar seu cadastro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeRequest(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {changeRequestSent ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '14px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 700, color: '#10b981', margin: 0 }}>Solicitação enviada!</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  O administrador foi notificado e entrará em contato em breve.
                </p>
                <button
                  type="button"
                  onClick={() => setShowChangeRequest(false)}
                  className="btn-primary"
                  style={{ marginTop: '16px', padding: '8px 24px', fontSize: '0.85rem' }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={changeRequestText}
                  onChange={e => setChangeRequestText(e.target.value)}
                  placeholder="Descreva quais dados precisam ser alterados e o motivo. Ex: Troca de veículo — novo modelo Toyota Corolla 2027, placa XYZ-1234."
                  style={{
                    width: '100%',
                    minHeight: '130px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowChangeRequest(false)}
                    className="btn-outline"
                    style={{ flex: 1, padding: '10px', fontSize: '0.85rem', justifyContent: 'center' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!changeRequestText.trim() || changeRequestText.trim().length < 15}
                    onClick={() => {
                      // Salvar solicitação no localStorage para o admin visualizar
                      const requests = JSON.parse(localStorage.getItem('drivehora_change_requests') || '[]');
                      requests.push({
                        driverId: user.id,
                        driverName: fullName || user.fullName,
                        driverEmail: user.email,
                        message: changeRequestText.trim(),
                        createdAt: new Date().toISOString(),
                        status: 'pending'
                      });
                      localStorage.setItem('drivehora_change_requests', JSON.stringify(requests));
                      setChangeRequestSent(true);
                    }}
                    className="btn-primary"
                    style={{
                      flex: 2, padding: '10px', fontSize: '0.85rem',
                      justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px',
                      opacity: changeRequestText.trim().length >= 15 ? 1 : 0.5
                    }}
                  >
                    <Send size={15} />
                    Enviar Solicitação
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

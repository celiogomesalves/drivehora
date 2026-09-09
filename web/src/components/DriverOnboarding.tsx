import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile, DriverProfile, DriverVerificationStatus } from '../types/auth';
import { 
  ShieldCheck, Camera, CheckCircle2, 
  UploadCloud, Check, AlertCircle, Eye, Database, Edit3, X,
  ArrowRight, ArrowLeft, Lock, Send, MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatPhone, formatCpf, formatPlate, validateCpf, validateCnh, validatePlate, validatePhone } from '../utils/formatters';
import { dbSaveDriverProfile, dbCheckSupabaseStatus } from '../services/dbService';
import { getSystemSettings, type VehicleCategoryConfig } from '../services/settingsService';

interface DriverOnboardingProps {
  user: UserProfile;
  initialProfile?: DriverProfile | null;
  onComplete: (driverProfile: DriverProfile) => void;
  onOpenSupabaseConfig?: () => void;
}

// Lista de comodidades padrão com ícones e descrições
const AVAILABLE_AMENITIES = [
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
  onComplete,
  onOpenSupabaseConfig 
}) => {
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
    initialProfile?.verificationStatus === 'under_review' ? 5 : draft?.step || 1
  );
  
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

  const toggleAmenity = (label: string) => {
    setSelectedAmenities(prev => 
      prev.includes(label) ? prev.filter(a => a !== label) : [...prev, label]
    );
  };

  // Validadores de Etapas
  const handleStep1Submit = (e: React.FormEvent) => {
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
    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
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
    setStep(3);
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!bio.trim() || bio.trim().length < 15) {
      setErrorMessage('Por favor, escreva uma breve descrição sobre seu perfil profissional (mínimo 15 caracteres).');
      return;
    }
    setStep(4);
  };

  const handleStep4Submit = async () => {
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
      setStep(5);
    } catch (err: any) {
      setIsDbError(true);
      setErrorMessage(`Erro ao salvar: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveToDatabase = async (status: DriverVerificationStatus): Promise<{ success: boolean; error?: string }> => {
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
      alert(`Falha ao aprovar: ${res.error}`);
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
                Seus dados são bloqueados após a aprovação. Para alterações, solicite ao administrador.
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

      {/* HEADER DE ETAPAS — GRADE RESPONSIVA (nunca oculta abas) */}
      <div className="glass-panel" style={{ padding: '12px 16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '6px'
        }}>
          {[
            { num: 1, label: 'Identificação & CNH', short: 'Identificação' },
            { num: 2, label: 'Veículo & Categoria', short: 'Veículo' },
            { num: 3, label: 'Comodidades & Perfil', short: 'Comodidades' },
            { num: 4, label: 'Documentos & Fotos', short: 'Documentos' },
            { num: 5, label: 'Homologação', short: 'Homologação' }
          ].map(s => {
            const isActive = step === s.num;
            const isDone = step > s.num || isApproved;
            const canClick = step > s.num || verificationStatus === 'under_review' || isApproved;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => { if (canClick) setStep(s.num); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 6px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid #6366f1' : isDone ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-subtle)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.2))'
                    : isDone
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(255, 255, 255, 0.02)',
                  color: isActive ? '#fff' : isDone ? '#10b981' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: canClick ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  minWidth: 0
                }}
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

            {!isApproved && (
              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', marginTop: '6px' }}
              >
                <span>Avançar para Dados do Veículo</span>
                <ArrowRight size={18} />
              </button>
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

          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Seletor de Categoria com Cards Visuais */}
            <div className="input-group">
              <label>Categoria de Serviço do Veículo *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                {categoriesList.map(cat => {
                  const isSelected = vehicleCategory === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => setVehicleCategory(cat.id)}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #6366f1' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                        {isSelected && <Check size={16} color="#818cf8" />}
                      </div>
                      <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{cat.name}</strong>
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
                />
              </div>

              <div className="input-group">
                <label>Cor Predominante *</label>
                <select
                  className="select-field"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
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
                type="submit"
                className="btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
              >
                <span>Avançar para Comodidades</span>
                <ArrowRight size={18} />
              </button>
            </div>
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

          <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Lista de Comodidades Interativa */}
            <div className="input-group">
              <label>Comodidades Disponíveis no seu Carro (Selecione todas que se aplicam):</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {AVAILABLE_AMENITIES.map(amenity => {
                  const isChecked = selectedAmenities.includes(amenity.label);

                  return (
                    <div
                      key={amenity.id}
                      onClick={() => toggleAmenity(amenity.label)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                        border: isChecked ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{amenity.icon}</span>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block' }}>{amenity.label}</strong>
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-outline"
                style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '0.95rem' }}
              >
                <span>Avançar para Documentos & Fotos</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          ABA 4: DOCUMENTOS & FOTOS (CNH, CRLV, SELFIE)
      ======================================================== */}
      {step === 4 && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>4. Envio de Documentos e Biometria Facial</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Anexe fotos nítidas dos documentos para auditoria de segurança da plataforma.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Foto da CNH */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: cnhUrl ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>🪪 Foto da CNH Aberta</strong>
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
                    <Eye size={13} /> Ver
                  </button>
                )}
                <label className="btn-primary" style={{ fontSize: '0.75rem', padding: '8px 14px', cursor: 'pointer' }}>
                  <UploadCloud size={14} /> {cnhUrl ? 'Trocar Foto' : 'Anexar CNH'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setCnhFileName, setCnhUrl)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* 2. Foto do CRLV */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: crlvUrl ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>🚗 Foto do Documento do Veículo (CRLV)</strong>
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
                    <Eye size={13} /> Ver
                  </button>
                )}
                <label className="btn-primary" style={{ fontSize: '0.75rem', padding: '8px 14px', cursor: 'pointer' }}>
                  <UploadCloud size={14} /> {crlvUrl ? 'Trocar Doc' : 'Anexar CRLV'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileUpload(e, setCrlvFileName, setCrlvUrl)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* 3. Selfie de Identificação / Câmera ao Vivo */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: selfieUrl ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>🤳 Selfie de Identificação Facial</strong>
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

                  {!isCameraOpen && (
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', borderColor: '#6366f1', color: '#818cf8' }}
                    >
                      <Camera size={14} /> Tirar Foto Agora
                    </button>
                  )}

                  <label className="btn-primary" style={{ fontSize: '0.75rem', padding: '8px 14px', cursor: 'pointer' }}>
                    <UploadCloud size={14} /> {selfieUrl ? 'Trocar Foto' : 'Carregar dos Arquivos'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setSelfieFileName, setSelfieUrl)}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Prévia da Câmera ao Vivo */}
              {isCameraOpen && (
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
              onClick={() => setStep(3)}
              className="btn-outline"
              style={{ flex: 1, padding: '14px', fontSize: '0.9rem' }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              type="button"
              onClick={handleStep4Submit}
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
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 5: STATUS DE HOMOLOGAÇÃO & REVISÃO
      ======================================================== */}
      {step === 5 && (
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
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
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
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{vehicleBrand} {vehicleModel} ({vehicleYear})</strong>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1' }}>
                Placa: {vehiclePlate}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Categoria: <strong>{categoriesList.find(c => c.id === vehicleCategory)?.name || vehicleCategory}</strong> • Cor: {vehicleColor}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {selectedAmenities.map(a => (
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
              <Edit3 size={15} /> Editar Dados
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

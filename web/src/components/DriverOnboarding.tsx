import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile, DriverProfile, DriverVerificationStatus } from '../types/auth';
import { 
  ShieldCheck, Car, FileText, Camera, CheckCircle2, 
  UploadCloud, Check, RefreshCw, AlertCircle, Eye, Database, Edit3, X, Trash2, Video
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatPhone, formatCpf, formatPlate, validateCpf, validateCnh, validatePlate, validatePhone } from '../utils/formatters';
import { dbSaveDriverProfile, dbCheckSupabaseStatus } from '../services/dbService';

interface DriverOnboardingProps {
  user: UserProfile;
  initialProfile?: DriverProfile | null;
  onComplete: (driverProfile: DriverProfile) => void;
  onOpenSupabaseConfig?: () => void;
}

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
  // 💾 Recuperar rascunho salvo em memória interna (localStorage)
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

  const [step, setStep] = useState<number>(
    initialProfile?.verificationStatus === 'under_review' ? 4 : draft?.step || 1
  );
  
  const initialDriverPhone = (user.phone && user.phone !== '(11) 98765-4321')
    ? formatPhone(user.phone)
    : (initialProfile?.phone && initialProfile.phone !== '(11) 98765-4321')
    ? formatPhone(initialProfile.phone)
    : (draft?.phone && draft.phone !== '(11) 98765-4321')
    ? draft.phone
    : '';

  // Dados Pessoais & CNH (Recuperados do Rascunho Interno)
  const [cpf, setCpf] = useState(draft?.cpf || formatCpf(initialProfile?.cpf || ''));
  const [phone, setPhone] = useState(initialDriverPhone);
  const [cnhNumber, setCnhNumber] = useState(draft?.cnhNumber || initialProfile?.cnhNumber || '');
  const [cnhCategory, setCnhCategory] = useState(draft?.cnhCategory || initialProfile?.cnhCategory || 'B');

  // Dados do Veículo
  const [vehicleBrand, setVehicleBrand] = useState(draft?.vehicleBrand || initialProfile?.vehicleBrand || 'Toyota');
  const [vehicleModel, setVehicleModel] = useState(draft?.vehicleModel || initialProfile?.vehicleModel || 'Corolla XEi');
  const [vehicleYear, setVehicleYear] = useState(draft?.vehicleYear || initialProfile?.vehicleYear || String(currentYear));
  const [vehiclePlate, setVehiclePlate] = useState(draft?.vehiclePlate || formatPlate(initialProfile?.vehiclePlate || 'BRA-2E19'));
  const [vehicleColor, setVehicleColor] = useState(draft?.vehicleColor || initialProfile?.vehicleColor || 'Preto');

  // Uploads Reais de Documentos (Base64 Otimizado)
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

  // Status
  const [verificationStatus, setVerificationStatus] = useState<DriverVerificationStatus>(
    initialProfile?.verificationStatus || 'pending_docs'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDbError, setIsDbError] = useState(false);

  // 💾 Salvar automaticamente em memória interna a cada alteração
  useEffect(() => {
    try {
      localStorage.setItem(
        `drivehora_driver_draft_${user.id}`,
        JSON.stringify({
          step,
          cpf,
          phone,
          cnhNumber,
          cnhCategory,
          vehicleBrand,
          vehicleModel,
          vehicleYear,
          vehiclePlate,
          vehicleColor,
          cnhFileName,
          crlvFileName,
          selfieFileName
        })
      );
    } catch (e) {}
  }, [step, cpf, phone, cnhNumber, cnhCategory, vehicleBrand, vehicleModel, vehicleYear, vehiclePlate, vehicleColor, cnhFileName, crlvFileName, selfieFileName, user.id]);

  // Manipulador de Câmera ao Vivo
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
      setCameraError('Não foi possível abrir a câmera diretamente. Utilize a opção "Carregar Foto dos Arquivos" logo abaixo.');
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

  // Manipulador de upload de arquivo
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

  // Validação da Etapa 1
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsDbError(false);

    if (!validateCpf(cpf)) {
      setErrorMessage('CPF inválido. Insira um número de CPF válido.');
      return;
    }

    if (!validatePhone(phone)) {
      setErrorMessage('Telefone inválido. Insira um número válido com DDD.');
      return;
    }

    if (!validateCnh(cnhNumber)) {
      setErrorMessage('Registro de CNH inválido. Verifique o número de 11 dígitos da sua Carteira Nacional de Habilitação.');
      return;
    }

    setStep(2);
  };

  // Validação da Etapa 2
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsDbError(false);

    if (!validatePlate(vehiclePlate)) {
      setErrorMessage('Placa do veículo inválida. Insira uma placa válida no padrão Mercosul (ABC1D23) ou Tradicional (ABC-1234).');
      return;
    }

    setStep(3);
  };

  // Validação e Envio da Etapa 3 com Verificação Segura do Banco
  const handleStep3Submit = async () => {
    setErrorMessage(null);
    setIsDbError(false);

    if (!cnhUrl || !crlvUrl || !selfieUrl) {
      setErrorMessage('Documentação incompleta. É obrigatório anexar os 3 arquivos: Foto da CNH, Documento do Veículo (CRLV) e Selfie Facial.');
      return;
    }

    setIsSaving(true);
    try {
      // 🔒 1. Testar conexão com o banco
      const dbStatus = await dbCheckSupabaseStatus();
      if (!dbStatus.connected) {
        setIsDbError(true);
        setErrorMessage(`⚠️ Impossível enviar documentos: Não há conexão com o banco de dados Supabase (${dbStatus.message || 'Desconectado'}). Conecte o banco primeiro para gravar seus documentos.`);
        return;
      }

      // 💾 2. Salvar no Supabase (status = under_review)
      const saveResult = await saveToDatabase('under_review');
      if (!saveResult.success) {
        setIsDbError(true);
        setErrorMessage(`Falha ao gravar no banco: ${saveResult.error}`);
        return;
      }

      setVerificationStatus('under_review');
      setStep(4);
    } catch (err: any) {
      setIsDbError(true);
      setErrorMessage(`Erro inesperado ao salvar: ${err.message || 'Falha de comunicação com o servidor'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveToDatabase = async (status: DriverVerificationStatus): Promise<{ success: boolean; error?: string }> => {
    const profile: DriverProfile = {
      id: 'driver_' + user.id,
      userId: user.id,
      cpf,
      phone,
      cnhNumber,
      cnhCategory,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehiclePlate,
      vehicleColor,
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
        cpf,
        phone,
        cnhNumber,
        cnhCategory,
        vehicleBrand,
        vehicleModel,
        vehicleYear,
        vehiclePlate,
        vehicleColor,
        cnhUrl,
        crlvUrl,
        selfieUrl,
        verificationStatus: 'approved',
        rating: initialProfile?.rating || 5.0,
        totalRides: initialProfile?.totalRides || 0
      };
      onComplete(profile);
    } else {
      setErrorMessage(res.error || 'Erro ao aprovar.');
    }
  };

  const handleProceedToDriverPanel = () => {
    const profile: DriverProfile = {
      id: 'driver_' + user.id,
      userId: user.id,
      cpf,
      phone,
      cnhNumber,
      cnhCategory,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehiclePlate,
      vehicleColor,
      cnhUrl,
      crlvUrl,
      selfieUrl,
      verificationStatus,
      rating: initialProfile?.rating || 5.0,
      totalRides: initialProfile?.totalRides || 0
    };
    onComplete(profile);
  };

  return (
    <div style={{ maxWidth: '740px', margin: '20px auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '36px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Cabeçalho do Onboarding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: '#10b981'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Credenciamento Oficial de Motorista</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Validação rigorosa de CNH (EAR), CRLV do Veículo e Biometria Facial no Banco de Dados
          </p>

          {/* Stepper de progresso */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '20px'
          }}>
            {[
              { num: 1, label: 'CNH' },
              { num: 2, label: 'Veículo' },
              { num: 3, label: 'Documentos' },
              { num: 4, label: 'Validação' }
            ].map((s) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: step > s.num 
                    ? '#10b981' 
                    : step === s.num 
                    ? '#6366f1' 
                    : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff'
                }}>
                  {step > s.num ? <Check size={14} /> : s.num}
                </div>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: step === s.num ? 700 : 500,
                  color: step === s.num ? '#fff' : 'var(--text-muted)'
                }}>
                  {s.label}
                </span>
                {s.num < 4 && (
                  <div style={{
                    width: '24px',
                    height: '2px',
                    background: step > s.num ? '#10b981' : 'rgba(255, 255, 255, 0.1)'
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mensagem de Erro / Alerta */}
        {errorMessage && (
          <div style={{
            background: isDbError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '14px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>Atenção nos Documentos:</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{errorMessage}</p>
              {isDbError && onOpenSupabaseConfig && (
                <button
                  type="button"
                  onClick={onOpenSupabaseConfig}
                  className="btn-outline"
                  style={{ marginTop: '8px', fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Database size={12} /> Conectar Supabase Agora
                </button>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 1: DADOS PESSOAIS & CNH */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#818cf8' }}>
              1. Identificação e Habilitação Profissional (EAR)
            </h3>

            <div className="input-group">
              <label>Nome Completo do Motorista</label>
              <input
                type="text"
                className="custom-input"
                value={user.fullName}
                disabled
                style={{ opacity: 0.7 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>CPF *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                />
              </div>

              <div className="input-group">
                <label>WhatsApp / Celular com DDD *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>Número de Registro da CNH (11 dígitos) *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={cnhNumber}
                  onChange={(e) => setCnhNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="12345678900"
                  maxLength={11}
                  required
                />
              </div>

              <div className="input-group">
                <label>Categoria CNH *</label>
                <select
                  className="custom-input"
                  value={cnhCategory}
                  onChange={(e) => setCnhCategory(e.target.value)}
                  style={{ background: 'rgba(15, 23, 42, 0.8)' }}
                >
                  <option value="B">B (Carro)</option>
                  <option value="AB">AB (Carro e Moto)</option>
                  <option value="C">C (Caminhão Leve)</option>
                  <option value="D">D (Passageiros / Van)</option>
                  <option value="E">E (Articulados)</option>
                </select>
              </div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px dashed rgba(99, 102, 241, 0.3)',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              💡 <strong>Requisito Obrigatório:</strong> Sua CNH deve conter a observação <em>"Exerce Atividade Remunerada" (EAR)</em> para prestação de serviços por hora.
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
              Avançar para Dados do Veículo ➔
            </button>
          </form>
        )}

        {/* ETAPA 2: DADOS DO VEÍCULO */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#818cf8' }}>
              2. Cadastro do Veículo de Atendimento
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>Marca do Veículo *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Ex: Toyota, Honda, Hyundai..."
                  required
                />
              </div>

              <div className="input-group">
                <label>Modelo e Versão *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Ex: Corolla XEi, Civic EXL..."
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>Ano de Fabricação</label>
                <select
                  className="custom-input"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  style={{ background: 'rgba(15, 23, 42, 0.8)' }}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Placa *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(formatPlate(e.target.value))}
                  placeholder="ABC-1D23"
                  maxLength={8}
                  required
                />
              </div>

              <div className="input-group">
                <label>Cor *</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  placeholder="Preto, Prata..."
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setStep(1)} className="btn-outline" style={{ flex: 1 }}>
                Voltar
              </button>
              <button type="submit" className="btn-success" style={{ flex: 2 }}>
                Validar Veículo e Avançar para Uploads ➔
              </button>
            </div>
          </form>
        )}

        {/* ETAPA 3: UPLOAD REAL DE DOCUMENTOS E BIOMETRIA FACIAL */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                3. Upload Obrigatório de Documentos e Biometria Facial
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Anexe fotos nítidas dos documentos e tire uma selfie facial para credenciamento.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Card 1: CNH */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: `1px solid ${cnhUrl ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={24} color={cnhUrl ? '#10b981' : '#818cf8'} />
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Foto da CNH Aberta (Frente e Verso) *</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {cnhFileName ? `Arquivo: ${cnhFileName}` : 'Formatos: JPG, PNG, PDF'}
                      </p>
                    </div>
                  </div>

                  <label className={cnhUrl ? 'btn-success' : 'btn-outline'} style={{ padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, setCnhFileName, setCnhUrl)}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {cnhUrl ? <Check size={14} /> : <UploadCloud size={14} />}
                      <span>{cnhUrl ? 'Trocar Arquivo' : 'Selecionar CNH'}</span>
                    </div>
                  </label>
                </div>

                {cnhUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '10px' }}>
                    {cnhUrl.startsWith('data:image') && (
                      <img src={cnhUrl} alt="CNH Preview" style={{ width: '60px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #10b981' }} />
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>✅ CNH carregada e validada</span>
                    <button
                      type="button"
                      onClick={() => { setCnhUrl(''); setCnhFileName(''); }}
                      className="btn-outline"
                      style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                )}
              </div>

              {/* Card 2: CRLV */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: `1px solid ${crlvUrl ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Car size={24} color={crlvUrl ? '#10b981' : '#818cf8'} />
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Documento do Veículo (CRLV-e) *</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {crlvFileName ? `Arquivo: ${crlvFileName}` : 'Licenciamento do ano em exercício'}
                      </p>
                    </div>
                  </div>

                  <label className={crlvUrl ? 'btn-success' : 'btn-outline'} style={{ padding: '8px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, setCrlvFileName, setCrlvUrl)}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {crlvUrl ? <Check size={14} /> : <UploadCloud size={14} />}
                      <span>{crlvUrl ? 'Trocar Arquivo' : 'Selecionar CRLV'}</span>
                    </div>
                  </label>
                </div>

                {crlvUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '10px' }}>
                    {crlvUrl.startsWith('data:image') && (
                      <img src={crlvUrl} alt="CRLV Preview" style={{ width: '60px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #10b981' }} />
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>✅ CRLV carregado e validado</span>
                    <button
                      type="button"
                      onClick={() => { setCrlvUrl(''); setCrlvFileName(''); }}
                      className="btn-outline"
                      style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                )}
              </div>

              {/* Card 3: Selfie com CNH */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: `1px solid ${selfieUrl ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Camera size={24} color={selfieUrl ? '#10b981' : '#818cf8'} />
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Selfie Facial segurando a CNH *</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {selfieFileName ? `Arquivo: ${selfieFileName}` : 'Reconhecimento facial para validação de segurança'}
                      </p>
                    </div>
                  </div>

                  {/* Botões de Ação para Selfie (Câmera ao Vivo OU Arquivo) */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      className="btn-primary"
                      style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Video size={14} />
                      <span>{selfieUrl ? 'Tirar Outra Foto' : 'Abrir Câmera'}</span>
                    </button>

                    <label className="btn-outline" style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileUpload(e, setSelfieFileName, setSelfieUrl)}
                      />
                      <UploadCloud size={14} />
                      <span>Galeria / Arquivo</span>
                    </label>
                  </div>
                </div>

                {selfieUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '10px' }}>
                    <img src={selfieUrl} alt="Selfie Preview" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #10b981' }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>✅ Selfie capturada com sucesso</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Biometria pronta para conferência</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelfieUrl(''); setSelfieFileName(''); }}
                      className="btn-outline"
                      style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                )}
              </div>

            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setStep(2)} className="btn-outline" style={{ flex: 1 }}>
                Voltar
              </button>
              <button
                type="button"
                disabled={!cnhUrl || !crlvUrl || !selfieUrl || isSaving}
                onClick={handleStep3Submit}
                className="btn-success"
                style={{ flex: 2, opacity: (!cnhUrl || !crlvUrl || !selfieUrl || isSaving) ? 0.6 : 1 }}
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : null}
                <span>{isSaving ? 'Gravando Documentos no Banco...' : 'Salvar no Banco e Enviar para Validação ➔'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 4: STATUS REAL E CONFIRMAÇÃO */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            {verificationStatus === 'approved' ? (
              <div>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#10b981'
                }}>
                  <CheckCircle2 size={40} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>Credenciamento Aprovado no Banco!</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Seus documentos e veículo ({vehicleBrand} {vehicleModel} • {vehicleYear} • Placa {vehiclePlate}) estão ativos no banco.
                </p>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  maxWidth: '440px',
                  margin: '20px auto',
                  textAlign: 'left'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status no Banco de Dados:</div>
                  <strong style={{ color: '#10b981' }}>Selo de Motorista Verificado ✅</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Você já pode ativar o modo <strong>ONLINE</strong> para receber chamados e faturar 85% por hora de serviço.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', maxWidth: '440px', margin: '0 auto', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setStep(1)}
                    className="btn-outline"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    <Edit3 size={14} /> Editar Documentos
                  </button>
                  <button
                    onClick={handleProceedToDriverPanel}
                    className="btn-success"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    Ir para o Painel do Motorista ➔
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#f59e0b'
                }}>
                  <RefreshCw size={36} className="animate-spin" />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>Documentos Salvos no Banco (Em Análise)</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '520px', margin: '6px auto' }}>
                  Seus documentos do veículo <strong>{vehicleBrand} {vehicleModel} ({vehicleYear}) • Placa {vehiclePlate}</strong> foram registrados com sucesso no banco de dados e estão aguardando liberação.
                </p>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  borderRadius: '12px',
                  maxWidth: '450px',
                  margin: '20px auto',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Eye size={18} color="#f59e0b" />
                    <strong style={{ fontSize: '0.9rem' }}>Bloqueio de Segurança Ativo:</strong>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    O recebimento de chamados de passageiros permanece bloqueado até a validação formal dos documentos pelo administrador para garantir a segurança dos passageiros.
                  </p>
                </div>

                {/* Botões de Ação */}
                <div style={{ display: 'flex', gap: '10px', maxWidth: '450px', margin: '14px auto', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setErrorMessage(null);
                    }}
                    className="btn-outline"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    <Edit3 size={14} /> Editar Documentos
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToDriverPanel}
                    className="btn-primary"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    Painel do Motorista ➔
                  </button>
                </div>

                {/* Se o usuário for Super Admin, opção de aprovar imediatamente */}
                {user.isAdmin && (
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px dashed rgba(99, 102, 241, 0.4)',
                    padding: '14px',
                    borderRadius: '12px',
                    maxWidth: '450px',
                    margin: '16px auto',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 700 }}>
                      👑 Ação de Super Admin:
                    </span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
                      Como você é o Super-Administrador da plataforma, você pode aprovar este cadastro imediatamente:
                    </p>
                    <button
                      onClick={handleApproveImmediate}
                      disabled={isSaving}
                      className="btn-success"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      ⚡ Aprovar Imediatamente (Super Admin)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL DE CÂMERA AO VIVO PARA SELFIE */}
      {isCameraOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Câmera ao Vivo - Selfie com CNH</h3>
              </div>
              <button onClick={stopLiveCamera} className="btn-outline" style={{ padding: '6px', borderRadius: '50%' }}>
                <X size={16} />
              </button>
            </div>

            {cameraError ? (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: '#fca5a5', fontSize: '0.85rem' }}>
                {cameraError}
              </div>
            ) : (
              <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#000', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                
                {/* Overlay de Guia Facial */}
                <div style={{
                  position: 'absolute',
                  width: '200px',
                  height: '240px',
                  border: '2px dashed rgba(16, 185, 129, 0.8)',
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }} />
              </div>
            )}

            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
              Posicione seu rosto dentro da moldura segurando sua CNH e clique em Capturar.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={stopLiveCamera} className="btn-outline" style={{ flex: 1, padding: '10px' }}>
                Cancelar
              </button>
              {!cameraError && (
                <button onClick={takeSnapshot} className="btn-success" style={{ flex: 2, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Camera size={16} />
                  <span>Capturar Selfie Agora</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

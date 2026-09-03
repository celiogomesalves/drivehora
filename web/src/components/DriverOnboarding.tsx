import React, { useState } from 'react';
import type { UserProfile, DriverProfile, DriverVerificationStatus } from '../types/auth';
import { 
  ShieldCheck, Car, FileText, Camera, CheckCircle2, 
  UploadCloud, Check, RefreshCw, AlertCircle, Eye, Database, Edit3
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

export const DriverOnboarding: React.FC<DriverOnboardingProps> = ({ 
  user, 
  initialProfile, 
  onComplete,
  onOpenSupabaseConfig 
}) => {
  const [step, setStep] = useState<number>(initialProfile?.verificationStatus === 'under_review' ? 4 : 1);
  
  // Dados Pessoais & CNH
  const [cpf, setCpf] = useState(formatCpf(initialProfile?.cpf || ''));
  const [phone, setPhone] = useState(formatPhone(initialProfile?.phone || user.phone || ''));
  const [cnhNumber, setCnhNumber] = useState(initialProfile?.cnhNumber || '');
  const [cnhCategory, setCnhCategory] = useState(initialProfile?.cnhCategory || 'B');

  // Dados do Veículo (Dropdown de anos a partir de 2010)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear + 2 - 2010 }, (_, i) => String(currentYear + 1 - i));

  const [vehicleBrand, setVehicleBrand] = useState(initialProfile?.vehicleBrand || 'Toyota');
  const [vehicleModel, setVehicleModel] = useState(initialProfile?.vehicleModel || 'Corolla XEi');
  const [vehicleYear, setVehicleYear] = useState(initialProfile?.vehicleYear || String(currentYear));
  const [vehiclePlate, setVehiclePlate] = useState(formatPlate(initialProfile?.vehiclePlate || 'BRA-2E19'));
  const [vehicleColor, setVehicleColor] = useState(initialProfile?.vehicleColor || 'Preto');

  // Uploads Reais de Documentos (Base64 / Nome do Arquivo)
  const [cnhFileName, setCnhFileName] = useState<string>(initialProfile?.cnhUrl ? 'cnh_anexada.jpg' : '');
  const [cnhUrl, setCnhUrl] = useState<string>(initialProfile?.cnhUrl || '');

  const [crlvFileName, setCrlvFileName] = useState<string>(initialProfile?.crlvUrl ? 'crlv_anexado.jpg' : '');
  const [crlvUrl, setCrlvUrl] = useState<string>(initialProfile?.crlvUrl || '');

  const [selfieFileName, setSelfieFileName] = useState<string>(initialProfile?.selfieUrl ? 'selfie_biometria.jpg' : '');
  const [selfieUrl, setSelfieUrl] = useState<string>(initialProfile?.selfieUrl || '');

  // Status
  const [verificationStatus, setVerificationStatus] = useState<DriverVerificationStatus>(
    initialProfile?.verificationStatus || 'pending_docs'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDbError, setIsDbError] = useState(false);

  // Leitor de arquivo real para Base64
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFileName: (name: string) => void,
    setUrl: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('O arquivo selecionado é muito grande. O limite máximo é 10MB.');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
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

  // Validação e Envio da Etapa 3 com Verificação Obrigatória do Banco
  const handleStep3Submit = async () => {
    setErrorMessage(null);
    setIsDbError(false);

    if (!cnhUrl || !crlvUrl || !selfieUrl) {
      setErrorMessage('Documentação incompleta. É obrigatório anexar os 3 arquivos: Foto da CNH, Documento do Veículo (CRLV) e Selfie Facial.');
      return;
    }

    // 🔒 Verificação estrita de conexão com o Banco Supabase
    setIsSaving(true);
    const dbStatus = await dbCheckSupabaseStatus();
    if (!dbStatus.connected) {
      setIsSaving(false);
      setIsDbError(true);
      setErrorMessage(`⚠️ Impossível enviar documentos: Não há conexão com o banco de dados Supabase (${dbStatus.message || 'Desconectado'}). Conecte o banco primeiro para gravar seus documentos.`);
      return;
    }

    const saveResult = await handleFinishRegistration('under_review');
    setIsSaving(false);

    if (!saveResult.success) {
      setIsDbError(true);
      setErrorMessage(`Falha ao gravar no banco: ${saveResult.error}`);
      return;
    }

    setStep(4);
  };

  const handleFinishRegistration = async (status: DriverVerificationStatus): Promise<{ success: boolean; error?: string }> => {
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

    const res = await dbSaveDriverProfile(profile);
    if (res.success) {
      setVerificationStatus(status);
      onComplete(profile);
    }
    return res;
  };

  const handleApproveImmediate = async () => {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    await handleFinishRegistration('approved');
  };

  return (
    <div style={{ maxWidth: '720px', margin: '30px auto', width: '100%' }}>
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
                  background: step >= s.num ? 'var(--secondary-gradient)' : 'rgba(255, 255, 255, 0.08)',
                  color: '#fff'
                }}>
                  {s.num}
                </div>
                {s.num < 4 && <div style={{ width: '24px', height: '2px', background: step > s.num ? '#10b981' : 'var(--border-subtle)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Alerta de Erro de Validação ou Banco */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '14px 16px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>

            {isDbError && onOpenSupabaseConfig && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                <Database size={14} /> Conectar Banco
              </button>
            )}
          </div>
        )}

        {/* ETAPA 1: DADOS DA CNH */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>1. Dados Pessoais e CNH com Validação Oficial</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>CPF do Motorista</label>
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
                <label>Celular / WhatsApp</label>
                <input
                  type="tel"
                  className="custom-input"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
              <div className="input-group">
                <label>Número do Registro da CNH (11 dígitos)</label>
                <input
                  type="text"
                  className="custom-input"
                  value={cnhNumber}
                  onChange={(e) => setCnhNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="00000000000"
                  maxLength={11}
                  required
                />
              </div>

              <div className="input-group">
                <label>Categoria</label>
                <select
                  className="custom-input"
                  value={cnhCategory}
                  onChange={(e) => setCnhCategory(e.target.value)}
                >
                  <option value="B">B (Carro)</option>
                  <option value="AB">AB (Carro e Moto)</option>
                  <option value="C">C (Carga)</option>
                  <option value="D">D (Passageiros)</option>
                  <option value="E">E (Pesados)</option>
                </select>
              </div>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              color: '#d1fae5'
            }}>
              ℹ️ A CNH deve ser válida, autêntica e possuir a observação <strong>EAR (Exerce Atividade Remunerada)</strong>.
            </div>

            <button type="submit" className="btn-success" style={{ width: '100%', padding: '14px', marginTop: '8px' }}>
              Validar CNH e Avançar para Dados do Veículo ➔
            </button>
          </form>
        )}

        {/* ETAPA 2: DADOS DO VEÍCULO COM DROPDOWN DE ANOS (A PARTIR DE 2010) */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>2. Dados do Veículo</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>Marca do Veículo (Sugestões ou Digite Livremente)</label>
                <input
                  type="text"
                  list="popular-car-brands"
                  className="custom-input"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Selecione ou digite (ex: Toyota, BYD...)"
                  required
                />
                <datalist id="popular-car-brands">
                  {[
                    'Toyota', 'Honda', 'Volkswagen', 'Chevrolet', 'Hyundai', 
                    'Fiat', 'Jeep', 'Nissan', 'Renault', 'Ford', 
                    'BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'BYD', 
                    'GWM', 'Caoa Chery', 'Peugeot', 'Citroën', 'Kia', 
                    'Mitsubishi', 'Land Rover', 'Porsche', 'Ram', 'Lexus'
                  ].map(brand => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label>Modelo</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Ex: Corolla, Civic, HB20S"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {/* Dropdown de Ano de Fabricação a partir de 2010 */}
              <div className="input-group">
                <label>Ano de Fabricação</label>
                <select
                  className="custom-input"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  required
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Placa (Mercosul/Padrão)</label>
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
                <label>Cor</label>
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

        {/* ETAPA 3: UPLOAD REAL DE DOCUMENTOS & SELFIE COM BLOQUEIO DE BANCO */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
              3. Upload Obrigatório de Documentos e Biometria Facial
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Selecione arquivos reais (fotos nítidas em JPG/PNG ou PDF) do seu dispositivo:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Card CNH */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${cnhUrl ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={24} color={cnhUrl ? '#10b981' : '#818cf8'} />
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Foto da CNH Aberta (Frente e Verso) *</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {cnhFileName ? `Arquivo: ${cnhFileName}` : 'Formatos aceitos: JPG, PNG, PDF'}
                    </p>
                  </div>
                </div>

                <label className={cnhUrl ? 'btn-success' : 'btn-outline'} style={{ padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, setCnhFileName, setCnhUrl)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {cnhUrl ? <Check size={14} /> : <UploadCloud size={14} />}
                    <span>{cnhUrl ? 'Arquivo Carregado ✅' : 'Selecionar Arquivo'}</span>
                  </div>
                </label>
              </div>

              {/* Card CRLV */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${crlvUrl ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Car size={24} color={crlvUrl ? '#10b981' : '#818cf8'} />
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Documento do Veículo (CRLV-e) *</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {crlvFileName ? `Arquivo: ${crlvFileName}` : 'Licenciamento do ano em exercício'}
                    </p>
                  </div>
                </div>

                <label className={crlvUrl ? 'btn-success' : 'btn-outline'} style={{ padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, setCrlvFileName, setCrlvUrl)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {crlvUrl ? <Check size={14} /> : <UploadCloud size={14} />}
                    <span>{crlvUrl ? 'Arquivo Carregado ✅' : 'Selecionar Arquivo'}</span>
                  </div>
                </label>
              </div>

              {/* Card Selfie com CNH */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${selfieUrl ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Camera size={24} color={selfieUrl ? '#10b981' : '#818cf8'} />
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Selfie Facial segurando a CNH *</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {selfieFileName ? `Arquivo: ${selfieFileName}` : 'Reconhecimento facial com documento visível'}
                    </p>
                  </div>
                </div>

                <label className={selfieUrl ? 'btn-success' : 'btn-outline'} style={{ padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, setSelfieFileName, setSelfieUrl)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {selfieUrl ? <Check size={14} /> : <Camera size={14} />}
                    <span>{selfieUrl ? 'Foto Capturada ✅' : 'Tirar Foto / Carregar'}</span>
                  </div>
                </label>
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
                style={{ flex: 2, opacity: (!cnhUrl || !crlvUrl || !selfieUrl) ? 0.6 : 1 }}
              >
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : null}
                <span>{isSaving ? 'Gravando no Banco de Dados...' : 'Salvar no Banco e Enviar para Validação ➔'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 4: STATUS REAL E OPÇÃO DE ALTERAR/REENVIAR DOCUMENTOS */}
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
                  maxWidth: '400px',
                  margin: '20px auto',
                  textAlign: 'left'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status no Banco de Dados:</div>
                  <strong style={{ color: '#10b981' }}>Selo de Motorista Verificado ✅</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Você já pode ativar o modo <strong>ONLINE</strong> para receber chamados e faturar 85% por hora de serviço.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', maxWidth: '400px', margin: '0 auto', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setStep(1)}
                    className="btn-outline"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    <Edit3 size={14} /> Alterar / Reenviar Documentos
                  </button>
                  <button
                    onClick={() => handleFinishRegistration('approved')}
                    className="btn-success"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    Ir para o Painel do Motorista
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

                {/* Botão para Alterar / Reenviar Documentos */}
                <div style={{ maxWidth: '450px', margin: '14px auto' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setErrorMessage(null);
                    }}
                    className="btn-outline"
                    style={{ width: '100%', padding: '12px', fontSize: '0.85rem' }}
                  >
                    <Edit3 size={14} /> ✏️ Alterar / Reenviar Documentos ao Banco
                  </button>
                </div>

                {/* Se o usuário logado for Super Admin, ele pode simular aprovação para testes */}
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
    </div>
  );
};

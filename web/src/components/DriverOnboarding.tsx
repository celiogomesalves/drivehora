import React, { useState } from 'react';
import type { UserProfile, DriverProfile, DriverVerificationStatus } from '../types/auth';
import { 
  ShieldCheck, Car, FileText, Camera, CheckCircle2, 
  UploadCloud, Check, Sparkles, RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatPhone, formatCpf, formatPlate } from '../utils/formatters';

interface DriverOnboardingProps {
  user: UserProfile;
  initialProfile?: DriverProfile | null;
  onComplete: (driverProfile: DriverProfile) => void;
}

export const DriverOnboarding: React.FC<DriverOnboardingProps> = ({ user, initialProfile, onComplete }) => {
  const [step, setStep] = useState<number>(initialProfile?.verificationStatus === 'under_review' ? 4 : 1);
  
  // Dados Pessoais & CNH
  const [cpf, setCpf] = useState(formatCpf(initialProfile?.cpf || ''));
  const [phone, setPhone] = useState(formatPhone(initialProfile?.phone || user.phone || ''));
  const [cnhNumber, setCnhNumber] = useState(initialProfile?.cnhNumber || '');
  const [cnhCategory, setCnhCategory] = useState(initialProfile?.cnhCategory || 'B');

  // Dados do Veículo
  const [vehicleBrand, setVehicleBrand] = useState(initialProfile?.vehicleBrand || 'Toyota');
  const [vehicleModel, setVehicleModel] = useState(initialProfile?.vehicleModel || 'Corolla XEi');
  const [vehicleYear, setVehicleYear] = useState(initialProfile?.vehicleYear || '2023');
  const [vehiclePlate, setVehiclePlate] = useState(formatPlate(initialProfile?.vehiclePlate || 'BRA-2E19'));
  const [vehicleColor, setVehicleColor] = useState(initialProfile?.vehicleColor || 'Preto');

  // Documentos
  const [cnhUploaded, setCnhUploaded] = useState(Boolean(initialProfile?.cnhUrl));
  const [crlvUploaded, setCrlvUploaded] = useState(Boolean(initialProfile?.crlvUrl));
  const [selfieUploaded, setSelfieUploaded] = useState(Boolean(initialProfile?.selfieUrl));

  // Status
  const [verificationStatus, setVerificationStatus] = useState<DriverVerificationStatus>(
    initialProfile?.verificationStatus || 'pending_docs'
  );

  const handleFinishRegistration = (status: DriverVerificationStatus) => {
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
      cnhUrl: cnhUploaded ? 'https://drivehora.app/docs/cnh_mock.jpg' : undefined,
      crlvUrl: crlvUploaded ? 'https://drivehora.app/docs/crlv_mock.jpg' : undefined,
      selfieUrl: selfieUploaded ? 'https://drivehora.app/docs/selfie_mock.jpg' : undefined,
      verificationStatus: status,
      rating: initialProfile?.rating || 5.0,
      totalRides: initialProfile?.totalRides || 0
    };

    localStorage.setItem(`drivehora_driver_profile_${user.id}`, JSON.stringify(profile));
    setVerificationStatus(status);
    onComplete(profile);
  };

  const handleApproveImmediate = () => {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    handleFinishRegistration('approved');
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '36px' }}>
        
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
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Credenciamento de Motorista</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Validação de CNH, Veículo e Biometria para segurança de todos
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

        {/* ETAPA 1: DADOS DA CNH */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>1. Dados Pessoais e CNH</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>CPF</label>
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
                <label>Número do Registro da CNH</label>
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
              ℹ️ A CNH deve possuir a observação <strong>EAR (Exerce Atividade Remunerada)</strong> para conformidade legal.
            </div>

            <button type="submit" className="btn-success" style={{ width: '100%', padding: '14px', marginTop: '8px' }}>
              Avançar para Dados do Veículo ➔
            </button>
          </form>
        )}

        {/* ETAPA 2: DADOS DO VEÍCULO */}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>2. Dados do Veículo</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>Marca</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Ex: Toyota, Honda, Hyundai"
                  required
                />
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
              <div className="input-group">
                <label>Ano</label>
                <input
                  type="text"
                  className="custom-input"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2023"
                  maxLength={4}
                  required
                />
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
                Avançar para Envio de Documentos ➔
              </button>
            </div>
          </form>
        )}

        {/* ETAPA 3: UPLOAD DE DOCUMENTOS & SELFIE */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>3. Envio de Documentos e Validação Biométrica</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Card CNH */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${cnhUploaded ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={24} color={cnhUploaded ? '#10b981' : '#818cf8'} />
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Foto da CNH (Frente e Verso)</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Documento aberto e legível</p>
                  </div>
                </div>
                <button
                  onClick={() => setCnhUploaded(!cnhUploaded)}
                  className={cnhUploaded ? 'btn-success' : 'btn-outline'}
                  style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                >
                  {cnhUploaded ? <Check size={14} /> : <UploadCloud size={14} />}
                  <span>{cnhUploaded ? 'Anexado ✅' : 'Anexar'}</span>
                </button>
              </div>

              {/* Card CRLV */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${crlvUploaded ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Car size={24} color={crlvUploaded ? '#10b981' : '#818cf8'} />
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Documento do Veículo (CRLV-e)</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Licenciamento do ano em exercício</p>
                  </div>
                </div>
                <button
                  onClick={() => setCrlvUploaded(!crlvUploaded)}
                  className={crlvUploaded ? 'btn-success' : 'btn-outline'}
                  style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                >
                  {crlvUploaded ? <Check size={14} /> : <UploadCloud size={14} />}
                  <span>{crlvUploaded ? 'Anexado ✅' : 'Anexar'}</span>
                </button>
              </div>

              {/* Card Selfie com CNH */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${selfieUploaded ? '#10b981' : 'var(--border-subtle)'}`,
                padding: '16px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Camera size={24} color={selfieUploaded ? '#10b981' : '#818cf8'} />
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>Selfie com a CNH em mãos</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reconhecimento facial antifraude</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelfieUploaded(!selfieUploaded)}
                  className={selfieUploaded ? 'btn-success' : 'btn-outline'}
                  style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                >
                  {selfieUploaded ? <Check size={14} /> : <Camera size={14} />}
                  <span>{selfieUploaded ? 'Capturada ✅' : 'Tirar Foto'}</span>
                </button>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setStep(2)} className="btn-outline" style={{ flex: 1 }}>
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(4);
                  handleFinishRegistration('under_review');
                }}
                className="btn-success"
                style={{ flex: 2 }}
              >
                Enviar Documentos para Análise ➔
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 4: STATUS DA ANÁLISE */}
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
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>Credenciamento Aprovado!</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Seus documentos e veículo ({vehicleBrand} {vehicleModel} • Placa {vehiclePlate}) foram aprovados com sucesso.
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
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status da Conta:</div>
                  <strong style={{ color: '#10b981' }}>Selo de Motorista Verificado ✅</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Você já pode ativar o modo <strong>ONLINE</strong> para receber chamados e faturar 85% por hora de serviço.
                  </div>
                </div>

                <button
                  onClick={() => handleFinishRegistration('approved')}
                  className="btn-success"
                  style={{ width: '100%', maxWidth: '350px', padding: '14px', fontSize: '1rem' }}
                >
                  Ir para o Painel do Motorista
                </button>
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
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>Documentos em Análise</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '480px', margin: '6px auto' }}>
                  Recebemos os dados do seu veículo <strong>{vehicleBrand} {vehicleModel}</strong> e seus documentos. Nossa equipe está validando as informações.
                </p>

                {/* Caixa de simulação para testes imediatos */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px dashed rgba(99, 102, 241, 0.4)',
                  padding: '18px',
                  borderRadius: '14px',
                  margin: '24px 0',
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#818cf8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                    <Sparkles size={18} />
                    <span>Ambiente de Demonstração & Testes</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Para testar o fluxo de atendimento sem esperar a validação manual de retaguarda, clique no botão abaixo para aprovar imediatamente:
                  </p>
                  <button
                    onClick={handleApproveImmediate}
                    className="btn-success"
                    style={{ padding: '12px 24px', fontSize: '0.9rem' }}
                  >
                    ⚡ Simular Aprovação Imediata (Admin)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

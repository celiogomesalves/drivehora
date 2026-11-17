import React, { useState, useEffect } from 'react';
import { appwriteDatabases, APPWRITE_DATABASE_ID, APPWRITE_COLLECTIONS } from '../appwrite';
import { ID, Query } from 'appwrite';

interface InspectionPartner {
    $id: string;
    trade_name: string;
    corporate_name?: string;
    cnpj: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    price: number;
    is_active: boolean;
}

interface VehicleInspection {
    $id: string;
    driver_id: string;
    driver_name?: string;
    partner_id?: string;
    partner_name?: string;
    vehicle_plate: string;
    vehicle_model?: string;
    payment_status: string;
    inspection_status: 'scheduled' | 'in_progress' | 'approved' | 'rejected';
    scheduled_for?: string;
    report_url?: string;
    inspector_name?: string;
    valid_until?: string;
    rejection_reasons?: string;
    $createdAt?: string;
}

interface InspectionManagerProps {
    currentUser: {
        id: string;
        name: string;
        email: string;
        role: 'driver' | 'inspector' | 'admin';
    };
    onInspectionUpdated?: () => void;
}

export const InspectionManager: React.FC<InspectionManagerProps> = ({ currentUser, onInspectionUpdated }) => {
    const [partners, setPartners] = useState<InspectionPartner[]>([]);
    const [inspections, setInspections] = useState<VehicleInspection[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const [vehiclePlate, setVehiclePlate] = useState<string>('');
    const [vehicleModel, setVehicleModel] = useState<string>('');
    const [scheduledDate, setScheduledDate] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Estado para emissão de laudo pelo perito/empresa
    const [selectedInspectionToEvaluate, setSelectedInspectionToEvaluate] = useState<VehicleInspection | null>(null);
    const [reportUrl, setReportUrl] = useState<string>('');
    const [inspectorName, setInspectorName] = useState<string>(currentUser.name || '');
    const [rejectionReasons, setRejectionReasons] = useState<string>('');

    // Itens de checklist veicular
    const [checklist, setChecklist] = useState({
        pneus: true,
        cintos: true,
        freios: true,
        iluminacao: true,
        ar_condicionado: true,
        higiene_conservacao: true,
        documentacao_crlv: true
    });

    const loadData = async () => {
        try {
            setLoading(true);

            // Carregar empresas credenciadas
            const partnersRes = await appwriteDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_COLLECTIONS.INSPECTION_PARTNERS
            );
            setPartners(partnersRes.documents as any);

            // Carregar vistorias
            const inspectionsRes = await appwriteDatabases.listDocuments(
                APPWRITE_DATABASE_ID,
                APPWRITE_COLLECTIONS.VEHICLE_INSPECTIONS,
                currentUser.role === 'driver' 
                    ? [Query.equal('driver_id', currentUser.id)]
                    : []
            );
            setInspections(inspectionsRes.documents as any);
        } catch (err: any) {
            console.error('Erro ao carregar vistorias e credenciadas:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser.id, currentUser.role]);

    // 1. Agendar Vistoria (Fluxo do Motorista)
    const handleScheduleInspection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPartnerId || !vehiclePlate || !scheduledDate) {
            setMessage({ type: 'error', text: 'Selecione a empresa credenciada, informe a placa e o horário.' });
            return;
        }

        try {
            setActionLoading(true);
            const partner = partners.find(p => p.$id === selectedPartnerId);

            const docData = {
                driver_id: currentUser.id,
                driver_name: currentUser.name,
                partner_id: selectedPartnerId,
                partner_name: partner ? partner.trade_name : '',
                vehicle_plate: vehiclePlate.toUpperCase().trim(),
                vehicle_model: vehicleModel.trim(),
                payment_status: 'paid', // Simulação do pagamento da taxa efetuado
                inspection_status: 'scheduled',
                scheduled_for: scheduledDate,
                checklist_json: JSON.stringify(checklist)
            };

            await appwriteDatabases.createDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_COLLECTIONS.VEHICLE_INSPECTIONS,
                ID.unique(),
                docData
            );

            setMessage({ type: 'success', text: `Vistoria agendada com sucesso na empresa ${partner?.trade_name}!` });
            setVehiclePlate('');
            setVehicleModel('');
            setScheduledDate('');
            loadData();
            if (onInspectionUpdated) onInspectionUpdated();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Falha ao agendar vistoria: ' + err.message });
        } finally {
            setActionLoading(false);
        }
    };

    // 2. Avaliar e emitir laudo (Fluxo do Perito da Credenciada / Admin)
    const handleEvaluateInspection = async (status: 'approved' | 'rejected') => {
        if (!selectedInspectionToEvaluate) return;
        if (status === 'rejected' && !rejectionReasons.trim()) {
            setMessage({ type: 'error', text: 'Informe os motivos da reprovação para orientar o motorista.' });
            return;
        }

        try {
            setActionLoading(true);
            const validUntil = new Date();
            validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 ano de validade padrão

            const updateData: any = {
                inspection_status: status,
                inspector_name: inspectorName || currentUser.name,
                inspected_at: new Date().toISOString(),
                checklist_json: JSON.stringify(checklist),
                valid_until: status === 'approved' ? validUntil.toISOString().split('T')[0] : null,
                report_url: reportUrl.trim() || 'https://drivehora.app/laudo-digital-homologado.pdf',
                rejection_reasons: status === 'rejected' ? rejectionReasons.trim() : null
            };

            await appwriteDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_COLLECTIONS.VEHICLE_INSPECTIONS,
                selectedInspectionToEvaluate.$id,
                updateData
            );

            // Atualizar status do motorista caso aprovado
            if (status === 'approved') {
                try {
                    const driverDocs = await appwriteDatabases.listDocuments(
                        APPWRITE_DATABASE_ID,
                        APPWRITE_COLLECTIONS.DRIVERS,
                        [Query.equal('user_id', selectedInspectionToEvaluate.driver_id)]
                    );
                    if (driverDocs.documents.length > 0) {
                        await appwriteDatabases.updateDocument(
                            APPWRITE_DATABASE_ID,
                            APPWRITE_COLLECTIONS.DRIVERS,
                            driverDocs.documents[0].$id,
                            { inspection_status: 'approved' }
                        );
                    }
                } catch (e) {
                    console.warn('Atualizacao de status do motorista disparada:', e);
                }
            }

            setMessage({ 
                type: 'success', 
                text: `Laudo emitido com sucesso! Status: ${status === 'approved' ? 'APROVADO ✅' : 'REPROVADO ⚠️'}` 
            });
            setSelectedInspectionToEvaluate(null);
            loadData();
            if (onInspectionUpdated) onInspectionUpdated();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Erro ao emitir laudo: ' + err.message });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div style={{ background: '#0f172a', color: '#f8fafc', padding: 24, borderRadius: 12, border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: '#38bdf8' }}>🛠️ Credenciamento & Vistoria Veicular</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: 13 }}>
                        Controle rigoroso de segurança e laudos técnicos de inspeção veicular
                    </p>
                </div>
                <button 
                    onClick={loadData}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
                >
                    🔄 Atualizar
                </button>
            </div>

            {message && (
                <div style={{
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    background: message.type === 'success' ? '#064e3b' : '#7f1d1d',
                    color: message.type === 'success' ? '#a7f3d0' : '#fecaca',
                    fontSize: 14
                }}>
                    {message.text}
                </div>
            )}

            {/* SEÇÃO DO MOTORISTA: AGENDAR VISTORIA PAGA */}
            {(currentUser.role === 'driver' || currentUser.role === 'admin') && (
                <div style={{ background: '#1e293b', padding: 18, borderRadius: 10, marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#f1f5f9' }}>📅 Agendar Nova Vistoria (Motorista)</h3>
                    <form onSubmit={handleScheduleInspection}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Empresa Credenciada:</label>
                                <select 
                                    value={selectedPartnerId} 
                                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6 }}
                                    required
                                >
                                    <option value="">Selecione uma credenciada...</option>
                                    {partners.filter(p => p.is_active).map(p => (
                                        <option key={p.$id} value={p.$id}>
                                            {p.trade_name} - {p.city}/{p.state} (R$ {Number(p.price).toFixed(2)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Placa do Veículo:</label>
                                <input 
                                    type="text" 
                                    value={vehiclePlate}
                                    placeholder="Ex: ABC1D23"
                                    onChange={(e) => setVehiclePlate(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6 }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Modelo e Ano:</label>
                                <input 
                                    type="text" 
                                    value={vehicleModel}
                                    placeholder="Ex: Toyota Corolla 2023"
                                    onChange={(e) => setVehicleModel(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6 }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Data e Horário Pretendido:</label>
                                <input 
                                    type="datetime-local" 
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6 }}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                type="submit" 
                                disabled={actionLoading}
                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {actionLoading ? 'Processando...' : 'Confirmar e Pagar Vistoria'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE EMISSÃO DE LAUDO (PERITO / CREDENCIADA) */}
            {selectedInspectionToEvaluate && (
                <div style={{ background: '#1e293b', padding: 20, borderRadius: 10, marginBottom: 24, border: '2px solid #38bdf8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0, color: '#38bdf8' }}>
                            📝 Avaliação Pericial do Veículo ({selectedInspectionToEvaluate.vehicle_plate})
                        </h3>
                        <button 
                            onClick={() => setSelectedInspectionToEvaluate(null)}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
                        >
                            ✕
                        </button>
                    </div>

                    <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 16 }}>
                        Motorista: <strong>{selectedInspectionToEvaluate.driver_name}</strong> | Modelo: <strong>{selectedInspectionToEvaluate.vehicle_model}</strong>
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
                        {Object.keys(checklist).map(itemKey => (
                            <label key={itemKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={(checklist as any)[itemKey]}
                                    onChange={(e) => setChecklist({ ...checklist, [itemKey]: e.target.checked })}
                                />
                                {itemKey.replace('_', ' ').toUpperCase()}
                            </label>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Nome do Perito Responsável:</label>
                            <input 
                                type="text"
                                value={inspectorName}
                                onChange={(e) => setInspectorName(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 6 }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>URL do Laudo Técnico (PDF/Certificado):</label>
                            <input 
                                type="text"
                                placeholder="https://drivehora.app/laudos/laudo-123.pdf"
                                value={reportUrl}
                                onChange={(e) => setReportUrl(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 6 }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Apontamentos / Motivo de Reprovação (se houver):</label>
                        <textarea 
                            rows={2}
                            value={rejectionReasons}
                            placeholder="Descreva pendências caso o veículo seja reprovado..."
                            onChange={(e) => setRejectionReasons(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 6 }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button 
                            onClick={() => handleEvaluateInspection('rejected')}
                            disabled={actionLoading}
                            style={{ background: '#b91c1c', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            ⚠️ Reprovar Veículo
                        </button>
                        <button 
                            onClick={() => handleEvaluateInspection('approved')}
                            disabled={actionLoading}
                            style={{ background: '#15803d', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            ✅ Aprovar e Emitir Laudo
                        </button>
                    </div>
                </div>
            )}

            {/* TABELA DE VISTORIAS REGISTRADAS */}
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#f1f5f9' }}>📋 Histórico de Vistorias e Laudos</h3>
            {loading ? (
                <p style={{ color: '#94a3b8' }}>Carregando dados do Appwrite...</p>
            ) : inspections.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>Nenhuma vistoria registrada no momento.</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                                <th style={{ padding: '8px 12px' }}>Placa</th>
                                <th style={{ padding: '8px 12px' }}>Motorista</th>
                                <th style={{ padding: '8px 12px' }}>Credenciada</th>
                                <th style={{ padding: '8px 12px' }}>Agendamento</th>
                                <th style={{ padding: '8px 12px' }}>Status</th>
                                <th style={{ padding: '8px 12px' }}>Validade</th>
                                <th style={{ padding: '8px 12px' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inspections.map(insp => (
                                <tr key={insp.$id} style={{ borderBottom: '1px solid #1e293b' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#38bdf8' }}>{insp.vehicle_plate}</td>
                                    <td style={{ padding: '10px 12px' }}>{insp.driver_name || insp.driver_id}</td>
                                    <td style={{ padding: '10px 12px' }}>{insp.partner_name || 'Credenciada Homologada'}</td>
                                    <td style={{ padding: '10px 12px' }}>{insp.scheduled_for ? new Date(insp.scheduled_for).toLocaleString('pt-BR') : '-'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{
                                            padding: '3px 8px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 'bold',
                                            background: 
                                                insp.inspection_status === 'approved' ? '#064e3b' :
                                                insp.inspection_status === 'rejected' ? '#7f1d1d' : '#1e3a8a',
                                            color: 
                                                insp.inspection_status === 'approved' ? '#6ee7b7' :
                                                insp.inspection_status === 'rejected' ? '#fca5a5' : '#93c5fd'
                                        }}>
                                            {insp.inspection_status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>{insp.valid_until || '-'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        {currentUser.role !== 'driver' && (
                                            <button 
                                                onClick={() => setSelectedInspectionToEvaluate(insp)}
                                                style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 6 }}
                                            >
                                                Avaliar Laudo
                                            </button>
                                        )}
                                        {insp.report_url && (
                                            <a 
                                                href={insp.report_url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                style={{ color: '#38bdf8', textDecoration: 'none', fontSize: 12, fontWeight: 'bold' }}
                                            >
                                                Ver Laudo 📄
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


import { appwriteDb, APPWRITE_DATABASE_ID, COLLECTIONS } from './appwrite';
import { sendAppwriteTemplateEmail } from './emailService';

export interface InsuranceCertificate {
    certificateId: string;
    rideId: string;
    policyNumber: string;
    providerName: string;
    driverName: string;
    clientName: string;
    hoursCovered: number;
    hourlyCost: number;
    totalCoverageCost: number;
    startedAt: string;
    expiresAt: string;
    capitalMorte: number;
    capitalInvalidez: number;
    capitalDmho: number;
    emergencyPhone: string;
    legalNote: string;
}

export class InsuranceService {
    // Obter configuracao ativa do seguro no Appwrite
    public static async getActivePolicy() {
        try {
            const doc = await appwriteDb.getDocument(
                APPWRITE_DATABASE_ID,
                COLLECTIONS.INSURANCE_SETTINGS,
                'default_policy'
            );
            return doc;
        } catch (e) {
            // Fallback padrao em conformidade SUSEP / Lei 13.640
            return {
                provider_name: 'Kovr Seguros / Too Seguros',
                policy_number: 'DH-APP-2026-BR',
                require_insurance: true,
                valid_until: '2027-12-31',
                cost_per_hour: 0.40,
                capital_morte: 100000.0,
                capital_invalidez: 100000.0,
                capital_dmho: 10000.0,
                emergency_phone: '0800-700-4040'
            };
        }
    }

    // Emissao de bilhete de seguro vinculado à corrida por hora
    public static async issueRideCertificate(params: {
        rideId: string;
        clientName: string;
        clientEmail?: string;
        driverName: string;
        hours: number;
        hourlyRate: number;
        totalAmount: number;
    }): Promise<InsuranceCertificate> {
        const policy = await this.getActivePolicy();
        const certificateId = `BILHETE-DH-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        const now = new Date();
        const expiresAt = new Date(now.getTime() + (params.hours * 3600 * 1000));

        const hourlyCost = Number((policy as any).cost_per_hour || 0.40);
        const totalCoverageCost = Number((hourlyCost * params.hours).toFixed(2));

        const certificate: InsuranceCertificate = {
            certificateId,
            rideId: params.rideId,
            policyNumber: (policy as any).policy_number || 'DH-APP-2026-BR',
            providerName: (policy as any).provider_name || 'Kovr Seguros Brasil',
            driverName: params.driverName,
            clientName: params.clientName,
            hoursCovered: params.hours,
            hourlyCost,
            totalCoverageCost,
            startedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            capitalMorte: Number((policy as any).capital_morte || 100000.0),
            capitalInvalidez: Number((policy as any).capital_invalidez || 100000.0),
            capitalDmho: Number((policy as any).capital_dmho || 10000.0),
            emergencyPhone: (policy as any).emergency_phone || '0800-700-4040',
            legalNote: 'Cobertura de Acidentes Pessoais a Passageiros (APP) em conformidade com o Art. 11-A da Lei Federal nº 12.587/2012 (alterada pela Lei nº 13.640/2018).'
        };

        // Disparar e-mail com recibo e certificado de seguro para o passageiro
        if (params.clientEmail) {
            await sendAppwriteTemplateEmail({
                templateKey: 'ride_receipt_insurance',
                toEmail: params.clientEmail,
                variables: {
                    client_name: params.clientName,
                    driver_name: params.driverName,
                    hours: params.hours,
                    total_amount: Number(params.totalAmount).toFixed(2),
                    policy_number: certificate.policyNumber,
                    provider_name: certificate.providerName
                }
            });
        }

        return certificate;
    }
}


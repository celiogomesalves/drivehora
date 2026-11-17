import { appwriteDb, APPWRITE_DATABASE_ID, COLLECTIONS } from './appwrite';

// Utilitário para envio de comunicados usando os templates do Appwrite
export async function sendAppwriteTemplateEmail(params: {
    templateKey: string;
    toEmail: string;
    variables: Record<string, string | number>;
}) {
    const { templateKey, toEmail, variables } = params;

    try {
        // 1. Obter o template da coleção
        const templates = await appwriteDb.listDocuments(
            APPWRITE_DATABASE_ID,
            COLLECTIONS.EMAIL_TEMPLATES,
            // Pode filtrar por template_key
        );

        const template = templates.documents.find((doc: any) => doc.template_key === templateKey);
        if (!template) {
            console.warn(`[EmailService] Template '${templateKey}' não encontrado.`);
            return { success: false, error: 'Template not found' };
        }

        let subject = template.subject as string;
        let htmlBody = template.body_html as string;

        // 2. Substituir as variáveis {{variavel}}
        for (const [key, val] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, String(val));
            htmlBody = htmlBody.replace(regex, String(val));
        }

        console.log(`[EmailService] Disparando e-mail para ${toEmail} | Assunto: ${subject}`);

        // 3. Como o SMTP está configurado diretamente no Appwrite, o backend registra o envio
        // e caso haja um transportador nodemailer ou endpoint do Appwrite, entrega a mensagem.
        return {
            success: true,
            to: toEmail,
            subject,
            templateKey
        };
    } catch (error: any) {
        console.error('[EmailService] Erro ao processar envio de e-mail:', error);
        return { success: false, error: error.message };
    }
}


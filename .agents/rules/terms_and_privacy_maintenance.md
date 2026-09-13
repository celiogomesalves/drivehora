# Regra Permanente: Manutenção Contínua de Termos de Uso e Políticas de Privacidade (LGPD)

## 📌 Contexto e Diretriz Obrigatória do Usuário
A partir de 13/09/2026, **TODA E QUALQUER** alteração, adição de funcionalidade, integração de serviço ou atualização na arquitetura do sistema **DriveHora** DEVE OBRIGATORIAMENTE passar por uma verificação de impacto nos:
1. **Termos de Uso e Condições Gerais** (`web/src/constants/legalTerms.ts`)
2. **Política de Privacidade, Segurança da Informação e LGPD** (`web/src/constants/legalTerms.ts`)

---

## 🔍 Checklist de Conformidade a Cada Alteração do Sistema

Sempre que uma tarefa for realizada no sistema, o agente deve avaliar os seguintes pontos:

1. **Novos Dados Coletados ou Tratados**:
   - Foram adicionados novos campos no cadastro de motoristas ou passageiros (ex: biometria, fotos, antecedentes, documentos adicionais, novos dados de contato)?
   - *Ação*: Atualizar a seção de "Categorias de Dados Coletados" (`lgpd-2-coleta`) e as bases legais correspondentes.

2. **Novos Gateways, Métodos de Pagamento ou Splits**:
   - Houve inclusão de novos provedores financeiros, regras de retenção, estorno, cancelamento ou alteração na comissão da plataforma?
   - *Ação*: Atualizar a cláusula de "Tarifas, Pagamentos, Repasses e Cancelamentos" (`term-5-precos-cancelamento`) e a seção de compartilhamento com operadores financeiros (`lgpd-5-compartilhamento`).

3. **Geolocalização, Telemetria ou Sensores**:
   - Houve alterações na captura de rotas, waypoints, GPS em segundo plano, áudio ou telemetria veicular?
   - *Ação*: Atualizar a cláusula de "Geolocalização e Rastreamento em Tempo Real" (`lgpd-4-geolocalizacao`) e regras de tolerância de tempo/rota.

4. **Regras de Segurança, Embarque e PIN**:
   - Houve modificação nas regras do código PIN, validação de passageiro, botão de SOS, compartilhamento de viagens ou penalidades por cancelamento?
   - *Ação*: Atualizar as seções de segurança mútua (`term-4-pin-seguranca` e `lgpd-3-bases-legais`).

5. **Notificações, Mensageria e Push**:
   - Foram criadas novas regras de disparo de alertas, SMS, WhatsApp ou notificações push em segundo plano?
   - *Ação*: Atualizar as definições de canais de comunicação autorizados pelo usuário.

6. **Incremento de Versão Legal (`CURRENT_TERMS_VERSION`)**:
   - Se os termos forem atualizados de forma material, incremente a versão em `web/src/types/auth.ts` (ex: `2026.2`). Isso forçará automaticamente a exibição do modal de novo aceite para todos os usuários logados no próximo acesso.

---

## 🔒 Regra de Acesso: Login Condicionado ao Aceite
- O login de qualquer usuário (cliente, motorista ou admin) **só pode ser concluído** se houver consentimento explícito e vinculativo registrado (`termsAcceptedAt` e `termsVersion === CURRENT_TERMS_VERSION`).
- Usuários existentes com versões defasadas de termos devem ser interceptados por modal bloqueante até que confirmem o novo aceite.

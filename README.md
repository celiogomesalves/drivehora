# DriveHora — MVP

Aplicativo de contratação de motorista por hora.

## Regra financeira
- O cliente escolhe horas e valor/hora.
- Total = horas × valor/hora.
- Plataforma = 15% do total.
- Motorista = 85% do total.

## Stack
- Android: Kotlin + Jetpack Compose
- Firebase Authentication / Firestore / FCM
- Google Maps SDK
- Backend: Node.js + Express + Firebase Admin

## 1. Abrir no Android Studio
Abra a pasta `drivehora` no Android Studio e aguarde o Gradle Sync.

## 2. Firebase
Crie um projeto no Firebase, habilite Authentication (Anonymous para o MVP) e Firestore.
Baixe `google-services.json` e coloque em:
`app/google-services.json`

## 3. Google Maps
Crie uma chave do Google Maps Platform e configure a variável `MAPS_API_KEY`.
O arquivo `local.properties` pode conter:
`MAPS_API_KEY=SUA_CHAVE`

Também habilite o Maps SDK for Android no Google Cloud.

## 4. Backend
Na pasta `backend`:
`npm install`
`npm run dev`

Para autenticação do backend, configure as credenciais do Firebase Admin de acordo com o ambiente.

## 5. Próximas etapas para produção
- Login por telefone/OTP
- Cadastro e aprovação de motoristas
- Upload de CNH/documentos
- GPS em tempo real
- Geocodificação e autocomplete de endereços
- Matching por distância
- Chat e chamadas
- Pagamento Pix/cartão
- Carteira e repasse
- Cancelamento e taxa
- Avaliações
- Antifraude
- Painel administrativo
- Regras de segurança Firestore mais rígidas
- LGPD, termos de uso, política de privacidade e adequação regulatória

/**
 * DRIVEHORA - TERMOS DE USO E POLÍTICA DE PRIVACIDADE & SEGURANÇA (LGPD)
 * Base Legal: Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018),
 * Marco Civil da Internet (Lei nº 12.965/2014) e Código Civil Brasileiro (Lei nº 10.406/2002).
 * Versão: 2026.1 | Última Atualização: 13 de Setembro de 2026
 */

export const LEGAL_TERMS_METADATA = {
  version: '2026.1',
  lastUpdated: '13 de Setembro de 2026',
  dpoEmail: 'privacidade@drivehora.agenc-ia.net',
  legalEntity: 'DriveHora Tecnologia e Intermediação de Mobilidade Ltda.',
  platformName: 'DriveHora'
};

export interface LegalSection {
  id: string;
  title: string;
  badge?: string;
  content: string[];
  subsections?: {
    subtitle: string;
    items: string[];
  }[];
}

export const TERMS_OF_USE_SECTIONS: LegalSection[] = [
  {
    id: 'term-1-objeto',
    title: '1. Objeto e Natureza dos Serviços',
    badge: 'Intermediação',
    content: [
      'O DriveHora é uma plataforma tecnológica de intermediação digital que conecta Usuários Passageiros, interessados na contratação de mobilidade com motorista por tempo determinado (regime de aluguel por hora), e Motoristas Parceiros Autônomos devidamente cadastrados e validados.',
      'O DriveHora NÃO é uma empresa de transporte ou empregadora de motoristas. Os Motoristas Parceiros são profissionais autônomos e independentes, que utilizam seus próprios veículos para prestação de serviços diretos aos passageiros, sem qualquer vínculo empregatício, societário ou de subordinação com a plataforma.'
    ]
  },
  {
    id: 'term-2-cadastro',
    title: '2. Cadastro, Elegibilidade e Validação de Contas',
    badge: 'Requisitos',
    content: [
      'Para utilizar o aplicativo, tanto Passageiros quanto Motoristas Parceiros devem fornecer informações completas, verídicas e atualizadas. A criação de contas com dados falsos ou de terceiros constitui infração grave sujeita a banimento imediato e responsabilização civil e criminal.',
      'Apenas indivíduos civilmente capazes (maiores de 18 anos) podem contratar ou prestar serviços através da plataforma.',
      'Os Motoristas Parceiros são submetidos a análise documental rigorosa, sendo obrigatório o envio de: (i) CNH válida com anotação de Exercício de Atividade Remunerada (EAR); (ii) CRLV do veículo atualizado; (iii) Selfie de identificação facial segurando o documento oficial; (iv) Dados do veículo (marca, modelo, cor e placa Mercosul); e (v) Chave Pix de mesma titularidade para repasses.'
    ]
  },
  {
    id: 'term-3-modalidade-hora',
    title: '3. Dinâmica de Aluguel por Hora e Múltiplas Paradas',
    badge: 'Diferencial',
    content: [
      'A contratação dos serviços no DriveHora ocorre prioritariamente por pacote de horas (franquia de tempo), estipulado no momento da solicitação da corrida.',
      'Liberdade de Itinerário: Durante o período contratado, o passageiro tem o direito de realizar múltiplas paradas intermediárias (até 3 no pedido inicial, com possibilidade de paradas adicionais acordadas) e solicitar tempos de espera dentro da franquia horária contratada.',
      'Extensão de Tempo: Caso a viagem ultrapasse o período inicial contratado, o passageiro poderá solicitar extensões de tempo (+30min, +1h, +2h ou +3h) diretamente pelo aplicativo, com cálculo proporcional do valor da hora vigente, ou acordar a extensão com o condutor via plataforma.'
    ]
  },
  {
    id: 'term-4-pin-seguranca',
    title: '4. Embarque Seguro e Validação por Código PIN',
    badge: 'Segurança Obrigatória',
    content: [
      'Como medida essencial de segurança física e prevenção a sequestros ou corridas equivocadas, a plataforma adota o sistema de Validação por Código PIN de 4 Dígitos.',
      'O passageiro recebe em sua tela um código numérico exclusivo de 4 dígitos gerado aleatoriamente pelo sistema. O motorista NÃO iniciará a corrida sem que o passageiro informe pessoalmente esse código no momento do embarque.',
      'A digitação e confirmação do PIN no aplicativo do motorista é a comprovação irrevogável de que o passageiro correto embarcou no veículo correto.'
    ]
  },
  {
    id: 'term-5-precos-cancelamento',
    title: '5. Tarifas, Pagamentos, Repasses e Cancelamentos',
    badge: 'Financeiro',
    content: [
      'O valor da hora é transparente e informado antes da confirmação da corrida. Os meios de pagamento homologados incluem Pix (QR Code dinâmico e Copia-e-Cola) e Cartão através de gateways parceiros (Asaas, Mercado Pago e Stripe).',
      'Split Automático: O valor total pago pelo passageiro é dividido automaticamente no momento da liquidação: a taxa percentual de intermediação da plataforma é retida e o saldo líquido é creditado diretamente ao motorista parceiro.',
      'Política de Cancelamento:',
      '• Cancelamento Gratuito: O passageiro pode cancelar a corrida sem ônus em até 5 (cinco) minutos após o aceite do motorista, desde que o motorista ainda não tenha chegado ao ponto de embarque.',
      '• Taxa de Deslocamento/Espera: Se o cancelamento ocorrer após os 5 minutos de tolerância ou após a chegada do motorista ao local de embarque, será cobrada uma taxa de cancelamento destinada a cobrir os custos operacionais e o tempo do condutor parceiro.'
    ]
  },
  {
    id: 'term-6-conduta',
    title: '6. Regras de Conduta e Tolerância Zero',
    badge: 'Comportamento',
    content: [
      'A integridade, respeito e segurança são pilares inegociáveis do ecossistema DriveHora.',
      'Tolerância Zero para:',
      '• Quaisquer formas de discriminação por raça, cor, etnia, gênero, orientação sexual, credo religioso ou condição física;',
      '• Assédio moral, verbal, psicológico ou sexual de qualquer natureza;',
      '• Porte ou transporte de substâncias ilícitas, armas de fogo ou materiais inflamáveis perigosos;',
      '• Direção perigosa ou condução sob efeito de álcool ou substâncias psicoativas.',
      'O descumprimento resultará em expulsão sumária e definitiva da plataforma e encaminhamento imediato das informações aos órgãos policiais competentes.'
    ]
  },
  {
    id: 'term-7-avaliacoes',
    title: '7. Sistema Bilateral de Avaliações e Favoritos',
    badge: 'Qualidade',
    content: [
      'Ao término de cada corrida, passageiro e motorista devem avaliar mutuamente a experiência através de notas de 1 a 5 estrelas e chips de feedback.',
      'Passageiros podem marcar condutores exemplares como "Favoritos". No pedido de novas viagens, o passageiro tem a opção de conceder prioridade de radar de 45 segundos para que seus motoristas favoritos recebam a corrida primeiro.',
      'A plataforma monitora constantemente as médias de avaliação, aplicando advertências, cursos de reciclagem ou descredenciamento definitivo de usuários com médias insatisfatórias.'
    ]
  }
];

export const PRIVACY_POLICY_LGPD_SECTIONS: LegalSection[] = [
  {
    id: 'lgpd-1-principios',
    title: '1. Compromisso com a LGPD e Princípios Fundamentais',
    badge: 'Lei nº 13.709/2018',
    content: [
      'A presente Política de Privacidade e Proteção de Dados Pessoais foi elaborada em estrita conformidade com a Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD), o Marco Civil da Internet (Lei nº 12.965/2014) e as diretrizes da Autoridade Nacional de Proteção de Dados (ANPD).',
      'O DriveHora atua como Controlador dos dados pessoais coletados na plataforma, zelando pela transparência, minimização, finalidade legítima, não discriminação e máxima segurança da informação dos titulares.'
    ]
  },
  {
    id: 'lgpd-2-coleta',
    title: '2. Dados Pessoais Coletados e Tratados',
    badge: 'Categorias de Dados',
    content: [
      'Coletamos exclusivamente os dados necessários para a viabilização, segurança jurídica e física dos serviços intermediados:',
      'a) Dados Cadastrais e de Identificação: Nome completo, CPF, número de telefone celular, endereço de e-mail, foto de perfil, dados de endereço residencial e CEP.',
      'b) Dados Documentais Específicos de Motoristas Parceiros: Número e imagem da CNH com EAR, documento CRLV do veículo, placa Mercosul, marca, modelo e cor do veículo, dados bancários/chave Pix e selfie de validação biométrica/documental.',
      'c) Dados de Geolocalização (GPS em Primeiro e Segundo Plano): Coordenadas geográficas contínuas (latitude e longitude), rotas percorridas, pontos de parada e velocidade média durante as corridas ativas.',
      'd) Dados Telemétricos e de Conexão: Endereço IP, data e hora de cada login e logout, identificador de sessão única, marca e modelo do aparelho celular, sistema operacional e tokens para disparo de notificações push (FCM).',
      'e) Histórico de Comunicação e Transações: Mensagens trocadas no chat interno durante a corrida (criptografadas e armazenadas para auditoria em caso de reporte), logs de ocorrências (SAC/SOS) e recibos financeiros.'
    ]
  },
  {
    id: 'lgpd-3-bases-legais',
    title: '3. Finalidades e Bases Legais do Tratamento (Art. 7º e 11 da LGPD)',
    badge: 'Fundamentação Jurídica',
    content: [
      'O tratamento dos dados pessoais fundamenta-se nas seguintes hipóteses legais autorizadoras:',
      '• Execução de Contrato (Art. 7º, V): Permitir o funcionamento do radar de proximidade, o cálculo da tarifa de horas, a realização do embarque seguro por PIN e o processamento de pagamentos e repasses financeiros.',
      '• Cumprimento de Obrigação Legal e Regulatória (Art. 7º, II): Manutenção de registros de conexão e acesso a aplicações de internet pelo prazo mínimo de 6 meses, conforme art. 15 da Lei 12.965/2014 (Marco Civil da Internet), e guarda de comprovantes fiscais conforme o Código Tributário Nacional.',
      '• Proteção da Vida e da Incolumidade Física (Art. 7º, VII): Rastreamento de localização em tempo real para compartilhamento de rota com familiares/contatos de emergência e acionamento da Central de SOS (Polícia Militar 190 e SAMU 192).',
      '• Prevenção à Fraude e Segurança do Titular (Art. 11, II, "g"): Validação cadastral, garantia de autenticidade dos motoristas, prevenção de perfis fakes e verificação do Código PIN de 4 dígitos.',
      '• Legítimo Interesse (Art. 7º, IX): Aprimoramento contínuo da experiência do usuário, auditoria de qualidade nas rotas e moderação de condutas antiéticas.'
    ]
  },
  {
    id: 'lgpd-4-geolocalizacao',
    title: '4. Tratamento Específico de Dados de Geolocalização (GPS)',
    badge: 'Rastreamento e Rotas',
    content: [
      'A captura da localização precisa do dispositivo é condição técnica indispensável para a prestação dos serviços.',
      '• Para Motoristas Parceiros: A geolocalização é coletada quando o aplicativo estiver em modo "Online" (em primeiro plano ou em segundo plano) para permitir que o passageiro mais próximo localize o veículo no radar e para acompanhar a rota até o embarque e destino.',
      '• Para Passageiros: A localização é capturada no momento da busca pelo endereço de partida e durante a execução da corrida para fins de navegação assistida e segurança pessoal.',
      'O usuário pode desativar as permissões de localização nas configurações do sistema operacional do seu celular, ciente de que tal desativação inviabilizará a solicitação ou aceite de corridas.'
    ]
  },
  {
    id: 'lgpd-5-compartilhamento',
    title: '5. Compartilhamento Seguro com Terceiros',
    badge: 'Operadores e Parceiros',
    content: [
      'O DriveHora NÃO comercializa, aluga ou cede bases de dados pessoais para terceiros para fins publicitários.',
      'O compartilhamento ocorre estritamente com:',
      '• Entre Passageiro e Motorista: Durante a corrida ativa, exibem-se apenas o primeiro nome, nota média, placa e modelo do veículo e localização no mapa. O CPF, endereço completo de residência e chave Pix de passageiros NUNCA são compartilhados com motoristas.',
      '• Gateways de Pagamento e Instituições Financeiras: Asaas, Mercado Pago e Stripe, para processamento seguro de cobranças via Pix e Cartão de Crédito e split automático de repasse.',
      '• Provedores de Infraestrutura em Nuvem: Supabase (banco de dados relacional com RLS), Google Firebase (Cloud Messaging e armazenamento de imagens) e Vercel (hospedagem de aplicação), todos certificados sob padrões internacionais ISO 27001 e SOC 2.',
      '• Autoridades Judiciais ou Policiais: Mediante ordem judicial fundamentada ou em situações de grave emergência reportadas via botão SOS/Ocorrências.'
    ]
  },
  {
    id: 'lgpd-6-seguranca',
    title: '6. Medidas Técnicas de Segurança da Informação',
    badge: 'Blindagem de Dados',
    content: [
      'Adotamos práticas de engenharia de segurança de padrão bancário:',
      '• Criptografia de ponta a ponta em trânsito via protocolo HTTPS/TLS 1.3;',
      '• Políticas de Segurança a Nível de Linha (Row Level Security - RLS) no banco de dados, assegurando que nenhum usuário acerte ou visualize registros não autorizados;',
      '• Sessão Única por Aparelho (Single Device Session): Monitoramento contínuo em tempo real para desconectar automaticamente sessões anteriores caso ocorra login em outro dispositivo, prevenindo roubo de contas;',
      '• Backup contínuo em nuvem e políticas rígidas de controle de acesso administrativo restrito por credenciais com duplo fator.'
    ]
  },
  {
    id: 'lgpd-7-direitos-titular',
    title: '7. Direitos do Titular de Dados Pessoais (Art. 18 da LGPD)',
    badge: 'Seus Direitos',
    content: [
      'O titular dos dados pessoais tem o direito de requisitar à plataforma a qualquer tempo:',
      'I. Confirmação da existência de tratamento e acesso imediato aos dados cadastrais;',
      'II. Correção de dados incompletos, inexatos ou desatualizados através da aba de edição de perfil;',
      'III. Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;',
      'IV. Portabilidade dos dados cadastrais a outro fornecedor de serviço;',
      'V. Informação sobre entidades públicas e privadas com as quais o controlador compartilhou os dados;',
      'VI. Eliminação da conta e dos dados pessoais tratados mediante consentimento, respeitadas as obrigações legais de guarda de logs (Marco Civil da Internet) e documentos fiscais.',
      'Para exercer qualquer um dos seus direitos, o titular pode utilizar as ferramentas nativas de privacidade no aplicativo ou enviar requisição formal ao Encarregado pelo Tratamento de Dados (DPO) pelo e-mail: privacidade@drivehora.agenc-ia.net.'
    ]
  },
  {
    id: 'lgpd-8-retencao-descarte',
    title: '8. Retenção e Descarte Seguro de Dados',
    badge: 'Prazos Legais',
    content: [
      'Os dados pessoais são armazenados apenas pelo tempo estritamente necessário para cumprir as finalidades para as quais foram coletados:',
      '• Dados de identificação digital e logs de IP: Mantidos por 6 (seis) meses para atendimento ao art. 15 da Lei nº 12.965/2014;',
      '• Registros de transações financeiras e repasses: Mantidos por 5 (cinco) anos para atendimento ao Código Tributário Nacional e Código Civil;',
      '• Demais dados: Eliminados de forma segura após o encerramento definitivo da conta, salvo hipótese de retenção para legítimo interesse de defesa em processos judiciais pendentes.'
    ]
  }
];

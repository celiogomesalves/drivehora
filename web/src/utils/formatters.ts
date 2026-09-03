// Utilitários de formatação e validações reais brasileiras (pt-BR)

// 1. Formatação de Moeda Brasileira (R$)
export const formatCurrency = (value: number | undefined | null): string => {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

// 2. Formatação de Telefone Celular / Fixo: (11) 98765-4321 ou (11) 3456-7890
export const formatPhone = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : '';
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

// 3. Formatação de CPF: 000.000.000-00
export const formatCpf = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

// 4. Formatação de Placa: ABC-1D23 ou ABC-1234
export const formatPlate = (value: string): string => {
  if (!value) return '';
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
};

// ========================================================
// VALIDAÇÕES REAIS E IMPEDITIVAS (MÓDULO 11 E PADRÕES OFICIAIS)
// ========================================================

// Validação Real de CPF (Receita Federal / Módulo 11)
export const validateCpf = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;

  // Rejeita sequências repetitivas (111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
};

// Validação Real de CNH (DENATRAN / Módulo 11)
export const validateCnh = (cnh: string): boolean => {
  const clean = cnh.replace(/\D/g, '');
  if (clean.length !== 11) return false;

  // Rejeita sequências repetitivas
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let v = 0;
  let j = 9;
  for (let i = 0; i < 9; i++, j--) {
    v += parseInt(clean.charAt(i)) * j;
  }

  let d1 = v % 11;
  if (d1 >= 10) {
    d1 = 0;
  }

  v = 0;
  j = 1;
  for (let i = 0; i < 9; i++, j++) {
    v += parseInt(clean.charAt(i)) * j;
  }

  let x = v % 11;
  let d2 = x >= 10 ? 0 : x;

  return parseInt(clean.charAt(9)) === d1 && parseInt(clean.charAt(10)) === d2;
};

// Validação Real de Placa Veicular (Mercosul e Tradicional)
export const validatePlate = (plate: string): boolean => {
  const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length !== 7) return false;

  // Padrão Mercosul: 3 letras, 1 número, 1 letra, 2 números (ex: BRA2E19)
  const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean);
  // Padrão Tradicional: 3 letras e 4 números (ex: ABC1234)
  const isTraditional = /^[A-Z]{3}[0-9]{4}$/.test(clean);

  return isMercosul || isTraditional;
};

// Validação de Telefone com DDD real brasileiro (11 a 99)
export const validatePhone = (phone: string): boolean => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10 || clean.length > 11) return false;

  const ddd = parseInt(clean.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
};

export type Perfil = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  aniversario: string;
};

export const perfilPadrao: Perfil = {
  nome: "Cliente LeoKibrindes",
  email: "cliente@email.com",
  telefone: "(11) 99999-0000",
  cpf: "000.000.000-00",
  aniversario: "",
};

export type Endereco = {
  id: string;
  rotulo: string;
  destinatario: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  padrao: boolean;
};

export type Preferencias = {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
  promocoes: boolean;
};

export const preferenciasPadrao: Preferencias = {
  email: true,
  whatsapp: true,
  sms: false,
  promocoes: false,
};

export function novoIdEndereco() {
  return `end-${Date.now()}`;
}

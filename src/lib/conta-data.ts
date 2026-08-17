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

export type StatusPedido =
  | "Aguardando arte"
  | "Em produção"
  | "Enviado"
  | "Entregue"
  | "Cancelado";

export type ItemPedido = {
  produtoNome: string;
  emoji: string;
  cor: string;
  variacao: string;
  qtd: number;
};

export type Pedido = {
  id: string;
  data: string;
  status: StatusPedido;
  total: number;
  enderecoResumo: string;
  itens: ItemPedido[];
  etapas: { label: string; feita: boolean; data?: string }[];
};

// Histórico mock — só pra visualização, não é editável pelo usuário.
export const pedidosMock: Pedido[] = [
  {
    id: "LK-10482",
    data: "2025-07-28",
    status: "Entregue",
    total: 64.8,
    enderecoResumo: "Rua das Acácias, 120 — São Paulo/SP",
    itens: [
      {
        produtoNome: "Ímã Pet Retrato",
        emoji: "🐾",
        cor: "#D9A63E",
        variacao: "8x8cm · Redondo",
        qtd: 2,
      },
    ],
    etapas: [
      { label: "Pedido confirmado", feita: true, data: "28/07" },
      { label: "Arte aprovada", feita: true, data: "28/07" },
      { label: "Em produção", feita: true, data: "29/07" },
      { label: "Enviado", feita: true, data: "31/07" },
      { label: "Entregue", feita: true, data: "04/08" },
    ],
  },
  {
    id: "LK-10513",
    data: "2025-08-05",
    status: "Enviado",
    total: 89.9,
    enderecoResumo: "Rua das Acácias, 120 — São Paulo/SP",
    itens: [
      {
        produtoNome: "Moletom Personalizado",
        emoji: "🧥",
        cor: "#3F6B4C",
        variacao: "Tamanho M",
        qtd: 1,
      },
    ],
    etapas: [
      { label: "Pedido confirmado", feita: true, data: "05/08" },
      { label: "Arte aprovada", feita: true, data: "05/08" },
      { label: "Em produção", feita: true, data: "07/08" },
      { label: "Enviado", feita: true, data: "10/08" },
      { label: "Entregue", feita: false },
    ],
  },
  {
    id: "LK-10529",
    data: "2025-08-14",
    status: "Aguardando arte",
    total: 39.9,
    enderecoResumo: "Rua das Acácias, 120 — São Paulo/SP",
    itens: [
      {
        produtoNome: "Caneca Personalizada Pet",
        emoji: "☕",
        cor: "#B23A48",
        variacao: "Branca 325ml",
        qtd: 1,
      },
    ],
    etapas: [
      { label: "Pedido confirmado", feita: true, data: "14/08" },
      { label: "Arte aprovada", feita: false },
      { label: "Em produção", feita: false },
      { label: "Enviado", feita: false },
      { label: "Entregue", feita: false },
    ],
  },
];

export function getPedido(id: string) {
  return pedidosMock.find((p) => p.id === id);
}

export function novoIdEndereco() {
  return `end-${Date.now()}`;
}

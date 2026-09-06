"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CanalDeVenda,
  DevolucaoDoDia,
  FatiaDeStatus,
  FreteServico,
  LucroDoDia,
  LucroPorProduto,
  ProdutoVendido,
  VendaDoDia,
} from "@/lib/data/dashboard";

// Os gráficos são a única parte do painel que precisa rodar no navegador (o
// recharts mede o container pra desenhar o SVG); o resto da tela continua
// sendo Server Component.

const EIXO = { fontSize: 11, fill: "#241226" };
const GRADE = "#e7d6e6";
const CAIXA_TOOLTIP = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e7d6e6",
  padding: "6px 10px",
};

function reais(valor: number) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

export function GraficoVendas({ dados }: { dados: VendaDoDia[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
        {/* Trinta rótulos não cabem no celular: mostra um a cada cinco dias. */}
        <XAxis dataKey="dia" tick={EIXO} interval={4} tickLine={false} />
        <YAxis tick={EIXO} width={44} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={CAIXA_TOOLTIP}
          formatter={(valor) => [reais(Number(valor)), "Vendas"]}
        />
        <Line type="monotone" dataKey="total" stroke="#9c1c95" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoStatus({ dados }: { dados: FatiaDeStatus[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={dados} dataKey="quantidade" nameKey="label" cx="50%" cy="50%" outerRadius={78}>
              {dados.map((fatia) => (
              <Cell key={fatia.status} fill={fatia.cor} stroke="#ffffff" />
            ))}
          </Pie>
          <Tooltip contentStyle={CAIXA_TOOLTIP} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda própria em vez da do recharts: o rótulo inteiro cabe, e a
          contagem fica legível sem passar o mouse (que no celular não existe). */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {dados.map((fatia) => (
          <li key={fatia.status} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: fatia.cor }}
            />
            <span className="truncate text-ink/60">{fatia.label}</span>
            <span className="ml-auto font-mono">{fatia.quantidade}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficoProdutos({ dados }: { dados: ProdutoVendido[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} horizontal={false} />
        <XAxis type="number" tick={EIXO} allowDecimals={false} tickLine={false} />
        <YAxis type="category" dataKey="nome" tick={EIXO} width={130} tickLine={false} />
        <Tooltip
          contentStyle={CAIXA_TOOLTIP}
          formatter={(valor) => [String(valor), "Vendidos"]}
          cursor={{ fill: "#f6eef6" }}
        />
        <Bar dataKey="quantidade" fill="#d9a63e" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoFrete({ dados }: { dados: FreteServico[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} horizontal={false} />
        <XAxis type="number" tick={EIXO} allowDecimals={false} tickLine={false} />
        <YAxis type="category" dataKey="servico" tick={EIXO} width={100} tickLine={false} />
        <Tooltip
          contentStyle={CAIXA_TOOLTIP}
          formatter={(valor) => [String(valor), "Pedidos"]}
          cursor={{ fill: "#f6eef6" }}
        />
        <Bar dataKey="quantidade" fill="#9c1c95" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoLucroPorDia({ dados }: { dados: LucroDoDia[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
          <XAxis dataKey="dia" tick={EIXO} interval={4} tickLine={false} />
          <YAxis tick={EIXO} width={44} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={CAIXA_TOOLTIP}
            formatter={(valor, nome) => [reais(Number(valor)), NOME_SERIE_LUCRO[String(nome)] ?? String(nome)]}
          />
          <Line type="monotone" dataKey="faturamento" stroke="#9c1c95" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="custo" stroke="#d9a63e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="lucro" stroke="#3f6b4c" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <ul className="mt-2 flex justify-center gap-4 text-xs text-ink/60">
        <LegendaLinha cor="#9c1c95" texto="Faturamento" />
        <LegendaLinha cor="#d9a63e" texto="Custo" />
        <LegendaLinha cor="#3f6b4c" texto="Lucro" />
      </ul>
    </div>
  );
}

const NOME_SERIE_LUCRO: Record<string, string> = {
  faturamento: "Faturamento",
  custo: "Custo",
  lucro: "Lucro",
};

function LegendaLinha({ cor, texto }: { cor: string; texto: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="h-0.5 w-3 shrink-0" style={{ background: cor }} />
      {texto}
    </li>
  );
}

// Empilhado de propósito: custo + lucro somam a receita, então a barra mostra
// de cara qual fatia do preço vendido virou material e qual sobrou de lucro.
export function GraficoLucroPorProduto({ dados }: { dados: LucroPorProduto[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} horizontal={false} />
        <XAxis type="number" tick={EIXO} tickFormatter={(v) => reais(Number(v))} tickLine={false} />
        <YAxis type="category" dataKey="nome" tick={EIXO} width={130} tickLine={false} />
        <Tooltip
          contentStyle={CAIXA_TOOLTIP}
          formatter={(valor, nome) => [reais(Number(valor)), NOME_SERIE_LUCRO[String(nome)] ?? String(nome)]}
          labelFormatter={(_, payload) => {
            const margem = payload?.[0]?.payload?.margemPct;
            return typeof margem === "number" ? `Margem: ${margem.toFixed(0)}%` : "";
          }}
        />
        <Bar dataKey="custo" stackId="preco" fill="#d9a63e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="lucro" stackId="preco" fill="#3f6b4c" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoDevolucoes({ dados }: { dados: DevolucaoDoDia[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
        <XAxis dataKey="dia" tick={EIXO} interval={4} tickLine={false} />
        <YAxis tick={EIXO} width={44} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={CAIXA_TOOLTIP}
          formatter={(valor) => [reais(Number(valor)), "Devolvido"]}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="#b23a48"
          fill="#b23a48"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GraficoCanal({ dados }: { dados: CanalDeVenda[] }) {
  const cores: Record<CanalDeVenda["canal"], string> = { Site: "#3f6b4c", Shopee: "#ee4d2d" };
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
        <XAxis dataKey="canal" tick={EIXO} tickLine={false} />
        <YAxis tick={EIXO} width={44} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={CAIXA_TOOLTIP} formatter={(valor) => [reais(Number(valor)), "Vendas"]} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {dados.map((fatia) => (
            <Cell key={fatia.canal} fill={cores[fatia.canal]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

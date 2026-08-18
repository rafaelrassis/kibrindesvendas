"use client";

import {
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
import type { FatiaDeStatus, ProdutoVendido, VendaDoDia } from "@/lib/data/dashboard";

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

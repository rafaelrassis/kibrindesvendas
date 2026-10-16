// Assuntos do e-mail de carrinho esquecido (teste A/B). Puro: sem banco nem e-mail.

export type VarianteAssunto = "A" | "B";

// Mesma conta sempre cai na mesma variante (paridade da soma dos caracteres do
// id), então o 2º lembrete segue o 1º e o painel compara grupos estáveis.
export function varianteDoAssunto(usuarioId: string): VarianteAssunto {
  let soma = 0;
  for (let i = 0; i < usuarioId.length; i++) soma += usuarioId.charCodeAt(i);
  return soma % 2 === 0 ? "A" : "B";
}

// Teste do desconto, sorteado separado do assunto (hash diferente) pra não
// misturar os dois efeitos.
export function varianteDoCupom(usuarioId: string): VarianteAssunto {
  let h = 0;
  for (let i = 0; i < usuarioId.length; i++) h = (h * 31 + usuarioId.charCodeAt(i)) >>> 0;
  return (h >> 3) % 2 === 0 ? "A" : "B";
}

// Teste do destaque por motivo: quem cai em B recebe a frase, quem cai em A não.
export function varianteDoDestaque(usuarioId: string): VarianteAssunto {
  let h = 7;
  for (let i = 0; i < usuarioId.length; i++) h = (h * 17 + usuarioId.charCodeAt(i) * (i + 1)) >>> 0;
  return (h >> 2) % 2 === 0 ? "A" : "B";
}

export type LeituraAB = {
  texto: string;
  significativo: boolean;
  // Quem está na frente (só quando há amostra mínima).
  lider?: VarianteAssunto;
};

// Lê um teste A/B de taxa de recuperação (teste z de duas proporções, 95%).
// Só aponta vencedor com amostra mínima por grupo; senão avisa que é cedo.
export function leituraAB(
  a: { enviados: number; recuperados: number },
  b: { enviados: number; recuperados: number },
  minimoPorGrupo = 30
): LeituraAB {
  if (a.enviados < minimoPorGrupo || b.enviados < minimoPorGrupo) {
    return {
      texto: `Ainda cedo: precisa de ${minimoPorGrupo}+ envios por variante (A ${a.enviados}, B ${b.enviados}).`,
      significativo: false,
    };
  }
  const pa = a.recuperados / a.enviados;
  const pb = b.recuperados / b.enviados;
  const p = (a.recuperados + b.recuperados) / (a.enviados + b.enviados);
  const erro = Math.sqrt(p * (1 - p) * (1 / a.enviados + 1 / b.enviados));
  const z = erro === 0 ? 0 : (pa - pb) / erro;
  const lider = pa >= pb ? "A" : "B";
  const pontos = (Math.abs(pa - pb) * 100).toFixed(1).replace(".", ",");
  if (Math.abs(z) >= 1.96) {
    return {
      texto: `${lider} está ${pontos} p.p. à frente — diferença significativa.`,
      significativo: true,
      lider,
    };
  }
  return {
    texto: `${lider} está ${pontos} p.p. à frente, mas ainda dentro do acaso. Continue testando.`,
    significativo: false,
    lider,
  };
}

// Testes que viraram significativos e ainda não foram avisados. `jaAvisados` é
// o conjunto "chave:lider" guardado; devolve também o conjunto novo a guardar
// (some o que deixou de ser significativo, então reaparece se voltar).
export function novosResultadosAB(
  leituras: Record<string, LeituraAB>,
  jaAvisados: string[]
): { novos: { chave: string; lider: VarianteAssunto; texto: string }[]; atuais: string[] } {
  const atuais: string[] = [];
  const novos: { chave: string; lider: VarianteAssunto; texto: string }[] = [];
  for (const [chave, l] of Object.entries(leituras)) {
    if (!l.significativo || !l.lider) continue;
    const marca = `${chave}:${l.lider}`;
    atuais.push(marca);
    if (!jaAvisados.includes(marca)) novos.push({ chave, lider: l.lider, texto: l.texto });
  }
  return { novos, atuais };
}

export function assuntoDoLembrete(
  tipo: 1 | 2,
  variante: VarianteAssunto,
  percentual?: number
): string {
  if (tipo === 2) {
    return variante === "A"
      ? `${percentual}% de desconto no seu carrinho — LeoKibrindes`
      : `Última chance: ${percentual}% OFF nos itens que você escolheu`;
  }
  return variante === "A"
    ? "Você esqueceu itens no carrinho — LeoKibrindes"
    : "Seus itens estão guardados pra você 🎁";
}

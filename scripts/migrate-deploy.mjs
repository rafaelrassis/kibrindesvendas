// Aplica as migrations pendentes durante o build (ver package.json#build).
//
// Duas coisas que o `prisma migrate deploy` puro não resolve sozinho aqui:
//
// 1. Conexão direta. O `DATABASE_URL` da Vercel aponta pro pooler do Neon
//    (host `...-pooler...`), e o pgbouncer atende cada comando numa conexão
//    de servidor diferente. O `migrate deploy` começa pegando um advisory
//    lock, que é de sessão: pelo pool ele às vezes não é liberado junto com o
//    cliente e fica preso na conexão devolvida, derrubando o build seguinte
//    com `P1002 Timed out trying to acquire a postgres advisory lock`. Foi o
//    que quebrou o deploy de produção do commit 745138e, minutos depois do
//    preview ter migrado o mesmo banco sem erro. Então, se houver uma URL
//    direta no ambiente, a migration roda por ela — o app em si continua
//    usando o pooler, que é o certo pra serverless.
//
// 2. Nova tentativa. O compute do Neon suspende sozinho quando fica ocioso, e
//    acordar pode passar dos 10s que o Prisma espera pelo lock. Isso é falha
//    de conexão, não de migration: vale tentar de novo em vez de reprovar o
//    build. Erro de SQL, esse falha de primeira.
import { spawnSync } from "node:child_process";

// Nomes usados por quem injeta a URL sem pool: `DIRECT_URL` é a convenção do
// Prisma, as outras duas vêm prontas da integração Neon/Postgres da Vercel.
const NOMES_URL_DIRETA = ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];

// Só falha transitória de conexão entra aqui — o build não deve insistir em
// cima de migration inválida.
const ERROS_TRANSITORIOS = [
  "P1001", // não conseguiu alcançar o banco
  "P1002", // alcançou e deu timeout (inclui o timeout do advisory lock)
  "P1008", // estourou o tempo da operação
  "P1017", // o servidor encerrou a conexão
];

const TENTATIVAS = 3;
const ESPERA_MS = [5000, 15000];

function urlDireta() {
  for (const nome of NOMES_URL_DIRETA) {
    const valor = process.env[nome]?.trim();
    if (valor) return { nome, valor };
  }
  return null;
}

function dormir(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const direta = urlDireta();
const env = { ...process.env };

if (!direta) {
  console.log(
    "[migrate] Sem URL direta no ambiente " +
      `(${NOMES_URL_DIRETA.join(", ")}); usando DATABASE_URL como está. ` +
      "Se ela for a URL de pool, configure uma delas com a conexão direta."
  );
} else if (direta.valor === env.DATABASE_URL) {
  console.log(`[migrate] ${direta.nome} é igual ao DATABASE_URL; nada a trocar.`);
} else {
  console.log(`[migrate] Aplicando as migrations pela conexão direta de ${direta.nome}.`);
  env.DATABASE_URL = direta.valor;
}

for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
  const { status, stderr } = spawnSync("prisma", ["migrate", "deploy"], {
    // stderr capturado pra reconhecer o código do erro; o resto segue direto
    // pro log do build.
    stdio: ["inherit", "inherit", "pipe"],
    encoding: "utf8",
    env,
  });

  if (stderr) process.stderr.write(stderr);
  if (status === 0) process.exit(0);

  const transitorio = ERROS_TRANSITORIOS.some((codigo) => stderr?.includes(codigo));
  if (!transitorio || tentativa === TENTATIVAS) process.exit(status ?? 1);

  const espera = ESPERA_MS[tentativa - 1];
  console.log(
    `[migrate] Falha de conexão na tentativa ${tentativa} de ${TENTATIVAS}; ` +
      `tentando de novo em ${espera / 1000}s.`
  );
  dormir(espera);
}

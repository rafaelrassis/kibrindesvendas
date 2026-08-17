# Ki Brindes Vendas

Repositório do projeto **Ki Brindes Vendas**.

## Status

Fluxo completo de compra e personalização lendo catálogo do PostgreSQL via
Prisma, com contas de usuário reais (cadastro, login e troca de senha em
sessão por cookie). Carrinho e favoritos ainda são mock, em `localStorage`.
Pedidos e pagamento seguem sem back-end real.

## Como começar

```bash
git clone https://github.com/rafaelrassis/kibrindesvendas.git
cd kibrindesvendas
npm install
npm run dev
```

## Banco de dados (Prisma + PostgreSQL)

O schema está modelado em `prisma/schema.prisma` (categorias, produtos,
variações, usuários, pedidos, itens e personalização). O catálogo das telas vem
do banco: as queries ficam em `src/lib/data/` e o app **não sobe sem
`DATABASE_URL`**.

```bash
cp .env.example .env          # ajuste DATABASE_URL e SESSION_SECRET
npm run db:push               # cria as tabelas no banco
npm run db:seed               # popula categorias e produtos com o mock-data
```

`npm run db:generate` regenera o Prisma Client. A configuração do CLI fica em
`prisma.config.ts` (o `package.json#prisma` foi descontinuado no Prisma 7).

### Como as telas leem os dados

`src/lib/data/` é server-only (marcado com `server-only`): quem consome direto
são os Server Components (home, categorias, busca, comparativo, admin/produtos).
As telas que são Client Component — produto, personalizar, checkout, favoritos e
admin/categorias — passam pelas rotas em `src/app/api/` usando os hooks de
`src/lib/use-produto.ts`.

`src/lib/mock-data.ts` deixou de ser fonte de dados da aplicação: sobrou como
seed do banco (`prisma/seed.ts`) e como origem das FAQs do `/suporte`.

## Contas e sessão

Cadastro (`/cadastro`) e login (`/entrar`) gravam em `Usuario` no banco, com a
senha em hash `bcrypt` (`src/lib/data/usuarios.ts`). A sessão é um cookie
`httpOnly` assinado com HMAC-SHA256 usando `SESSION_SECRET` — sem esse
segredo as rotas de auth quebram de propósito, para não haver fallback
inseguro. O ciclo todo fica em `src/lib/session.ts` e nas rotas
`src/app/api/auth/` (`registro`, `login`, `logout`, `me`, `senha`); no client,
`useAuth()` (`src/lib/auth-context.tsx`) lê `/api/auth/me` no primeiro render.

O resto do perfil (telefone, CPF, endereços, preferências) continua local em
`localStorage`, via `conta-context`.

## Estrutura

```
src/
├── app/
│   ├── page.tsx                  # home
│   ├── categoria/[slug]/         # listagem por categoria
│   ├── produto/[id]/             # detalhe + variações
│   ├── personalizar/[id]/        # 3 vias: IA / upload / manual
│   ├── checkout/                 # resumo + pagamento (mock)
│   ├── pedido/confirmado/
│   ├── suporte/                  # FAQ
│   ├── admin/                    # stubs de produtos e pedidos
│   ├── entrar/ e cadastro/       # login e criação de conta
│   └── api/                      # catálogo + auth (JSON p/ client components)
├── components/                   # Header, Footer, ProductCard
└── lib/
    ├── data/                     # queries Prisma (server-only)
    ├── session.ts                # cookie de sessão assinado (server-only)
    ├── prisma.ts                 # PrismaClient singleton
    ├── types.ts                  # Produto, Categoria, Variacao
    ├── use-produto.ts            # hooks de catálogo p/ client components
    └── mock-data.ts              # seed do banco + FAQs
```

## Próximos passos

- [x] Mock visual do fluxo completo (produto → personalização → checkout)
- [ ] Validar telas com o time da loja
- [x] Modelar o schema Prisma + seed a partir do mock-data
- [x] Trocar mock-data por Prisma + PostgreSQL nas telas (Fase 1 da spec)
- [x] Autenticação real (cadastro, login, sessão em cookie, troca de senha)
- [ ] Persistir carrinho, favoritos e pedidos no banco
- [ ] Configurar ambiente de desenvolvimento (variáveis de ambiente, deploy)
- [ ] Configurar testes e integração contínua

## Convenções

- Branch principal: `main`
- Branches de trabalho: `feat/...`, `fix/...`, `chore/...`
- Segredos e credenciais **nunca** devem ser commitados — use arquivos `.env`
  locais (já ignorados pelo `.gitignore`).

# Ki Brindes Vendas

Repositório do projeto **Ki Brindes Vendas**.

## Status

Fluxo completo de compra e personalização lendo catálogo do PostgreSQL via
Prisma, com contas de usuário reais (cadastro, login e troca de senha em
sessão por cookie), pedidos gravados no banco, upload real da arte do cliente
e área interna (`/admin`) que edita catálogo de verdade. Carrinho e favoritos
ainda são mock, em `localStorage`; o pagamento continua simulado.

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
são os Server Components (home, categorias, busca, comparativo, admin/pedidos e
a edição de produto). As telas que são Client Component — produto,
personalizar, checkout, favoritos, admin/produtos e admin/categorias — passam
pelas rotas em `src/app/api/` usando os hooks de `src/lib/use-produto.ts`.

Toda escrita também mora em `src/lib/data/`: as rotas só autenticam, chamam a
função e traduzem `ErroDeNegocio` (`src/lib/data/erros.ts`) pro JSON de erro.

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

## Área interna (`/admin`)

`/admin` edita o catálogo de verdade: cadastro, edição e remoção de produtos
(com variações), CRUD de categorias e a fila de pedidos com a personalização
de cada item.

O acesso é restrito por `Usuario.admin`. Depois de criar a conta em
`/cadastro`, promova ela uma vez:

```bash
npm run db:admin -- voce@exemplo.com            # vira admin
npm run db:admin -- voce@exemplo.com --remover  # volta a ser cliente
```

Sem isso, `/admin` manda pra `/restrito` e as rotas `/api/admin/*` devolvem
401 (sem sessão) ou 403 (sessão sem `admin`). As duas guardas ficam em
`src/lib/admin.ts`: `exigirAdmin()` nas telas e `bloqueioAdmin()` nas rotas.

`exigirAdmin()` é chamado **dentro de cada página de servidor**, antes de
qualquer query, e não só no layout: barrar apenas no layout esconde o
resultado na tela, mas a página roda de todo jeito e o que ela renderizou
(nome, e-mail e pedidos dos clientes) viaja no payload da resposta. O layout
continua lá como rede de segurança pras telas que são Client Component.

O link "Admin" no header só aparece pra quem é admin.

Remoções são bloqueadas quando quebrariam histórico: categoria com produtos
(409) e produto que já está em algum pedido (409).

## Arte enviada pelo cliente

Na via "Enviar arte pronta" de `/personalizar/[id]`, o arquivo sobe na hora
via `POST /api/upload` (pede sessão) e só conta como arte pronta depois que o
servidor confirma — o nome aparece na tela na hora, mas o upload pode falhar.
Aceita PNG, JPG, WEBP e PDF até 15MB, e o formato é decidido pela **assinatura
do arquivo**, não pelo `type` que o navegador mandou nem pela extensão do nome
original: um HTML renomeado pra `.png` é recusado.

Os arquivos ficam em `var/uploads/artes/` (fora do git) com nome sorteado, e
quem serve é `GET /api/artes/[nome]`, que exige sessão. Dois motivos pra não
usar `public/`: em produção o Next indexa `public/` quando sobe, então arte
gravada depois disso só apareceria no próximo restart; e arte de cliente não
deve ficar em URL aberta. A fila em `/admin/pedidos` linka a arte de cada
item ("ver arte enviada").

⚠️ Disco local não sobrevive a deploy em plataforma serverless (ex.: Vercel):
na etapa de deploy isso vira um bucket (Vercel Blob, S3), trocando
`src/lib/artes.ts`.

## Pedidos

`/checkout` grava o pedido via `POST /api/pedidos` em nome do usuário logado
(quem tem sacola e não tem sessão é mandado pro login antes do resumo). O
pagamento ainda é simulado — o pedido nasce `PAGO` só pra o fluxo seguir até
a fila de produção em `/admin/pedidos`. A tela `/conta/pedidos` do cliente
ainda mostra a lista mock; ligar ela no banco é o próximo passo natural.

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
│   ├── entrar/ e cadastro/       # login e criação de conta
│   ├── admin/                    # área interna (produtos, categorias, pedidos)
│   └── api/                      # catálogo, auth, pedidos e admin (JSON)
├── components/                   # Header, Footer, ProductCard
└── lib/
    ├── data/                     # queries Prisma (server-only)
    ├── admin.ts                  # guardas de /admin e /api/admin (server-only)
    ├── artes.ts                  # validação e gravação das artes (server-only)
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
- [x] Admin com CRUD de catálogo no banco + pedidos gravados no checkout
- [x] Upload real da arte do cliente (validado por assinatura, servido com sessão)
- [ ] Persistir carrinho e favoritos no banco, e ligar /conta/pedidos no banco
- [ ] Pagamento de verdade (hoje o pedido nasce PAGO)
- [ ] Trocar disco local por bucket antes do deploy (artes)
- [ ] Configurar ambiente de desenvolvimento (variáveis de ambiente, deploy)
- [ ] Configurar testes e integração contínua

## Convenções

- Branch principal: `main`
- Branches de trabalho: `feat/...`, `fix/...`, `chore/...`
- Segredos e credenciais **nunca** devem ser commitados — use arquivos `.env`
  locais (já ignorados pelo `.gitignore`).

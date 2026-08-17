# Ki Brindes Vendas

Repositório do projeto **Ki Brindes Vendas**.

## Status

Fluxo completo de compra e personalização lendo catálogo do PostgreSQL via
Prisma, com contas de usuário reais (cadastro, login e troca de senha em
sessão por cookie), pedidos gravados no banco, upload real da arte do cliente,
favoritos e notificações no perfil, área interna (`/admin`) que edita catálogo
de verdade, move o pedido de status e monta o carrossel da home, pagamento real
pelo Mercado Pago (Pix, cartão e boleto) e entrega com frete por CEP e
devolução pedida pelo cliente. O carrinho ainda é mock, em `localStorage`.

## Como começar

```bash
git clone https://github.com/rafaelrassis/kibrindesvendas.git
cd kibrindesvendas
npm install
npm run dev
```

## Banco de dados (Prisma + PostgreSQL)

O schema está modelado em `prisma/schema.prisma` (categorias, produtos,
variações, usuários, favoritos, notificações, pedidos, itens, personalização e
banners da home). O catálogo das telas vem
do banco: as queries ficam em `src/lib/data/` e o app **não sobe sem
`DATABASE_URL`**.

```bash
cp .env.example .env          # ajuste DATABASE_URL e SESSION_SECRET
npm run db:deploy             # aplica as migrations existentes
npm run db:seed               # popula categorias e produtos com o mock-data
```

O histórico do schema vive em `prisma/migrations/` (versionado). Depois de
mexer em `schema.prisma`, `npm run db:migrate` gera a migration nova e aplica
no banco local; `npm run db:deploy` (`prisma migrate deploy`) só aplica o que
já existe e é o comando de CI e de produção — nunca `db push`, que altera o
banco sem deixar rastro.

`npm run db:generate` regenera o Prisma Client. A configuração do CLI fica em
`prisma.config.ts` (o `package.json#prisma` foi descontinuado no Prisma 7).

### Como as telas leem os dados

`src/lib/data/` é server-only (marcado com `server-only`): quem consome direto
são os Server Components (home, categorias, busca, comparativo, admin/pedidos e
a edição de produto). As telas que são Client Component — produto,
personalizar, checkout, favoritos, notificações, admin/produtos e
admin/categorias — passam pelas rotas em `src/app/api/`, pelo hook de
`src/lib/use-produto.ts` ou pelos contexts de favoritos e notificações.

Toda escrita também mora em `src/lib/data/`: as rotas só autenticam, chamam a
função e traduzem `ErroDeNegocio` (`src/lib/data/erros.ts`) pro JSON de erro.

`src/lib/mock-data.ts` deixou de ser fonte de dados da aplicação: sobrou como
seed do banco (`prisma/seed.ts`, catálogo e banners) e como origem das FAQs do
`/suporte`.

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
(com variações), CRUD de categorias, a fila de pedidos com a personalização de
cada item e os banners da home.

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

### Banners da home

O carrossel do topo da loja sai do banco (`model Banner`), não do código:
`/admin/banners` cria, edita, reordena com as setas, desativa sem apagar e
remove os slides. Cada slide é um título com eyebrow, selo de preço e link de
destino, sobre uma imagem ou uma cor lisa.

Três coisas são validadas no servidor, em `src/lib/data/banners.ts`, e não só
no formulário — as três vão parar dentro do HTML da home:

- **link de destino**: só caminho da loja (começa com `/`), pra um banner não
  virar redirecionamento pra fora;
- **cor de fundo**: `#RRGGBB`;
- **imagem**: só URL que o próprio upload devolveu (ver abaixo).

A ordem é gravada de uma vez (`PUT /api/admin/banners` com a lista de ids na
ordem nova), então nenhuma gravação pela metade deixa dois slides na mesma
posição. Sem nenhum banner ativo a home simplesmente não mostra o carrossel.

A home é prerenderizada, e por isso declara `revalidate = 60`: o que a loja
muda em `/admin` aparece no próximo minuto. Sem isso, o HTML gerado no build
ficaria valendo até o próximo deploy.

O seed cria três banners iniciais (`src/lib/mock-data.ts`) e não mexe mais
neles depois — rodar `npm run db:seed` de novo não desfaz o que a loja editou.

## Arte enviada pelo cliente

Na via "Enviar arte pronta" de `/personalizar/[id]`, o arquivo sobe na hora
via `POST /api/upload` (pede sessão) e só conta como arte pronta depois que o
servidor confirma — o nome aparece na tela na hora, mas o upload pode falhar.
Aceita PNG, JPG, WEBP e PDF até 15MB, e o formato é decidido pela **assinatura
do arquivo**, não pelo `type` que o navegador mandou nem pela extensão do nome
original: um HTML renomeado pra `.png` é recusado.

Onde o arquivo é gravado depende do ambiente, e quem decide é
`src/lib/artes.ts`:

- **Produção**, com `BLOB_READ_WRITE_TOKEN`: Vercel Blob, em `artes/<nome>` e
  com `access: "private"`. O filesystem de um deploy serverless é efêmero e não
  é compartilhado entre instâncias, então disco não serve.
- **Dev local**, sem o token: `var/uploads/artes/` (fora do git). Fora de
  `public/` de propósito — o Next indexa `public/` quando sobe, então arte
  gravada depois disso só apareceria no próximo restart.

Nos dois casos o nome é sorteado e quem serve é `GET /api/artes/[nome]`, que
exige sessão: arte de cliente não fica em URL aberta — por isso o blob é
privado e não público. A fila em `/admin/pedidos` linka a arte de cada item
("ver arte enviada").

### Imagem da loja (banner) é outro caminho

A imagem do banner precisa abrir pra visitante deslogado, então ela não pode
dividir depósito com a arte do cliente: sobe por `POST /api/admin/imagens`
(**só admin**, PNG/JPG/WEBP até 5MB) e é servida por `GET /api/imagens/[nome]`,
sem sessão e com cache longo — o nome é sorteado e nunca muda. A gravação e a
checagem por assinatura são as mesmas das artes, compartilhadas em
`src/lib/arquivos.ts`; o que muda é a pasta (`imagens/`) e quem pode ler.

## Pedidos e pagamento (Mercado Pago)

`/checkout` grava o pedido via `POST /api/pedidos` em nome do usuário logado
(quem tem sacola e não tem sessão é mandado pro login antes do resumo). A rota
devolve `checkoutUrl` e o cliente segue pra lá:

- **Com `MERCADOPAGO_ACCESS_TOKEN`** — o pedido nasce `AGUARDANDO_PAGAMENTO` e
  o `checkoutUrl` é a página hospedada do Mercado Pago (Checkout Pro). Pix,
  cartão e boleto acontecem lá, então nenhum dado de cartão passa pelo site.
- **Sem o token** — modo simulado: o pedido nasce `PAGO`, é marcado com
  `pagamentoMock` e o `checkoutUrl` já é a tela de confirmação. É o modo de
  dev e demo, e a fila em `/admin/pedidos` mostra o selo "simulado".

Quem confirma o pagamento é o webhook em `POST /api/webhooks/mercadopago`, não
a volta do cliente ao site: ele recebe o id do pagamento, consulta o Mercado
Pago (a fonte da verdade), atualiza o status do pedido e cria uma notificação
pro cliente. Reentregas do mesmo evento são ignoradas, e um pedido que já
saiu de `AGUARDANDO_PAGAMENTO` não volta pra trás. Com
`MERCADOPAGO_WEBHOOK_SECRET` configurado a assinatura (`x-signature`) é
conferida antes de qualquer coisa.

`/pedido/confirmado?id=...` mostra o status real do pedido e, enquanto ele
estiver aguardando, recarrega sozinha até o webhook chegar (Pix cai em
segundos; boleto pode levar dias, e aí o aviso chega em `/notificacoes`).

Em dev o Mercado Pago não alcança `localhost`: pra testar o webhook de ponta a
ponta é preciso um túnel (ex: ngrok) e `NEXT_PUBLIC_BASE_URL` apontando pra
URL pública dele.

## Entrega e devolução

O checkout pede o CEP antes de deixar pagar. `GET /api/cep/[cep]` consulta o
ViaCEP, devolve o endereço e o frete calculado por região (`src/lib/frete.ts`),
e a tela soma tudo: produto + frete = total. Quem já tem endereço padrão salvo
chega com o CEP preenchido; o mesmo endpoint preenche rua, bairro, cidade e UF
no cadastro de endereço.

O valor que o navegador mostra é só visual: `POST /api/pedidos` recebe o CEP,
**não** o frete, e recalcula tudo no servidor antes de gravar — senão bastaria
editar a requisição pra pagar frete zero. O pedido guarda `frete`,
`enderecoCep` e `enderecoResumo` congelados no momento da compra (o cadastro do
cliente muda depois; o pedido tem que continuar mostrando pra onde foi), e a
fila do admin mostra o endereço de despacho. Com pagamento real o frete vai
como item separado na preferência do Mercado Pago, pra soma bater com o total.

> A tabela de frete é uma estimativa por região, não cotação de transportadora.
> A interface (`uf -> { valor, prazoDias }`) já está pronta pra trocar por
> Correios/Melhor Envio quando houver contrato.

`/conta/pedidos` e `/conta/pedidos/[id]` leem os pedidos reais do banco (a
lista mock saiu do `conta-data.ts`). Depois que o pedido é marcado como
`ENTREGUE`, o cliente pode pedir devolução pelo detalhe: `POST
/api/pedidos/[id]/devolucao` exige um motivo, confere que o pedido é dele e que
está entregue, move pra `DEVOLUCAO_SOLICITADA` e cria a notificação — tudo em
transação. Quem marca `DEVOLVIDO` é a loja, pelo `/admin/pedidos`, depois de
receber o produto de volta; o motivo informado aparece lá no card.

Os rótulos e cores de status vivem em `src/lib/status-pedido.ts`, um lugar só
pro select do admin, a lista do cliente e o detalhe do pedido.

## Favoritos e notificações

Favoritos e notificações são do usuário, não do navegador: saíram do
`localStorage` e viraram as tabelas `Favorito` (par único usuário + produto) e
`Notificacao`. Quem não está logado vê o convite pra entrar — e o coração de um
produto manda pro login guardando a página de volta em `?next=`.

O coração muda na hora e só depois confirma com o servidor (`POST
/api/favoritos` / `DELETE /api/favoritos/[produtoId]`); se a requisição falhar,
a lista volta pro que está gravado. Favoritar duas vezes é idempotente
(`upsert`), então clique repetido ou outra aba não viram erro.

As notificações são geradas pelo próprio fluxo, em transação com o que as
causou — o aviso não existe sem o pedido:

- pedido criado no modo simulado → "Pedido recebido!" (o texto muda quando o
  produto é personalizável e a arte entra na fila de validação). Com pagamento
  real quem avisa é o webhook, depois da confirmação: "Pagamento aprovado!" ou
  "Pagamento não aprovado";
- status mudado em `/admin/pedidos` → "Atualização do seu pedido". `PAGO` e
  `AGUARDANDO_PAGAMENTO` não avisam: o primeiro já foi anunciado pelo fluxo de
  pagamento e o segundo é volta atrás interna. Reenviar o mesmo status não
  repete o aviso;
- devolução pedida pelo cliente → "Devolução solicitada" (quem avisa é a
  própria solicitação, não a mudança de status, pra não duplicar).

O sininho do header mostra as não lidas e a tela `/notificacoes` marca como
lida no clique; os dois leem o mesmo `notificacoes-context`, então o contador
zera sem uma segunda requisição. `usuarioId` entra no `where` da escrita — sem
ele, qualquer sessão marcaria a notificação de outra pessoa passando o id.

## Estrutura

```
src/
├── app/
│   ├── page.tsx                  # home
│   ├── categoria/[slug]/         # listagem por categoria
│   ├── produto/[id]/             # detalhe + variações
│   ├── personalizar/[id]/        # 3 vias: IA / upload / manual
│   ├── checkout/                 # resumo + frete por CEP + ida pro Mercado Pago
│   ├── pedido/confirmado/        # status real do pedido
│   ├── conta/pedidos/            # pedidos reais + pedido de devolução
│   ├── favoritos/ e notificacoes/ # lista salva e avisos do pedido
│   ├── suporte/                  # FAQ
│   ├── entrar/ e cadastro/       # login e criação de conta
│   ├── admin/                    # área interna (produtos, categorias,
│   │                              # pedidos, banners)
│   └── api/                      # catálogo, auth, pedidos, favoritos,
│                                  # notificações, webhook e admin (JSON)
├── components/                   # Header, Footer, ProductCard
└── lib/
    ├── data/                     # queries Prisma (server-only)
    ├── admin.ts                  # guardas de /admin e /api/admin (server-only)
    ├── arquivos.ts               # assinatura + Blob/disco dos uploads (server-only)
    ├── artes.ts                  # arte do cliente, privada (server-only)
    ├── imagens.ts                # imagem da loja, pública (server-only)
    ├── mercadopago.ts            # clients + assinatura do webhook (server-only)
    ├── session.ts                # cookie de sessão assinado (server-only)
    ├── prisma.ts                 # PrismaClient singleton
    ├── types.ts                  # Produto, Categoria, Variacao, Pedido, Banner
    ├── frete.ts                  # tabela de frete por UF + formato do CEP
    ├── status-pedido.ts          # rótulos e cores do StatusPedido
    ├── use-produto.ts            # hooks de catálogo p/ client components
    ├── use-cep.ts                # consulta de CEP + frete p/ o checkout
    ├── use-pedidos.ts            # pedidos do usuário logado
    ├── favoritos-context.tsx     # favoritos do usuário (via /api/favoritos)
    ├── notificacoes-context.tsx  # avisos + contador do sininho
    └── mock-data.ts              # seed do banco + FAQs
```

## Deploy (Vercel)

1. Importar o repositório no dashboard da Vercel (ele detecta Next.js sozinho).
2. Provisionar um PostgreSQL (Vercel Postgres, Neon, Supabase — tanto faz) e um
   Blob Store, e vincular os dois ao projeto.
3. Preencher as variáveis do projeto: `DATABASE_URL`, `SESSION_SECRET`
   (`openssl rand -hex 32`, diferente do valor de dev) e
   `BLOB_READ_WRITE_TOKEN` (o Blob Store já injeta esse ao ser vinculado).
   Pro pagamento real, também `MERCADOPAGO_ACCESS_TOKEN`,
   `MERCADOPAGO_WEBHOOK_SECRET` e `NEXT_PUBLIC_BASE_URL` com o domínio de
   produção — as duas primeiras saem do painel de desenvolvedor do Mercado
   Pago, onde a URL de notificação deve ser cadastrada como
   `https://SEU-DOMINIO/api/webhooks/mercadopago`.
4. Aplicar as migrations no banco de produção — `npm run db:deploy` com
   `DATABASE_URL` apontando pra lá. Isso vai **antes** do primeiro deploy: o
   build prerenderiza páginas que consultam o banco e quebra se as tabelas não
   existem. Repetir a cada deploy que traga migration nova.
5. Deploy. O `postinstall` roda `prisma generate`, então o Prisma Client sai
   correto mesmo com o cache de dependências da Vercel.
6. Promover a primeira conta a admin com `npm run db:admin -- voce@exemplo.com`
   apontando pro banco de produção.

Sem `BLOB_READ_WRITE_TOKEN` o upload cai pro disco local — o app sobe, mas as
artes somem no deploy seguinte. Não deixar assim em produção. Sem
`MERCADOPAGO_ACCESS_TOKEN` o checkout sobe em modo simulado, ou seja, aprova
pedido sem cobrar ninguém: também não pode ficar assim em produção.

## CI

`.github/workflows/ci.yml` roda em push e pull request pra `main`: sobe um
Postgres descartável (service container), aplica migrations, popula o seed e
então roda lint, checagem de tipos e build. O banco não é opcional aqui — as
páginas prerenderizadas consultam o catálogo durante o `next build`.

`npm run typecheck` roda `next typegen` antes do `tsc --noEmit`, porque os
tipos de rota que o `layout.tsx` usa são gerados pelo Next em `.next/types/`.

## Próximos passos

- [x] Mock visual do fluxo completo (produto → personalização → checkout)
- [ ] Validar telas com o time da loja
- [x] Modelar o schema Prisma + seed a partir do mock-data
- [x] Trocar mock-data por Prisma + PostgreSQL nas telas (Fase 1 da spec)
- [x] Autenticação real (cadastro, login, sessão em cookie, troca de senha)
- [x] Admin com CRUD de catálogo no banco + pedidos gravados no checkout
- [x] Upload real da arte do cliente (validado por assinatura, servido com sessão)
- [x] Trocar disco local por bucket nas artes (Vercel Blob, privado)
- [x] Migrations versionadas e integração contínua (lint + tipos + build)
- [x] Favoritos no banco e notificações de pedido (criação e mudança de status)
- [x] Pagamento de verdade (Mercado Pago Checkout Pro + webhook + notificações)
- [x] Envio (frete por CEP no checkout) e devolução pedida pelo cliente, com
      `/conta/pedidos` lendo o banco
- [x] Banners da home cadastrados em `/admin/banners`, com imagem pública
- [ ] Persistir o carrinho no banco
- [ ] Cotação real de frete (Correios / Melhor Envio) no lugar da tabela por
      região, e rastreio do envio no detalhe do pedido
- [ ] Guardar a sacola até o pagamento confirmar (hoje ela é limpa na ida pro
      Mercado Pago, então voltar de um pagamento recusado exige montar de novo)
- [ ] Subir a primeira versão em produção (Vercel + Postgres + Blob Store)
- [ ] Testes automatizados (o CI hoje só garante lint, tipos e build)

## Convenções

- Branch principal: `main`
- Branches de trabalho: `feat/...`, `fix/...`, `chore/...`
- Segredos e credenciais **nunca** devem ser commitados — use arquivos `.env`
  locais (já ignorados pelo `.gitignore`).

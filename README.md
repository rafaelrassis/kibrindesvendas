# Ki Brindes Vendas

Repositório do projeto **Ki Brindes Vendas**.

## Status

Fluxo completo de compra e personalização lendo catálogo do PostgreSQL via
Prisma, com contas de usuário reais (cadastro, login e troca de senha em
sessão por cookie), pedidos gravados no banco, upload real da arte do cliente,
favoritos e notificações no perfil, área interna (`/admin`) com painel de
vendas, que edita catálogo de verdade (inclusive ligando e desligando o
comparativo de preço da Shopee por produto), move o pedido de status e monta o
carrossel da home, pagamento real pelo Mercado Pago (Pix, cartão e boleto) e
entrega com frete cotado nos Correios pelo CEP, rastreio do envio e devolução
pedida pelo cliente. O carrinho persiste no banco pra quem está logado (e
continua em `localStorage` pra visitante) e só é esvaziado quando o pagamento
é confirmado.

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
são os Server Components (home, categorias, busca, comparativo, o painel e a
fila de pedidos do admin e a edição de produto). As telas que são Client
Component — produto, personalizar, checkout, favoritos, notificações,
admin/produtos e admin/categorias — passam pelas rotas em `src/app/api/`,
pelo hook de
`src/lib/use-produto.ts` ou pelos contexts de favoritos e notificações.

Toda escrita também mora em `src/lib/data/`: as rotas só autenticam, chamam a
função e traduzem `ErroDeNegocio` (`src/lib/data/erros.ts`) pro JSON de erro.

`src/lib/mock-data.ts` deixou de ser fonte de dados da aplicação: sobrou como
seed do banco (`prisma/seed.ts`, catálogo e banners) e como origem das FAQs do
`/suporte`.

## Contas e sessão

Cadastro (`/cadastro`) e login (`/entrar`) gravam em `Usuario` no banco, com a
senha em hash `bcrypt` (`src/lib/data/usuarios.ts`). O cadastro pede CPF, que é
validado no client e de novo na API (`src/lib/cpf.ts` — formato, dígitos
verificadores e sequências repetidas) e gravado só com os dígitos, único por
conta. A coluna é nullable no banco para não quebrar contas criadas antes
disso; a obrigatoriedade vale na rota de registro. O CPF não sai no payload
público de `/api/auth/me`. A sessão é um cookie
`httpOnly` assinado com HMAC-SHA256 usando `SESSION_SECRET` — sem esse
segredo as rotas de auth quebram de propósito, para não haver fallback
inseguro. O ciclo todo fica em `src/lib/session.ts` e nas rotas
`src/app/api/auth/` (`registro`, `login`, `logout`, `me`, `senha`); no client,
`useAuth()` (`src/lib/auth-context.tsx`) lê `/api/auth/me` no primeiro render.

O resto do perfil (telefone, aniversário, CPF, endereços e preferências de
notificação) mora em `Usuario` e `Endereco` no banco, um por usuário logado —
sem `localStorage`, pra um dado salvo no celular aparecer no desktop também.
`/conta/dados` edita o CPF de verdade (o mesmo gravado no registro): mudou de
ser um campo à parte no perfil local. O e-mail continua fora dessa tela, só
trocado pelo fluxo de segurança (com senha). As queries e validações ficam em
`src/lib/data/conta.ts`, as rotas em `src/app/api/conta/` (`perfil`,
`preferencias`, `enderecos`) e o client lê tudo por `useConta()`
(`src/lib/conta-context.tsx`), que busca os três recursos ao logar e limpa o
estado no logout. Só um endereço pode ser padrão por usuário — regra aplicada
em `data/conta.ts`, não por constraint no banco.

## Área interna (`/admin`)

`/admin` abre no painel de vendas e edita o catálogo de verdade: cadastro,
edição e remoção de produtos (com variações), CRUD de categorias, a fila de
pedidos com a personalização de cada item, os banners da home e as
configurações operacionais da loja.

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

### Painel (`/admin`)

Os números dos últimos 30 dias: vendas, pedidos pagos, ticket médio e taxa de
devolução em cartões, mais os gráficos de vendas por dia, pedidos por status e
os cinco produtos mais vendidos. A consulta fica em `src/lib/data/dashboard.ts`
e os gráficos (recharts) em `src/components/AdminDashboardCharts.tsx` — a única
parte da tela que roda no navegador.

Duas decisões que valem saber ao ler os números:

- **Só pedido pago entra no faturamento.** `AGUARDANDO_PAGAMENTO` e
  `CANCELADO` ficam de fora; devolvido continua contando como venda do período
  (o dinheiro chegou a entrar) e reaparece na taxa de devolução. O mapa é
  status por status, então criar um novo `StatusPedido` quebra o build até
  alguém decidir de que lado ele fica.
- **O dia é o de Brasília.** O servidor roda em UTC: sem fixar o fuso, um
  pedido das 21h entraria no gráfico como venda do dia seguinte.

A soma por produto é feita pelo banco (`groupBy`), não em memória.

### Comparativo de preço por produto (`vendidoNaShopee`)

O que faz o site mostrar "na Shopee R$ X" e o selo de desconto é
`compararPreco()` (`src/lib/compare-price.ts`), e ela só compara quando o
produto **é vendido na Shopee**. Esse liga/desliga é o campo
`Produto.vendidoNaShopee` (padrão `true`): fica no formulário de produto e
também como botão direto na lista de `/admin/produtos`, pra loja tirar o
comparativo de um item sem abrir a edição.

Desligado, o comparativo some da vitrine, do produto, do checkout e da
`/comparativo` mesmo que `precoShopee` continue preenchido — o preço antigo
fica guardado pra quando o item voltar pra plataforma, em vez de virar um
desconto inventado. O único lugar que continua mostrando `precoShopee` é o
formulário do admin.

Como a regra mora numa função só, ninguém consegue exibir o preço da Shopee
por outro caminho: as telas leem `comparacao.mostrar` e não `precoShopee`
direto.

### Fotos e vídeo do produto (e imagem da categoria)

O catálogo não depende mais de emoji pra ter cara de loja:

- **Produto** aceita até **4 fotos** (PNG/JPG/WEBP, 5MB cada) e **1 vídeo**
  (MP4, 30MB), cadastrados no formulário de `/admin/produtos`. A ordem das
  fotos é a ordem de exibição, e a primeira é a que aparece na vitrine, na
  busca, nas prateleiras da home e no comparativo. A página do produto monta
  uma galeria com miniaturas quando há mais de um arquivo, com o vídeo no fim
  da fila.
- **Categoria** troca o campo `emoji` por `imagemUrl`: a loja sobe a imagem em
  `/admin/categorias` e ela aparece na home, em `/categorias`, no menu do
  header e no topo da página da categoria.

Nos dois casos o cadastro é opcional e o site continua funcionando sem ele:
produto sem foto cai no emoji + cor de sempre (o campo continua no formulário,
agora rotulado como reserva) e categoria sem imagem mostra um 🎁 genérico.

O arquivo sobe assim que é escolhido e o formulário guarda só a URL devolvida
pelo servidor — o mesmo desenho do banner. Por isso a camada de dados
(`src/lib/data/produtos.ts` e `categorias.ts`) valida a URL antes de gravar
com `ehUrlDeImagem`/`ehUrlDeVideo`: só passa endereço que **nós** devolvemos
no upload, nunca um digitado. Ali também mora o limite de 4 fotos, pro teto
não depender só do que o formulário deixa clicar.

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

A home é prerenderizada, e por isso declara `revalidate = 60`: sem isso, o HTML
gerado no build ficaria valendo até o próximo deploy. Mas esperar o minuto
vencer é ruim pra quem acabou de salvar algo no `/admin` e volta na loja pra
conferir — por isso as rotas de escrita de banner, produto e categoria chamam
`revalidatePath("/")` depois de gravar, junto das outras páginas afetadas
(`/categorias`, `/categoria/[slug]`, `/produto/[id]`, que não têm janela de
revalidação nenhuma e ficariam paradas até o próximo deploy). O `revalidate =
60` continua valendo como rede de segurança pro que muda fora do admin.

O seed cria três banners iniciais (`src/lib/mock-data.ts`) e não mexe mais
neles depois — rodar `npm run db:seed` de novo não desfaz o que a loja editou.

### Configurações da loja (`/admin/configuracoes`)

Tabela de uma linha só (`ConfiguracaoLoja`, id fixo `singleton`) com o que a
loja precisa mudar sem redeploy: o CEP de onde os Correios buscam a encomenda e
o token da conta Melhor Envio usada na cotação. O token entra por campo de
senha e **nunca volta inteiro** pela API — a tela só recebe se está cadastrado
e os 4 últimos caracteres, o suficiente pra conferir sem expor o segredo.
Salvar com o campo em branco mantém o token atual em vez de apagá-lo.

## Personalização: as duas vias

`/personalizar/[id]` abre com duas saídas, e as duas só liberam o botão de
pagamento depois de um aceite explícito:

- **Enviar arte pronta** — upload do arquivo final (detalhado na seção
  seguinte).
- **Criar com a gente** — abre o WhatsApp da loja com a conversa já começada:
  a mensagem leva o nome do produto e as variações escolhidas no carrinho, pra
  ninguém ter que repetir o pedido. Só depois de abrir a conversa é que o
  aceite aparece e o checkout libera.

O número sai de `NEXT_PUBLIC_WHATSAPP_LOJA` (só dígitos, com DDI — ex:
`5511999999999`). Sem a variável a tela mostra um aviso no lugar do botão, em
vez de gerar um link `wa.me` quebrado.

A geração por IA continua no tipo `ViaPersonalizacao` (`src/lib/cart-context.tsx`)
mas está fora da seleção: o que existia era só uma simulação de prévia, sem IA
de verdade atrás.

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

### Imagem da loja (banner, categoria, produto) é outro caminho

A imagem do banner precisa abrir pra visitante deslogado, então ela não pode
dividir depósito com a arte do cliente: sobe por `POST /api/admin/imagens`
(**só admin**, PNG/JPG/WEBP até 5MB) e é servida por `GET /api/imagens/[nome]`,
sem sessão e com cache longo — o nome é sorteado e nunca muda. A gravação e a
checagem por assinatura são as mesmas das artes, compartilhadas em
`src/lib/arquivos.ts`; o que muda é a pasta (`imagens/`) e quem pode ler. A
imagem da categoria e as fotos do produto entram por essa mesma porta.

O vídeo do produto segue o mesmo caminho em `src/lib/video.ts`: `POST
/api/admin/videos` (MP4, até 30MB) e `GET /api/videos/[nome]`, gravando no
mesmo depósito público. MP4 é o único formato aqui, e ele é reconhecido pelo
marcador `ftyp` no offset 4 — os quatro primeiros bytes do arquivo são o
tamanho da box, que varia, então não dá pra conferir assinatura fixa no
início como nos outros formatos.

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

`SIMULAR_PAGAMENTO=true` força esse segundo caso mesmo com o token
configurado, pra testar o fluxo de compra sem cobrar e sem apagar a
credencial. É só override: sozinha ela nunca liga o pagamento real. Em
produção não pode ficar ligada — todo pedido nasceria `PAGO` sem cobrança.

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

### A sacola só é esvaziada quando o pagamento é confirmado

Criar o pedido não limpa a sacola — só um pagamento confirmado limpa
(`LimparCarrinhoAoConfirmar`, em `/pedido/confirmado`, dispara quando o status
chega em `PAGO`). Assim, quem volta de um pagamento recusado ou de um boleto
ainda não pago encontra o item de novo em vez de ter que montar o pedido do
zero. `registrarRetornoDoPagamento` (o webhook) também esvazia a sacola
gravada no banco quando confirma o pagamento — cobre o caso de o cliente ter
fechado a aba antes da confirmação chegar (boleto, que pode levar dias).

## Entrega e devolução

O checkout pede o CEP antes de deixar pagar. `GET /api/cep/[cep]` consulta o
ViaCEP, devolve o endereço e o frete, e a tela soma tudo: produto + frete =
total. Quem já tem endereço padrão salvo chega com o CEP preenchido; o mesmo
endpoint preenche rua, bairro, cidade e UF no cadastro de endereço.

Com `?produtoId=`, a rota cota o frete **real** dos Correios pelo Melhor Envio
(`cotarFreteMelhorEnvio` em `src/lib/frete.ts`): API REST, sem contrato prévio,
que devolve PAC/SEDEX com preço e prazo da rota. A tela do produto e o checkout
mandam o id porque conhecem o item; o cadastro de endereço avulso não manda,
porque ali não há pacote pra cotar. Fica sempre a opção mais barata entre as
que a API aceitou (as com `error` saem fora, ex: transportadora que não atende
a rota).

O valor que o navegador mostra é só visual: `POST /api/pedidos` recebe o CEP,
**não** o frete, e recalcula tudo no servidor antes de gravar — senão bastaria
editar a requisição pra pagar frete zero. O pedido guarda `frete`,
`enderecoCep` e `enderecoResumo` congelados no momento da compra (o cadastro do
cliente muda depois; o pedido tem que continuar mostrando pra onde foi), e a
fila do admin mostra o endereço de despacho. Com pagamento real o frete vai
como item separado na preferência do Mercado Pago, pra soma bater com o total.

A cotação real depende de três coisas cadastradas: o token do Melhor Envio e o
CEP de origem em `/admin/configuracoes`, e o peso/dimensões da embalagem no
cadastro do produto. Faltando qualquer uma delas — ou se a API não responder em
8s, devolver erro ou não sobrar nenhuma opção — o cálculo cai na estimativa por
região (`calcularFrete`, tabela `uf -> { valor, prazoDias }`). O cliente nunca
fica sem número de frete, e nada nesse caminho pode derrubar o checkout.

> Pacote menor que o mínimo dos Correios (16x11x2cm) é arredondado pra cima
> antes de cotar, senão a cotação volta vazia.

`/conta/pedidos` e `/conta/pedidos/[id]` leem os pedidos reais do banco (a
lista mock saiu do `conta-data.ts`). Depois que o pedido é marcado como
`ENTREGUE`, o cliente pode pedir devolução pelo detalhe: `POST
/api/pedidos/[id]/devolucao` exige um motivo, confere que o pedido é dele e que
está entregue, move pra `DEVOLUCAO_SOLICITADA` e cria a notificação — tudo em
transação. Quem marca `DEVOLVIDO` é a loja, pelo `/admin/pedidos`, depois de
receber o produto de volta; o motivo informado aparece lá no card.

Os rótulos e cores de status vivem em `src/lib/status-pedido.ts`, um lugar só
pro select do admin, a lista do cliente e o detalhe do pedido.

### Rastreio do envio

`Pedido.codigoRastreio` é preenchido pelo admin em `/admin/pedidos` (normalmente
junto de marcar `ENVIADO`, mas a tela deixa editar depois também) e não valida
um formato fixo — a cotação passa por mais de uma transportadora, e recusar um
código legítimo custa mais do que aceitar um errado, que o admin corrige na
mesma tela. Cadastrar um código novo notifica o cliente (`definirCodigoRastreio`
em `src/lib/data/pedidos.ts`); reeditar o mesmo texto não repete o aviso. O
cliente vê o código e um link de rastreamento dos Correios no detalhe do
pedido (`/conta/pedidos/[id]`).

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
│   ├── personalizar/[id]/        # 2 vias: upload da arte / WhatsApp com a loja
│   ├── checkout/                 # resumo + frete por CEP + ida pro Mercado Pago
│   ├── pedido/confirmado/        # status real do pedido
│   ├── conta/pedidos/            # pedidos reais + pedido de devolução
│   ├── favoritos/ e notificacoes/ # lista salva e avisos do pedido
│   ├── suporte/                  # FAQ
│   ├── entrar/ e cadastro/       # login e criação de conta
│   ├── admin/                    # área interna (painel, produtos, categorias,
│   │                              # pedidos, banners, configurações)
│   └── api/                      # catálogo, auth, pedidos, favoritos,
│                                  # notificações, webhook e admin (JSON)
├── components/                   # Header, Footer, ProductCard
└── lib/
    ├── data/                     # queries Prisma (server-only)
    ├── admin.ts                  # guardas de /admin e /api/admin (server-only)
    ├── arquivos.ts               # assinatura + Blob/disco dos uploads (server-only)
    ├── artes.ts                  # arte do cliente, privada (server-only)
    ├── imagens.ts                # imagem da loja, pública (server-only)
    ├── video.ts                  # vídeo do produto, público (server-only)
    ├── mercadopago.ts            # clients + assinatura do webhook (server-only)
    ├── session.ts                # cookie de sessão assinado (server-only)
    ├── prisma.ts                 # PrismaClient singleton
    ├── types.ts                  # Produto, Categoria, Variacao, Pedido, Banner
    ├── frete.ts                  # cotação Melhor Envio + tabela por UF + CEP
    ├── status-pedido.ts          # rótulos e cores do StatusPedido
    ├── use-produto.ts            # hooks de catálogo p/ client components
    ├── use-cep.ts                # consulta de CEP + frete p/ o checkout
    ├── use-pedidos.ts            # pedidos do usuário logado
    ├── favoritos-context.tsx     # favoritos do usuário (via /api/favoritos)
    ├── notificacoes-context.tsx  # avisos + contador do sininho
    ├── cart-context.tsx          # sacola: localStorage p/ visitante, banco p/ logado
    ├── mock-data.ts              # seed do banco + FAQs
    └── *.test.ts                 # testes unitários das funções puras (Vitest)
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
   Pra via "Criar com a gente" da personalização, `NEXT_PUBLIC_WHATSAPP_LOJA`
   com o número da loja (só dígitos, com DDI).
4. Deploy. O `postinstall` roda `prisma generate` (Prisma Client correto mesmo
   com o cache de dependências da Vercel) e o `npm run build` aplica as
   migrations pendentes **antes** do `next build`, via
   `scripts/migrate-deploy.mjs`. Elas não são opcionais: o build prerenderiza
   páginas que consultam o banco e quebra com `P2021 table does not exist` se
   as tabelas não existirem.
5. Popular o catálogo: `npm run db:seed` com `DATABASE_URL` apontando pro banco
   de produção. Sem isso a loja sobe no ar com catálogo vazio — o build passa,
   mas não há produto nem categoria pra mostrar. O seed é idempotente
   (`upsert` com `update: {}`), então rodar de novo não desfaz o que a loja
   editou.
6. Promover a primeira conta a admin com `npm run db:admin -- voce@exemplo.com`
   apontando pro banco de produção.

### A migration no build precisa de conexão direta

O `prisma migrate deploy` começa pegando um advisory lock no Postgres, que é de
sessão. Pelo pooler (pgbouncer do Neon/Supabase) cada comando pode cair numa
conexão de servidor diferente, e o lock às vezes fica preso na conexão
devolvida ao pool: o build seguinte não consegue pegá-lo e morre com
`P1002 Timed out trying to acquire a postgres advisory lock`. Foi assim que o
deploy de produção do commit `745138e` quebrou, minutos depois do preview do
mesmo commit ter migrado o mesmo banco sem erro.

Por isso o build não chama o Prisma direto, e sim `scripts/migrate-deploy.mjs`,
que:

- roda as migrations pela primeira URL **sem pool** que achar no ambiente —
  `DIRECT_URL`, `DATABASE_URL_UNPOOLED` ou `POSTGRES_URL_NON_POOLING` (as duas
  últimas já vêm prontas da integração Neon/Postgres da Vercel). O app em si
  continua no `DATABASE_URL` com pool, que é o certo pra serverless;
- tenta de novo, até 3 vezes, quando o erro é de conexão (`P1001`, `P1002`,
  `P1008`, `P1017`) — o compute do Neon suspende sozinho quando fica ocioso e
  acordar pode passar dos 10s que o Prisma espera pelo lock. Erro de SQL não
  entra no retry: falha de primeira, como deve.

**Configure uma dessas variáveis no projeto da Vercel.** Sem nenhuma delas o
script segue pelo `DATABASE_URL` mesmo (o build não quebra por falta dela, e o
retry ainda cobre boa parte dos casos), mas aí o lock preso volta a ser
possível. No Neon a URL direta é a mesma sem o sufixo `-pooler` no host.

Uma ressalva que continua de pé: enquanto preview e produção compartilharem o
mesmo `DATABASE_URL`, um deploy de preview também migra o banco de produção —
separar os bancos por ambiente resolve.

Sem `BLOB_READ_WRITE_TOKEN` o upload cai no ramo do disco local, e na Vercel
isso **não** degrada em silêncio: o filesystem da função é somente leitura, o
`mkdir` estoura com `ENOENT: mkdir '/var/task/var'` e o `POST /api/upload`
devolve 500. Na prática a personalização por upload fica quebrada — e com ela
a compra de todo produto que exige arte. Conferir logo após o deploy enviando
um arquivo; se vier 500, é esse token que está faltando. Sem
`MERCADOPAGO_ACCESS_TOKEN` — ou com `SIMULAR_PAGAMENTO=true` — o checkout sobe
em modo simulado, ou seja, aprova pedido sem cobrar ninguém: também não pode
ficar assim em produção. E sem
`MERCADOPAGO_WEBHOOK_SECRET` o `/api/webhooks/mercadopago` aceita qualquer
`POST` sem conferir o `x-signature` (ver `assinaturaDoWebhookValida`); o
pagamento em si continua sendo lido da API do Mercado Pago, então ninguém
forja um pedido pago, mas a rota fica aberta pra quem souber a URL.

## Testes

```bash
npm test          # unitários, roda uma vez
npm run test:watch
npm run test:db   # integração, exige DATABASE_URL migrado (Postgres descartável)
npm run test:e2e  # e2e, sobe o próprio `next dev` (exige Postgres seedado)
```

`npm test` roda os testes unitários (Vitest) das funções puras de negócio em
`src/lib`: slug de categoria, comparativo de preço com a Shopee, frete (tabela
por UF, normalização do CEP e a cotação do Melhor Envio, com `fetch` trocado por
um stub) e as regras do status do pedido — incluindo quando a devolução pode ser
pedida. Ficam ao lado do módulo, em `src/lib/*.test.ts`, e o ambiente é `node`:
nada de banco, servidor ou DOM.

`npm run test:db` (`src/lib/data/*.integration.test.ts`, Vitest contra Postgres
de verdade) cobre o que só o banco garante: limite de uso de cupom e estoque
sob concorrência, reversão quando o pagamento falha, CHECK constraints e a
sacola gravada (`carrinho.ts`) sendo esvaziada só quando o pagamento é
confirmado — e mantida quando é recusado.

`npm run test:e2e` (Playwright, `e2e/`) sobe `next dev` e exercita o fluxo
inteiro pelo navegador: cadastro, escolha de variação, CEP/frete real (ViaCEP),
checkout, pagamento simulado (sem `MERCADOPAGO_ACCESS_TOKEN` no ambiente de
teste, então não depende do Mercado Pago nem de um webhook) e confirmação —
inclusive que a sacola aparece vazia depois e o pedido aparece em
`/conta/pedidos`. Só essa suíte depende de rede de verdade (ViaCEP).

## CI

`.github/workflows/ci.yml` roda em push e pull request pra `main`: sobe um
Postgres descartável (service container), aplica migrations, popula o seed e
então roda lint, checagem de tipos, testes unitários, testes de integração,
build e o e2e do fluxo de compra (Playwright, com o Chromium instalado no
próprio job). O banco não é opcional aqui — as páginas prerenderizadas
consultam o catálogo durante o `next build`.

`npm run typecheck` roda `next typegen` antes do `tsc --noEmit`, porque os
tipos de rota que o `layout.tsx` usa são gerados pelo Next em `.next/types/`.

## Próximos passos

- [x] Mock visual do fluxo completo (produto → personalização → checkout)
- [ ] Validar telas com o time da loja — revisão de UX/conteúdo com quem toca
      o negócio, não uma tarefa de código
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
- [x] Fotos (até 4) e vídeo do produto e imagem da categoria cadastrados no
      `/admin`, com o emoji virando reserva de quem ainda não subiu arquivo
- [x] Painel de vendas em `/admin` (faturamento, ticket médio, devoluções e
      gráficos dos últimos 30 dias)
- [x] Comparativo de preço ligado/desligado por produto (`vendidoNaShopee`)
- [x] Persistir o carrinho no banco (visitante continua em `localStorage`,
      quem loga sincroniza com o banco — `CarrinhoItem`, `src/app/api/carrinho`)
- [x] Cotação real de frete (Correios via Melhor Envio) com a tabela por região
      como fallback, peso/dimensões por produto e token no `/admin/configuracoes`
- [x] Rastreio do envio no detalhe do pedido (`Pedido.codigoRastreio`, editável
      em `/admin/pedidos`, com link de rastreamento pro cliente)
- [x] Guardar a sacola até o pagamento confirmar (só esvazia quando o pedido
      vira `PAGO` — pagamento recusado ou ainda aguardando deixa o item intacto)
- [ ] Subir a primeira versão em produção (Vercel + Postgres + Blob Store) —
      depende de credenciais e contas reais (Vercel, banco, Mercado Pago) que
      só quem administra a loja tem acesso pra provisionar
- [x] Testes automatizados das funções puras de negócio (Vitest, rodando no CI)
- [x] Testes de integração das rotas de dados (Vitest + Postgres) e e2e do
      fluxo de compra (Playwright), os dois rodando no CI

## Convenções

- Branch principal: `main`
- Branches de trabalho: `feat/...`, `fix/...`, `chore/...`
- Segredos e credenciais **nunca** devem ser commitados — use arquivos `.env`
  locais (já ignorados pelo `.gitignore`).

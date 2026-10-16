# Spec de testes — Carrinho, recuperação e painel

Objetivo: validar de ponta a ponta tudo que foi entregue no ciclo do carrinho (sacola multi-item, frete por origem, recuperação de carrinho, cupons pessoais, testes A/B, WhatsApp, funil). Rode na máquina local com Postgres de desenvolvimento, **nunca em produção**.

## 0. Preparação

```bash
git pull origin main
npm install
npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit        # só o erro antigo de LayoutProps em src/app/layout.tsx é aceitável
npx eslint src
npx vitest run          # esperado: tudo verde (207+)
```

Variáveis em `.env.local`: `DATABASE_URL`, `CRON_SECRET=teste123`, `RESEND_API_KEY` (opcional — sem ela os e-mails caem em modo simulado/log), e-mail de alerta em Admin > Configurações.

Dados mínimos: 1 admin, 2 clientes (A e B) com e-mail verificado, 4 produtos ativos (um com `requerPersonalizacao`, um com variações e estoque por variação, um com estoque 1, um esgotado), cupom de teste, `freteGratisAcimaDe = 150`.

Rodar os testes de integração que dependem de banco (se existirem) com o Postgres local: `npx vitest run --config <config de integração>`.

## 1. Migrations (verificação no banco)

Confirmar existência: tabelas `LembreteCarrinho`, `CarrinhoVisitante`, `ContatoCarrinho`, `ResolvidoCarrinho`, `EventoFunil`; colunas `Cupom.usuarioId`, `LembreteCarrinho.{variante,varianteCupom,motivo,comDestaque}`, `CarrinhoVisitante.telefone`, `ConfiguracaoLoja.{lembreteCarrinhoAtivo,cupomCarrinhoAtivo,cupomCarrinhoPercentual,cupomCarrinhoValidadeDias,cupomCarrinhoPercentualB,assuntoVencedor,cupomVencedor,whatsappModelo,abAlertado,carrinhoAltoValor,funilAtivo}`; índice único `EventoFunil(sessao,tipo,dia,produtoId)`.

## 2. Carrinho multi-item (navegador)

| # | Passo | Esperado |
|---|---|---|
| 2.1 | Visitante adiciona 3 produtos diferentes | Contador no header; mini-carrinho abre no desktop; `/carrinho` lista 3 linhas |
| 2.2 | Mesmo produto + mesma variação duas vezes | Linhas mescladas, quantidade soma |
| 2.3 | Produto com personalização | Quantidade travada em 1; cada adição é uma linha separada |
| 2.4 | Aumentar além do estoque | Botão `+` bloqueia no máximo; aviso de estoque |
| 2.5 | Alterar preço do produto no admin e voltar ao carrinho | Aviso de preço mudou (compara com `precoAdicionado`) |
| 2.6 | Barra de frete grátis | Mostra quanto falta; some ao passar de R$ 150 |
| 2.7 | Login com carrinho local | Carrinho sobe pro servidor (`GET /api/carrinho` retorna as linhas); em outro navegador logado o carrinho aparece |
| 2.8 | Remover item / limpar | Banco reflete (`CarrinhoItem`), `carrinhoLembreteEm` e `carrinhoLembrete2Em` voltam a `NULL` |
| 2.9 | Mais de 30 linhas via API | `400` com mensagem de limite |

## 3. Frete por origem

- Carrinho com produtos de origens (CEP) diferentes → um preço por origem, somados; serviços exibidos só se existirem em todos os grupos.
- Grupo sem cotação → cai na estimativa regional (sem erro 500).
- Acima do limite de frete grátis → frete zerado e rótulo correto no checkout.

## 4. Checkout e cupons

| # | Cenário | Esperado |
|---|---|---|
| 4.1 | Pedido com 3 linhas | Preços/estoque recalculados no servidor (alterar preço no DevTools não muda o total) |
| 4.2 | Estoque acabou entre carrinho e pagamento | Pedido recusado com mensagem clara; estoque não fica negativo |
| 4.3 | Cupom restrito a produto | Desconto só nas linhas daquele produto |
| 4.4 | Cupom de primeira compra | Funciona só sem pedidos anteriores |
| 4.5 | Dois checkouts simultâneos com cupom `usoMaximo=1` | Só um consome; o outro recebe erro (uso atômico) |
| 4.6 | Cupom pessoal (`Cupom.usuarioId` = cliente A) usado pelo cliente B | `400 "Este cupom não vale para esta conta."` na prévia (`POST /api/cupons/validar`) e na criação do pedido |
| 4.7 | Cupom pessoal usado pelo dono | Aceito; `usos` incrementa 1x |
| 4.8 | Pagamento aprovado | `CarrinhoItem` do cliente limpo |

## 5. Carrinho de visitante por e-mail

1. Sem login, em `/carrinho`, preencher e-mail + (opcional) WhatsApp `(11) 91234-5678` + consentimento → "Carrinho guardado".
2. Sem consentimento → erro. E-mail inválido → erro. Telefone `123` → erro "telefone válido".
3. Banco: `CarrinhoVisitante` com `token`, `itens`, `valorCarrinho`; telefone normalizado `5511912345678`.
4. Rate limit: 6ª requisição na mesma hora → `429`.
5. Deixar `updatedAt` com mais de 24h (SQL) e chamar o cron (seção 7) → e-mail com link `/carrinho/recuperar/<token>`; `lembreteEm` preenchido; segundo cron não reenvia.
6. Abrir o link → itens voltam ao navegador e redireciona pro `/carrinho`; `restauradoEm` preenchido; abrir 2x **não** duplica quantidades.
7. Link com `?cancelar=1` → confirmação; confirmar apaga o registro (inclui telefone).
8. Registro com `updatedAt` > 30 dias é removido pelo cron.

## 6. Favoritos e volta ao estoque

1. Cliente favorita produto **esgotado** (ou usa "Avisar quando voltar" na página do produto).
2. Admin repõe o estoque (edição do produto) → cliente recebe notificação interna e e-mail (se `prefEmail`).
3. Editar o produto de novo sem mudar a disponibilidade → **não** reenvia.
4. Produto com estoque por variação: só avisa quando alguma variação > 0.
5. Sync do fornecedor que repõe estoque → mesmo aviso.
6. Cliente com `prefEmail=false` → só notificação interna.

## 7. Cron de carrinho esquecido

Chamada manual:

```bash
curl -s -H "Authorization: Bearer teste123" http://localhost:3000/api/cron/carrinho-esquecido
curl -s http://localhost:3000/api/cron/carrinho-esquecido            # esperado 401
```

Preparar via SQL o `updatedAt` das linhas de `CarrinhoItem` para simular o tempo (25h, 73h).

| # | Cenário | Esperado |
|---|---|---|
| 7.1 | Cliente com carrinho parado 25h, `prefEmail=true` | 1 e-mail; `carrinhoLembreteEm` preenchido; linha em `LembreteCarrinho` (tipo 1, `variante` A/B, `id` usado no link `/carrinho/motivo?l=`) |
| 7.2 | Rodar o cron de novo | Nenhum reenvio |
| 7.3 | Cliente mexe no carrinho depois | `carrinhoLembreteEm` volta a NULL; pode avisar de novo |
| 7.4 | Cliente com pedido recente | Não recebe |
| 7.5 | `lembreteCarrinhoAtivo=false` | Resposta `{ativo:false}`, nada enviado |
| 7.6 | Carrinho parado 73h com `cupomCarrinhoAtivo=true` | Segundo e-mail com cupom `VOLTA…` (1 uso, validade conforme config); `Cupom.usuarioId` = cliente; `LembreteCarrinho` tipo 2 com `variante`, `varianteCupom`, `comDestaque` |
| 7.7 | `cupomCarrinhoAtivo=false` | Nenhum e-mail de 72h |
| 7.8 | Assunto A vs B | Mesmo cliente sempre cai na mesma variante; usuários diferentes se dividem; com `assuntoVencedor`/`cupomVencedor` travado todos recebem a variante travada |
| 7.9 | `cupomCarrinhoPercentualB` preenchido | Variante B de desconto usa o percentual B; vazio → mesmo % |
| 7.10 | `carrinhoAltoValor=100` e carrinho de R$ 200 parado | E-mail de prioridade ao admin; cada carrinho aparece uma vez |
| 7.11 | Falha de envio de um e-mail | Cron continua, não derruba os demais |
| 7.12 | Resposta do cron | Não vaza e-mails/nomes |

## 8. Motivo de abandono

1. Abrir `/carrinho/motivo?l=<id do LembreteCarrinho>` → 4 botões. Clicar em "O frete ficou caro" → "Obrigado"; banco `motivo='frete'`.
2. Clicar de novo / outro botão → não sobrescreve (só a primeira resposta vale).
3. `l` inválido ou motivo fora do enum → `400`. Mais de 20 requisições/hora/IP → `429`.
4. Com ≥10 respostas e um motivo ≥40% (inserir via SQL), o e-mail de 72h passa a ter a frase de destaque (frete só se `freteGratisAcimaDe` estiver configurado); metade dos clientes recebe (`comDestaque` true/false).

## 9. Painel `/admin/carrinhos` (logado como admin)

- Sem login/sem ser admin → bloqueado.
- Períodos 7/30/90 trocam os números.
- Cards: carrinhos ativos, parados, lembretes enviados, recuperados, taxa, receita.
- Tabela por tipo e por variante (assunto A/B e desconto A/B); linha "Por que não finalizaram".
- Leitura dos testes: com amostra < 30 por variante mostra "Ainda cedo"; com amostra grande e diferença forte (inserir dados via SQL) mostra "diferença significativa".
- Recuperação: criar pedido do cliente até 7 dias depois de um lembrete → conta como recuperado; com 2 lembretes antes do pedido, só o mais recente leva o crédito e a receita **não** dobra.
- Funil: visitar produto, adicionar ao carrinho, abrir checkout (sessão anônima) → contagens sobem 1 por passo/dia; recarregar a página não duplica.
- "Produtos mais abandonados" lista top 5; estoque ≤ 5 mostra "estoque baixo".
- "Muita visita, pouco carrinho" só com ≥10 visitas.
- Lista de carrinhos parados: link **Chamar** só quando `prefWhatsapp` e telefone válido; clique registra `ContatoCarrinho`; aparece "contatado há Xh" e **Marcar resolvido** (some da lista; volta se o cliente mexer no carrinho).
- Mensagem do WhatsApp: abre `wa.me/55…?text=` com o modelo; acima do limite cita frete grátis; perto do limite diz quanto falta.
- Visitantes com telefone: lista com "Chamar" e "Marcar resolvido".
- **Exportar CSV**: baixa `lembretes-carrinho-30d.csv` (UTF-8 com BOM), colunas conforme `carrinhos-export.ts`; abrir no Excel sem quebrar acentos; valores começando com `=`/`+`/`-`/`@` vêm prefixados com `'`.

## 10. Configurações `/admin/configuracoes`

- Salvar: lembrete 24h, cupom 72h, %, validade (1–60), % B (1–50 ou vazio), vencedor do assunto, vencedor do desconto (só com % B), mensagem do WhatsApp (≤600) com prévia ao vivo, valor de carrinho alto, funil on/off.
- Valores inválidos (% 0, 51, validade 61, variante `C`) → erro 4xx com mensagem; nada salvo.
- Funil desligado: `POST /api/funil` responde `{ok:true, ativo:false}`, nada vai ao banco, o navegador remove `localStorage.funil-sessao`.

## 11. Cron semanal e alerta A/B

```bash
curl -s -H "Authorization: Bearer teste123" http://localhost:3000/api/cron/resumo-carrinhos
```

- Sem e-mail de alerta configurado → `{enviado:false}`.
- Com e-mail: resumo com variação vs. semana anterior, WhatsApp, parados, mais abandonados, visita sem carrinho, leitura dos 4 testes.
- Alerta de resultado A/B: forçar um teste significativo via SQL, rodar o cron diário → e-mail 1x; rodar de novo → não repete; trocar o líder → avisa de novo (`ConfiguracaoLoja.abAlertado`).
- `vercel.json` tem 4 entradas de cron válidas.

## 12. Segurança / regressão

- Rotas `/api/admin/carrinhos/*` e `/api/admin/configuracoes` exigem admin (testar sem cookie → 401/403).
- Rotas de cron sem `Authorization` → 401; sem `CRON_SECRET` definido → 401.
- `POST /api/funil` com sessão curta ou tipo inválido → 400; >60/h/IP → 429.
- Nenhum e-mail/telefone de cliente aparece em respostas públicas ou em logs do cron.
- Fluxo antigo de compra de **1 item** (botão "Comprar agora") continua funcionando.
- `npx next build` conclui sem erros de tipo (exceto o conhecido `LayoutProps` se persistir).

## 13. Critério de aceite

Todas as seções acima verdes, `vitest` verde, build ok. Registrar falhas com: passo, esperado, obtido, trecho de log/SQL. Corrigir na `main` com commits pequenos e rodar de novo a seção afetada.

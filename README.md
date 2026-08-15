# Ki Brindes Vendas

Repositório do projeto **Ki Brindes Vendas**.

## Status

Protótipo visual (mock) do fluxo completo de compra e personalização, sem
back-end real. Dados em `src/lib/mock-data.ts`, carrinho em memória via
`localStorage`. Objetivo: validar as telas com o time da loja antes de
implementar Prisma/Postgres de verdade.

## Como começar

```bash
git clone https://github.com/rafaelrassis/kibrindesvendas.git
cd kibrindesvendas
npm install
npm run dev
```

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
│   └── admin/                    # stubs de produtos e pedidos
├── components/                   # Header, Footer, ProductCard
└── lib/                          # mock-data.ts, cart-context.tsx
```

## Próximos passos

- [x] Mock visual do fluxo completo (produto → personalização → checkout)
- [ ] Validar telas com o time da loja
- [ ] Trocar mock-data por Prisma + PostgreSQL (Fase 1 da spec)
- [ ] Configurar ambiente de desenvolvimento (variáveis de ambiente, deploy)
- [ ] Configurar testes e integração contínua

## Convenções

- Branch principal: `main`
- Branches de trabalho: `feat/...`, `fix/...`, `chore/...`
- Segredos e credenciais **nunca** devem ser commitados — use arquivos `.env`
  locais (já ignorados pelo `.gitignore`).

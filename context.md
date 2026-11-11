# Quiosque do Coco - API (Server) - Contexto

## Visão Geral
API NestJS para o sistema Quiosque do Coco, composta por:
- Pedidos, Clientes, Turnos, Produtos, Pagamentos, Estoque, Caixa, Devoluções
- Autenticação via JWT, roles (admin, responsavel, atendente)

## Decisões de P0 (já mergeadas)
- **Serialização**: Inverteu a ordem dos interceptors em `main.ts` (Transform antes do Currency). Corrige `id: "[object Object]"` e estouro de pilha. `TransformInterceptor` e `CurrencyResponseInterceptor` reescritos com guarda de ciclos.
- **Entrega e Estoque**: `deliver()` só aceita pedido `PAGO`/`EM_PREPARO`/`PRONTO` com `stockReserved`. Baixa atômica condicional (`stockQty >= qty`, `reservedQty >= qty`), lança `ConflictException` se estoque insuficiente.
- **Cancelamento**: Atendente só cancela antes do pagamento; depois exige admin/responsavel (403).
- **Privilégio**: Remove `POST /auth/register` (permitia escalada). Criação de usuário só via `POST /users`, restrito a admin.
- **Seed em Produção**: Não roda automática com `NODE_ENV=production`, salvo `SEED_ON_BOOT=true`. Evita `admin/admin123` em produção.

## Mudanças Técnicas (8 arquivos modificados)
- `server/src/main.ts` - Ordem dos interceptors invertida com comentário explicativo.
- `server/src/common/interceptors/currency-response.interceptor.ts` - Conversor seguro cents→reais com WeakSet cycle guard.
- `server/src/common/transform.interceptor.ts` - Normaliza ObjectId→string, `_id`→`id`, Mongoose virtuals, cycle guard, depth 20.
- `server/src/orders/orders.service.ts` - `deliver()`, `cancel()` com regra de role, `processDelivery()` atômico.
- `server/src/orders/orders.controller.ts` - `cancel()` passa `req.user.role`.
- `server/src/auth/auth.controller.ts` + `auth.service.ts` - Remove `/auth/register` e `register()`.
- `server/src/seed/seed.service.ts` - Guard `NODE_ENV=production` + `SEED_ON_BOOT`.

## Deploy
- API na VPS: `git pull` + `docker compose build/up` (via `deploy-vps.sh`).
- Front na Vercel: merge no `main` dispara deploy automático.
- JWT_SECRET rotacionado (antigo `dev-secret-change-in-production` agora é valor novo).

## Hardening P1 (branch `fix/confirm-payment-e-hardening`)
- **P0 confirm-payment**: `OrdersService.confirmPayment` é a fonte única e idempotente da confirmação. `PaymentsService.confirm` delega para ele e **não engole mais** `BadRequestException`. Pagamento só é aceito com pedido em `AGUARDANDO_PAGAMENTO`.
- **Validação de pagamento** (`PaymentsService.create`): `amount` precisa ser igual a `order.totalCents`; turno do pagamento precisa ser o do pedido; cartão exige `cardType` (débito/crédito); dinheiro exige `received >= amount` e calcula `changeCents`.
- **Reserva atômica** (`OrdersService.submitForPayment`): revalida turno aberto e disponibilidade; reserva com `findOneAndUpdate` condicional (`stockQty - reservedQty >= qty`); faz rollback das reservas anteriores em caso de falha; só grava `StockMovement` depois de todas as reservas.
- **Disponibilidade no turno**: `create` e `updateItems` exigem o produto em `shift.availability` com `available=true` (não basta estar ativo no cadastro).
- **Fechamento de turno**: `close()` persiste `expectedCashCents` e `differenceCents` no próprio turno, usando `ReportsService.cashSummary()`.
- **Resumo de caixa**: `cashSummary` passou a retornar `pixCents`, `cardCents`, `cardDebitCents`, `cardCreditCents` e `totalSalesCents`.
- **Auditoria**: novos `GET /audit/logs` e `GET /audit/entity/:entity/:entityId`, restritos a admin/responsável.
- **Subdocumento do turno**: `ShiftAvailability` ganhou schema próprio (`shift.schema.ts`); antes o Mongoose tratava `availability` como `Mixed` e o `ref` de `product` se perdia, então `populate('availability.product')` não populava nada.
- **Regressão**: `server/scripts/smoke-sale-flow.mjs` (`npm run smoke`) cobre login, turno, criar/editar, submit, rejeições de pagamento, dinheiro com troco, Pix, idempotência, reserva/liberação de estoque, resumo de caixa, auditoria e fechamento persistido.
- **Regra de status**: produto sem `requiresPrep` vai para `PRONTO` ao pagar; com preparo vai para `PAGO`. O estoque continua baixando apenas na entrega explícita.

## Entregas pós-merge (11/11/2026)
- **Ajuste de estoque**: `PATCH /products/:id/stock` (`ProductsService.adjustStock`) agora:
  - exige `qty` inteiro diferente de zero e `reason` não vazio;
  - rejeita produto inexistente e produto com `trackStock=false`;
  - atualiza de forma atômica com `$expr` (`stockQty + qty >= 0`), impedindo saldo negativo e lost update;
  - grava `StockMovement` do tipo `ajuste` com `balanceAfter`, motivo e usuário;
  - grava auditoria `product.stock.adjusted` com `previousQty`/`balanceAfter` no `meta`.
- **Auditoria**: `AuditService.log` resolve `userName` a partir do `userId` quando o nome não é informado.
- **Testes automatizados**: Jest + ts-jest (sem banco), com 13 testes em 2 suítes:
  - `products.service.spec.ts`: ajuste válido, qty inválida, motivo vazio, produto inexistente, produto sem controle de estoque e bloqueio de saldo negativo;
  - `orders.service.spec.ts`: confirmação sem/com preparo, idempotência, pedido fora de `aguardando_pagamento`, pedido cancelado e ausência de pagamento.
- **Lint**: ESLint 9 flat config (`eslint.config.mjs`) + typescript-eslint; `npm run lint` corrige e `npm run lint:check` só valida (0 problemas).
- **CI**: `.github/workflows/ci.yml` roda `npm ci`, `lint:check`, `test` e `build` em PRs e no `main` (Node 22) em `lint-test-build`; o job `smoke` sobe a API com Mongo 7 como service container em banco descartável (`quiosque_e2e`) e roda `npm run smoke`. O deploy da API agora só dispara após o CI concluir com sucesso (`workflow_run`).
- **Deploy**: `.github/workflows/deploy.yml` usa `appleboy/ssh-action` sem `script_stop` (entrada removida na 1.2.5); o script remoto já roda com `set -e`.
- **Dependabot**: atualizações semanais de npm (grupos `@nestjs/*` e dev tooling) e mensais de GitHub Actions.

## Upgrade Nest 12 (11/11/2026)
- **Stack**: `@nestjs/common|core|platform-express` 12.4, `@nestjs/config` 12.1, `@nestjs/swagger` 12.1, `@nestjs/jwt` 12.0, `@nestjs/mongoose` 12.0, `@nestjs/passport` 12.0, `@nestjs/cli|schematics|testing` 12; TypeScript 6.0; Node 22.
- **Nest 12 é ESM-only**: o build continua CommonJS e o runtime usa `require(ESM)` nativo do Node `>=22.12`. Por isso Dockerfile e CI passaram de Node 20 para Node 22.
- **Testes**: Jest/ts-jest substituídos por Vitest 5 + `unplugin-swc` (o esbuild não emite `design:type`, necessário para os decorators do Nest e para o `SchemaFactory` do `@nestjs/mongoose`). `jest.config.js` removido; specs usam `vi.fn`.
- **tsconfig**: `rootDir: ./src`, `include: ["src"]`, `types: ["node", "vitest/globals"]`, `ignoreDeprecations: "6.0"` (TS 6) e `strictPropertyInitialization: false` (schemas/DTOs sem inicializador).
- **`npm audit`**: 7 vulnerabilidades moderate restantes, todas dev-only (`typescript-eslint` → `minimatch`); nenhuma high. As correções anteriores exigiam o upgrade major do Nest.
- **Validação**: `lint:check` ✅, `npm test` (13 testes) ✅, `nest build` ✅, `npm run smoke` ✅ em banco descartável, `docker build` + container em Node 22 ✅ (inclui `/api/docs`).

## P1 Pendentes (restantes)
- `npm audit`: 7 vulnerabilidades moderate dev-only (`typescript-eslint` → `minimatch`); não há correção publicada ainda. Sem vulnerabilidades high. Reavaliar quando o `typescript-eslint` atualizar.
- Testes e2e: cobertos pelo job `smoke` no CI (Mongo 7 como service container, banco `quiosque_e2e` descartável).
- `.env.production` já removido do versionamento/histórico; manter conferência no deploy da VPS.

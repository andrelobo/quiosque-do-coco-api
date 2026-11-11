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
- **CI**: `.github/workflows/ci.yml` roda `npm ci`, `lint:check`, `test` e `build` em PRs e no `main`. O deploy da API agora só dispara após o CI concluir com sucesso (`workflow_run`).
- **Dependabot**: atualizações semanais de npm (grupos `@nestjs/*` e dev tooling) e mensais de GitHub Actions.

## P1 Pendentes (restantes)
- `npm audit`: 28 vulnerabilidades (5 low, 12 moderate, 11 high). As correções exigem upgrade major (`@nestjs/cli@12`, `@nestjs/*@12`, `@nestjs/config@12`); `npm audit fix --force` não foi aplicado por ser breaking. Plano: branch dedicada de upgrade do Nest 11/12 com smoke + testes antes do merge.
- Testes e2e com banco real (o smoke cobre o fluxo, mas não roda no CI por depender de Mongo).
- `.env.production` já removido do versionamento/histórico; manter conferência no deploy da VPS.

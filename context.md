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

## P1 Pendentes (restantes)
- Framework de testes automatizados (unit/e2e) — hoje só há o script de smoke.
- `adjustStock` sem `StockMovement`/audit.
- `.env.production` versionado com JWT secret de dev (histórico já limpo; conferir deploy).
- `npm audit` com vulnerabilidades e ausência de lint no CI.

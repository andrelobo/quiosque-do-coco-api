# Quiosque do Coco - API (Server) - Estado Atual (11/11/2026)

## Branch em andamento
- Branch: `fix/confirm-payment-e-hardening` (a partir de `main`)
- Alterações ainda não commitadas/pushadas nesta sessão.
- Pacote de P0 + P1 concluído e validado com script de regressão.

## Builds e validações
- `npx tsc --noEmit -p tsconfig.json` ✅ (sem erros)
- `npm run build` (`nest build`) ✅ (sem erros)
- `cd web && npm run build` (`vite build`) ✅ (sem erros)
- `npm run smoke` (script de regressão) ✅ contra banco descartável `quiosque_smoke`
- `npm run smoke` ✅ também contra o banco local (`quiosque`, turno #12 reutilizado)
- Nenhum resíduo de teste: pedidos/pagamentos/movimentos/logs do smoke removidos; estoque restaurado (`Croissant` 4/0).

## Correções desta sessão

### P0 — confirmação de pagamento
- `OrdersService.confirmPayment` é fonte única e idempotente:
  - aceita pagamento `pendente` ou `confirmado`;
  - libera o pedido uma única vez (`paidAt` preenchido);
  - `requiresPrep=false` → `pronto`; `requiresPrep=true` → `pago`;
  - não baixa estoque (baixa só na entrega).
- `PaymentsService.confirm` delega para `OrdersService.confirmPayment` e **não engole mais** `BadRequestException`.
- Pagamento só é aceito com pedido em `aguardando_pagamento`.

### P1 — validação de pagamento
- `amount` precisa ser igual a `order.totalCents` (nunca o valor digitado livremente).
- Turno do pagamento precisa ser o mesmo do pedido.
- Cartão exige `cardType` (`debito`/`credito`).
- Dinheiro exige `received >= amount` e grava `changeCents`.

### P1 — reserva atômica e disponibilidade
- `submitForPayment` revalida turno aberto e disponibilidade no turno.
- Reserva condicional atômica: `stockQty - reservedQty >= qty` via `findOneAndUpdate`.
- Rollback das reservas já feitas se qualquer item falhar.
- `StockMovement` só é criado depois de todas as reservas.
- `create` e `updateItems` exigem produto em `shift.availability` com `available=true`.

### P1 — fechamento de turno
- `ShiftsService.close` persiste `expectedCashCents` e `differenceCents`.
- `ReportsService.cashSummary` retorna `pixCents`, `cardCents`, `cardDebitCents`, `cardCreditCents` e `totalSalesCents`.
- `ShiftsModule` importa `ReportsModule`; `ReportsModule` exporta `ReportsService`.

### P1 — populate do turno
- `ShiftAvailability` passou a ter schema próprio (`ShiftAvailabilitySchema`); antes o Mongoose registrava `availability` como `Mixed` e o `ref` de `product` era ignorado.
- `GET /shifts/current` e `GET /shifts/:id/products` agora retornam o produto completo.

### P1 — auditoria
- `GET /audit/logs` (filtros `action`, `entity`, `userId`, `start`, `end`).
- `GET /audit/entity/:entity/:entityId`.
- Restritos a `admin` e `responsavel`; validam ObjectId/datas.

## Status dos Endpoints (API: http://localhost:4000)

### Autenticação
- `POST /auth/login` ✅ 200 (cookie `auth_token` httpOnly)
- `GET /auth/me` ✅ 200
- `POST /auth/register` ✅ 404 (removido)

### Pedidos
- `GET /orders?page=1&limit=10` ✅ `data` com ids string
- `POST /orders` ✅ id string; exige produto disponível no turno
- `POST /orders/:id/submit` ✅ reserva atômica e status `aguardando_pagamento`
- `POST /orders/:id/confirm-payment` ✅ fonte única, idempotente
- `POST /orders/:id/deliver` ✅ só pago; baixa estoque condicional
- `POST /orders/:id/cancel` ✅ atendente sem pagamento; admin/responsável após pagamento

### Pagamentos
- `POST /payments` ✅ valida valor, turno, tipo de cartão e troco
- `PATCH /payments/:id/confirm` ✅ delega para o pedido; erro não é mais engolido
- `PATCH /payments/:id/reject` ✅ marca `nao_confirmado`
- `GET /reports/cash/:shiftId` ✅ dinheiro/Pix/cartão/esperado/diferença

### Turnos
- `GET /shifts/current` ✅ turno aberto com `availability.product` populado (nome/preço/estoque)
- `POST /shifts/:id/close` ✅ persiste `expectedCashCents`/`differenceCents`
- `GET /shifts/:id/products` ✅ retorna os produtos completos do turno

### Auditoria
- `GET /audit/logs` ✅ admin/responsável
- `GET /audit/entity/:entity/:entityId` ✅ admin/responsável

## Script de regressão
- Arquivo: `server/scripts/smoke-sale-flow.mjs`
- Comando: `npm run smoke`
- Variáveis: `API_URL` (padrão `http://localhost:4000`), `MONGODB_URI` (padrão local), `--keep` para não limpar.
- Abre turno automaticamente se não houver nenhum aberto; nesse caso também valida e apaga o turno ao final.
- Cobre: login; criar pedido; pagamento antes do submit (400); valor divergente (400); turno divergente (400); cartão sem tipo (400); dinheiro com troco; Pix; confirmação idempotente; status `pronto`/`pago`; reserva e liberação de estoque; resumo de caixa; auditoria; fechamento persistido; limpeza no Mongo.

## Dados locais
- Banco `quiosque`: turno #12 aberto, 184 pedidos, 184 pagamentos (nenhum resíduo de smoke).
- Resíduo antigo opcional: pedido cancelado `6af461c2f6fa028bdd50c2e1` (pickup "Teste Regressao") + pagamento/logs.

## Próximos Passos
- Commitar na branch e abrir PR (sem push automático).
- (Feito) `populate('availability.product')` corrigido com schema próprio do subdocumento; o front aceita id ou objeto durante o deploy.
- Adicionar `StockMovement`/audit no `adjustStock`.
- Introduzir framework de testes (Jest/Supertest) reaproveitando o roteiro do smoke.
- Resolver `npm audit` e incluir lint no CI.

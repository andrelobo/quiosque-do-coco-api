# Quiosque do Coco - API (Server) - Estado Atual (11/11/2026)

## Branch em andamento
- Branch: `main` sincronizada com `origin/main`.
- Upgrade Nest 12 mergeado (PR #16, `b400d2b`) e deploy validado em produção.
- `script_stop` removido do workflow de deploy (PR #17, `e153735`); deploy seguinte passou sem o aviso do ssh-action.

## Builds e validações
- `npm run build` (`nest build`) ✅
- `npm run lint:check` ✅ (0 erros, 0 warnings)
- `npm test` ✅ Vitest (`2` suítes, `13` testes)
- `npm run smoke` ✅ contra banco descartável
- `docker build` + container Node 22 ✅ (`/api/docs` 200)
- `npm audit`: 7 moderate dev-only, 0 high

## Upgrade Nest 12 (11/11/2026)
- Nest `common/core/platform-express` 12.4, `config` 12.1, `swagger` 12.1, `jwt` 12.0, `mongoose` 12.0, `passport` 12.0, `cli/schematics/testing` 12; TypeScript 6; Node 22 (CI e Dockerfile).
- Nest 12 é ESM-only; o build segue CommonJS e o runtime usa `require(ESM)` nativo do Node `>=22.12`.
- Jest/ts-jest → Vitest 5 + `unplugin-swc` (metadados de decorator); `jest.config.js` removido.

## Correções já mergeadas (PR #4)

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
- Front aceita `availability.product` como id ou objeto durante o deploy.

### P1 — auditoria
- `GET /audit/logs` (filtros `action`, `entity`, `userId`, `start`, `end`).
- `GET /audit/entity/:entity/:entityId`.
- Restritos a `admin` e `responsavel`; validam ObjectId/datas.
- `AuditService.log` preenche `userName` a partir do `userId`.

## Entregas desta rodada (não commitadas)

### Ajuste de estoque com movimentação e auditoria
- `PATCH /products/:id/stock` (`ProductsService.adjustStock`):
  - `qty` inteiro e diferente de zero (`AdjustStockDto` com `IsInt`/`NotEquals(0)`);
  - `reason` obrigatório e sem espaços em branco;
  - 404 para produto inexistente; 409 para produto com `trackStock=false`;
  - atualização atômica com `$expr: { $gte: [{ $add: ['$stockQty', qty] }, 0] }`, sem lost update;
  - 409 quando o ajuste deixaria o saldo negativo, sem gravar movimento/auditoria;
  - grava `StockMovement` tipo `ajuste` (`qty` com sinal, `balanceAfter`, `reason`, `user`);
  - grava auditoria `product.stock.adjusted` com `previousQty`/`balanceAfter` em `meta`.
- `ProductsModule` registra `StockMovement` e importa `AuditModule`.
- Validado via API: `+5` ok; `-999` 409; `qty=0` 400; motivo vazio 400; sem `trackStock` 409; movimento e auditoria gravados.

### Testes automatizados
- Jest + ts-jest (`jest.config.js`), sem dependência de banco.
- Scripts: `npm test`, `npm run test:watch`, `npm run test:cov`.
- `src/products/products.service.spec.ts`: ajuste válido, qty inválida, motivo vazio, produto inexistente, sem controle de estoque e bloqueio de saldo negativo.
- `src/orders/orders.service.spec.ts`: confirmação sem/com preparo, idempotência, pedido fora de `aguardando_pagamento`, cancelado e sem pagamento.
- Resultado: `2` suítes, `13` testes passando.

### Lint e CI
- ESLint 9 flat config (`eslint.config.mjs`) + typescript-eslint.
- `npm run lint` (com `--fix`) e `npm run lint:check` (somente validação).
- Imports não usados removidos em controllers/DTOs/serviços.
- `.github/workflows/ci.yml`: `npm ci` + `lint:check` + `test` + `build` em PRs e no `main`.
- `.github/workflows/deploy.yml`: deploy da VPS agora só roda após o CI concluir com sucesso (`workflow_run`), mantendo `workflow_dispatch`.
- `.github/dependabot.yml`: npm semanal (grupos `@nestjs/*` e dev tooling) e GitHub Actions mensal.

## Status dos Endpoints (API: http://localhost:4000)

### Autenticação
- `POST /auth/login` ✅ 200 (cookie `auth_token` httpOnly)
- `GET /auth/me` ✅ 200
- `POST /auth/register` ✅ 404 (removido)

### Pedidos
- Leituras (`findAll`, `findById`, `findByShift`, `findByCode`) populam `shift` com `{ number, id }`, necessário para o front registrar pagamento em `/orders`.
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

### Produtos e estoque
- `PATCH /products/:id/stock` ✅ ajuste atômico + `StockMovement` + auditoria
- `GET /stock/product/:id` ✅ lista movimentos com usuário
- `GET /reports/stock` ✅ resumo por tipo e saldo por produto

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
- Banco descartável `quiosque_smoke`: dropado após a validação.
- Resíduo antigo opcional: pedido cancelado `6af461c2f6fa028bdd50c2e1` (pickup "Teste Regressao") + pagamento/logs.

## Próximos Passos
- Commitar as alterações desta rodada e abrir PR (sem push automático).
- Upgrade major do Nest (`@nestjs/cli@12`, `@nestjs/*@12`, `@nestjs/config@12`) em branch dedicada para zerar o `npm audit`; validar com `test`, `build` e `smoke`.
- Avaliar testes e2e com Mongo em serviço no CI (hoje o CI cobre apenas unitários).
- Manter Dependabot ativo e revisar PRs agrupados semanalmente.

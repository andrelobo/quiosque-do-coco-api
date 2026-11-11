# Quiosque do Coco - API (Server) - Context

## Overview
NestJS API for the Quiosque do Coco system, composed of:
- Orders, Customers, Turns, Products, Payments, Stock, Cash, Refunds
- JWT authentication, roles (admin, responsavel, atendente)

## P0 Decisions (already merged)
- **Serialization**: Inverted interceptor order in `main.ts` (Transform before Currency). Fixes `id: "[object Object]"` and stack overflow. `TransformInterceptor` and `CurrencyResponseInterceptor` rewritten with cycle guards.
- **Delivery & Stock**: `deliver()` only accepts `PAGO`/`EM_PREPARO`/`PRONTO` orders with `stockReserved`. Conditional atomic decrease (`stockQty >= qty`, `reservedQty >= qty`), throws `ConflictException` if insufficient stock.
- **Cancellation**: Attendant can only cancel before payment; after payment requires admin/responsavel (403).
- **Privilege**: Removes `POST /auth/register` (allowed privilege escalation). User creation only via `POST /users`, restricted to admin.
- **Seed in Production**: Does not run automatically with `NODE_ENV=production`, unless `SEED_ON_BOOT=true`. Prevents `admin/admin123` in production.

## Technical Changes (8 files modified)
- `server/src/main.ts` - Inverted interceptor order with explanatory comment.
- `server/src/common/interceptors/currency-response.interceptor.ts` - Safe cents→reais converter with WeakSet cycle guard.
- `server/src/common/transform.interceptor.ts` - Normalizes ObjectId→string, `_id`→`id`, Mongoose virtuals, cycle guard, depth 20.
- `server/src/orders/orders.service.ts` - `deliver()`, `cancel()` with role rule, atomic `processDelivery()`.
- `server/src/orders/orders.controller.ts` - `cancel()` passes `req.user.role`.
- `server/src/auth/auth.controller.ts` + `auth.service.ts` - Removes `/auth/register` and `register()` method.
- `server/src/seed/seed.service.ts` - Production guard: `NODE_ENV=production` + `SEED_ON_BOOT=true`.

## Deploy
- API on VPS: `git pull` + `docker compose build/up` (via `deploy-vps.sh`).
- Front on Vercel: merge on `main` triggers automatic deploy.
- JWT_SECRET rotated (old `dev-secret-change-in-production` now new value).

## P1 Hardening (branch `fix/confirm-payment-e-hardening`)
- **P0 confirm-payment**: `OrdersService.confirmPayment` is the single, idempotent source of truth. `PaymentsService.confirm` delegates to it and **no longer swallows** `BadRequestException`. Payment is only accepted when the order is `AGUARDANDO_PAGAMENTO`.
- **Payment validation** (`PaymentsService.create`): `amount` must equal `order.totalCents`; the payment shift must match the order shift; card requires `cardType` (debit/credit); cash requires `received >= amount` and computes `changeCents`.
- **Atomic reservation** (`OrdersService.submitForPayment`): revalidates open shift and availability; reserves with a conditional `findOneAndUpdate` (`stockQty - reservedQty >= qty`); rolls back previous reservations on failure; only writes `StockMovement` after all reservations succeed.
- **Shift availability**: `create` and `updateItems` require the product in `shift.availability` with `available=true` (being active in the catalog is not enough).
- **Shift close**: `close()` persists `expectedCashCents` and `differenceCents` on the shift, using `ReportsService.cashSummary()`.
- **Cash summary**: `cashSummary` now returns `pixCents`, `cardCents`, `cardDebitCents`, `cardCreditCents` and `totalSalesCents`.
- **Audit**: new `GET /audit/logs` and `GET /audit/entity/:entity/:entityId`, restricted to admin/responsible.
- **Regression**: `server/scripts/smoke-sale-flow.mjs` (`npm run smoke`) covers login, shift, create/edit, submit, payment rejections, cash with change, Pix, idempotency, stock reserve/release, cash summary, audit and persisted shift close.
- **Status rule**: products without `requiresPrep` go to `PRONTO` after payment; with prep go to `PAGO`. Stock is still only decreased on explicit delivery.

## P1 Pending (remaining)
- Automated test framework (unit/e2e) — only the smoke script exists today.
- `populate('availability.product')` does not populate in `GET /shifts/current`/`GET /shifts/:id/products` (returns ids only).
- `adjustStock` without `StockMovement`/audit.
- `.env.production` tracked with a dev JWT secret (history cleaned; check deploy).
- `npm audit` vulnerabilities and no lint in CI.

## Repository Git (server)
- Branch: `main` (protected)
- Last commit: `5b37dee chore: versiona apenas .env.example (remove .env.production)`
- Merged PRs:
  - #1: `fix: serialization, delivery without payment and seed in production` (e33e192 → 5b37dee)
  - #2: `chore: versiona apenas .env.example (remove .env.production)` (bd3430b)
  - #3: `feat: add search parameter to order listing` (d20dd3e)
- `.env.production` removed from history via `git-filter-repo` + force push
- Only `.env.example` is versioned
- `.gitignore` ignores `.env` and `.env.*`, releases only `.env.example`

## API Status (running at http://localhost:4000 / https://quiosque-api.136-248-90-172.nip.io)

### Authentication
- `POST /auth/login` ✅ 200 (admin/admin123)
- `GET /auth/me` ✅ 200 (returns user with string id)
- `POST /auth/register` ✅ 404 (removed)

### Orders
- `GET /orders?page=1&limit=10` ✅ Returns `data` array with real string ids
- `POST /orders` ✅ Returns `id` string (not `null`/`[object Object]`)
- `GET /orders?search=term` ✅ New search filter (code, dayKey, pickupName)
- `POST /orders/:id/submit` ✅ Reserves stock, changes status to `awaiting_payment`
- `POST /payments` ✅ Receives `amount`/`reais`, not `amountCents`/`receivedCents`
- `PATCH /payments/:id/confirm` ✅ Confirms payment
- `POST /orders/:id/deliver` ✅ Delivery only if paid; stock 50→48 and reserved 2→0
- `POST /orders/:id/cancel` ✅ Attendant→201 (no payment), 403 (with payment); Admin→201

### Specific Statuses
- `deliver()` on unpaid order → **400** "Order needs to be paid", stock unchanged
- `cancel()` attendant on unpaid order → **201**
- `cancel()` attendant on paid order → **403** "Cancellation after payment requires responsible or admin"
- `cancel()` admin on paid order → **201**

### Products Without Prep
- Auto-delivery: order without `requiresPrep` (e.g., Mineral Water) goes directly to `PRONTO` upon payment
- `confirmPayment` now sets correct status: `requiresPrep=false` → `PRONTO`; `requiresPrep=true` → `PAGO`

### Turns
- `GET /shifts/current` ✅ Returns active turn with `initialCashCents` in reais
- Shift close: calculates expected/cashReceived/difference

### Stock
- Atomic decrease: `stockQty >= qty` && `reservedQty >= qty` → `ConflictException` (409) if insufficient
- `reservedQty` never negative (conditional validation in `processDelivery`)

## Modified Files
- `src/main.ts` - Interceptor order
- `src/common/interceptors/currency-response.interceptor.ts` - Safe converter
- `src/common/transform.interceptor.ts` - Response normalizer
- `src/orders/orders.service.ts` - Delivery/cancel/confirm-payment logic
- `src/orders/orders.controller.ts` - Cancellation with role
- `src/auth/auth.controller.ts` - Removes register
- `src/auth/auth.service.ts` - Removes register
- `src/seed/seed.service.ts` - Production guard
- `deploy-vps.sh` - No longer copies `.env.prod`; warns if `JWT_SECRET` is example value

## Environment Variables
- `NODE_ENV=production` in Docker ⇒ automatic seed **disabled** (protects production)
- `SEED_ON_BOOT=false` ⇒ always off (safe default)
- `JWT_SECRET` ⇒ rotated, old was public (already rotated)

## Next Steps (P1)
- Automated tests (e2e/unit)
- Payment amount validation
- Close-shift expected/difference persisted
- Audit read endpoint
- Pix/Card correct in Shifts UI
- Tests/lint/npm audit resolution

# Quiosque do Coco - API (Server) - Current State (11/11/2026)

## Work in progress
- Branch: `fix/confirm-payment-e-hardening` (from `main`)
- Changes not committed/pushed yet in this session.
- P0 + P1 package implemented and validated with a regression script.

## Builds and validation
- `npx tsc --noEmit -p tsconfig.json` ✅ (no errors)
- `npm run build` (`nest build`) ✅ (no errors)
- `cd web && npm run build` (`vite build`) ✅ (no errors)
- `npm run smoke` (regression script) ✅ against disposable database `quiosque_smoke`
- `npm run smoke` ✅ also against the local database (`quiosque`, reusing shift #12)
- No test residue: smoke orders/payments/movements/logs removed; stock restored (`Croissant` 4/0).

## Fixes in this session

### P0 — payment confirmation
- `OrdersService.confirmPayment` is the single idempotent source of truth:
  - accepts `pending` or `confirmed` payment;
  - releases the order exactly once (`paidAt` set);
  - `requiresPrep=false` → `pronto`; `requiresPrep=true` → `pago`;
  - does not decrease stock (only explicit delivery does).
- `PaymentsService.confirm` delegates to `OrdersService.confirmPayment` and **no longer swallows** `BadRequestException`.
- Payment is only accepted while the order is `aguardando_pagamento`.

### P1 — payment validation
- `amount` must equal `order.totalCents` (never a free-form value).
- Payment shift must match the order shift.
- Card requires `cardType` (`debito`/`credito`).
- Cash requires `received >= amount` and stores `changeCents`.

### P1 — atomic reservation and availability
- `submitForPayment` revalidates open shift and shift availability.
- Conditional atomic reservation: `stockQty - reservedQty >= qty` via `findOneAndUpdate`.
- Rolls back already-made reservations if any item fails.
- `StockMovement` is only created after all reservations succeed.
- `create` and `updateItems` require the product in `shift.availability` with `available=true`.

### P1 — shift close
- `ShiftsService.close` persists `expectedCashCents` and `differenceCents`.
- `ReportsService.cashSummary` returns `pixCents`, `cardCents`, `cardDebitCents`, `cardCreditCents` and `totalSalesCents`.
- `ShiftsModule` imports `ReportsModule`; `ReportsModule` exports `ReportsService`.

### P1 — shift populate
- `ShiftAvailability` now has its own schema (`ShiftAvailabilitySchema`); previously Mongoose registered `availability` as `Mixed`, ignoring the `product` ref.
- `GET /shifts/current` and `GET /shifts/:id/products` now return the full product.

### P1 — audit
- `GET /audit/logs` (filters `action`, `entity`, `userId`, `start`, `end`).
- `GET /audit/entity/:entity/:entityId`.
- Restricted to `admin` and `responsavel`; validates ObjectId/dates.

## Endpoint status (API: http://localhost:4000)

### Authentication
- `POST /auth/login` ✅ 200 (httpOnly `auth_token` cookie)
- `GET /auth/me` ✅ 200
- `POST /auth/register` ✅ 404 (removed)

### Orders
- `GET /orders?page=1&limit=10` ✅ `data` with string ids
- `POST /orders` ✅ string id; product must be available in the shift
- `POST /orders/:id/submit` ✅ atomic reservation and `aguardando_pagamento`
- `POST /orders/:id/confirm-payment` ✅ single source, idempotent
- `POST /orders/:id/deliver` ✅ paid only; conditional stock decrease
- `POST /orders/:id/cancel` ✅ attendant before payment; admin/responsible after payment

### Payments
- `POST /payments` ✅ validates amount, shift, card type and change
- `PATCH /payments/:id/confirm` ✅ delegates to the order; errors are no longer swallowed
- `PATCH /payments/:id/reject` ✅ sets `nao_confirmado`
- `GET /reports/cash/:shiftId` ✅ cash/Pix/card/expected/difference

### Shifts
- `GET /shifts/current` ✅ open shift with populated `availability.product` (name/price/stock)
- `POST /shifts/:id/close` ✅ persists `expectedCashCents`/`differenceCents`
- `GET /shifts/:id/products` ✅ returns the full shift products

### Audit
- `GET /audit/logs` ✅ admin/responsible
- `GET /audit/entity/:entity/:entityId` ✅ admin/responsible

## Regression script
- File: `server/scripts/smoke-sale-flow.mjs`
- Command: `npm run smoke`
- Variables: `API_URL` (default `http://localhost:4000`), `MONGODB_URI` (local default), `--keep` to skip cleanup.
- Opens a shift automatically when none is open; in that case it also validates and deletes the shift at the end.
- Covers: login; create order; payment before submit (400); mismatched amount (400); mismatched shift (400); card without type (400); cash with change; Pix; idempotent confirmation; `pronto`/`pago` status; stock reserve/release; cash summary; audit; persisted shift close; Mongo cleanup.

## Local data
- `quiosque` database: open shift #12, 184 orders, 184 payments (no smoke residue).
- Optional old residue: cancelled order `6af461c2f6fa028bdd50c2e1` (pickup "Teste Regressao") + payment/logs.

## Next steps
- Commit on the branch and open a PR (no automatic push).
- (Done) `populate('availability.product')` fixed with a dedicated subdocument schema; the frontend accepts id or object during deploy.
- Add `StockMovement`/audit to `adjustStock`.
- Introduce a test framework (Jest/Supertest) reusing the smoke script flow.
- Resolve `npm audit` and add lint to CI.

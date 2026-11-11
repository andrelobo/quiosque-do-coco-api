# Quiosque do Coco - API (Server) - Current State (2026-11-11)

## Work in progress
- Branch: `main` synced with `origin/main` (`a3fb4a7`).
- PRs #3 (web) and #4 (API) merged; remote fix branches removed.
- This round's changes are **not committed yet** (stock adjustment, audit, tests, lint and CI).

## Builds and validation
- `npx tsc --noEmit -p tsconfig.json` ✅ (no errors)
- `npm run build` (`nest build`) ✅ (no errors)
- `npm run lint:check` ✅ (0 errors, 0 warnings)
- `npm test` ✅ (`2` suites, `13` tests)
- `cd web && npm run build` (`vite build`) ✅ (no errors)
- `npm run smoke` (regression script) ✅ against disposable database `quiosque_smoke`
- `npm run smoke` ✅ also against the local database (`quiosque`, reusing shift #12)
- No test residue: smoke orders/payments/movements/logs removed; stock restored (`Croissant` 4/0).

## Merged fixes (PR #4)

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
- Frontend accepts `availability.product` as either id or object during deploy.

### P1 — audit
- `GET /audit/logs` (filters `action`, `entity`, `userId`, `start`, `end`).
- `GET /audit/entity/:entity/:entityId`.
- Restricted to `admin` and `responsavel`; validates ObjectId/dates.
- `AuditService.log` fills `userName` from `userId`.

## This round's deliveries (not committed)

### Stock adjustment with movement and audit
- `PATCH /products/:id/stock` (`ProductsService.adjustStock`):
  - integer non-zero `qty` (`AdjustStockDto` with `IsInt`/`NotEquals(0)`);
  - required non-blank `reason`;
  - 404 for unknown product; 409 for `trackStock=false`;
  - atomic update with `$expr: { $gte: [{ $add: ['$stockQty', qty] }, 0] }`, no lost update;
  - 409 when the adjustment would go negative, without writing movement/audit;
  - writes a `StockMovement` of type `ajuste` (signed `qty`, `balanceAfter`, `reason`, `user`);
  - writes audit `product.stock.adjusted` with `previousQty`/`balanceAfter` in `meta`.
- `ProductsModule` registers `StockMovement` and imports `AuditModule`.
- Validated via API: `+5` ok; `-999` 409; `qty=0` 400; empty reason 400; no `trackStock` 409; movement and audit written.

### Automated tests
- Jest + ts-jest (`jest.config.js`), no database dependency.
- Scripts: `npm test`, `npm run test:watch`, `npm run test:cov`.
- `src/products/products.service.spec.ts`: valid adjustment, invalid qty, empty reason, unknown product, no stock tracking and negative-balance guard.
- `src/orders/orders.service.spec.ts`: confirmation with/without prep, idempotency, order not awaiting payment, cancelled and missing payment.
- Result: `2` suites, `13` tests passing.

### Lint and CI
- ESLint 9 flat config (`eslint.config.mjs`) + typescript-eslint.
- `npm run lint` (with `--fix`) and `npm run lint:check` (validation only).
- Unused imports removed across controllers/DTOs/services.
- `.github/workflows/ci.yml`: `npm ci` + `lint:check` + `test` + `build` on PRs and `main`.
- `.github/workflows/deploy.yml`: VPS deploy now only runs after CI succeeds (`workflow_run`), keeping `workflow_dispatch`.
- `.github/dependabot.yml`: weekly npm (groups `@nestjs/*` and dev tooling) and monthly GitHub Actions.

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

### Products and stock
- `PATCH /products/:id/stock` ✅ atomic adjustment + `StockMovement` + audit
- `GET /stock/product/:id` ✅ movements with user
- `GET /reports/stock` ✅ summary by type and balance per product

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
- Disposable `quiosque_smoke` database: dropped after validation.
- Optional old residue: cancelled order `6af461c2f6fa028bdd50c2e1` (pickup "Teste Regressao") + payment/logs.

## Next steps
- Commit this round's changes and open a PR (no automatic push).
- Major Nest upgrade (`@nestjs/cli@12`, `@nestjs/*@12`, `@nestjs/config@12`) on a dedicated branch to clear `npm audit`; validate with `test`, `build` and `smoke`.
- Evaluate Mongo-backed e2e tests in CI (CI currently covers only unit tests).
- Keep Dependabot active and review grouped PRs weekly.

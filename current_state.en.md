# Quiosque do Coco - API (Server) - Current State (2026-11-16)

## Current state
- Branch `main` synced with `origin/main` at `455ba5b` (PR #22, no open branches).
- Merged in order: #22 empty report dates (`455ba5b`), #21 accent-insensitive search + business-timezone reports (`db4716b`), #20 roles/permissions (`abecee1`), #19 smoke against real Mongo in CI (`1cde89b`).
- The API deploy only runs after CI is green (`workflow_run`); the `455ba5b` run succeeded.

## Builds and validation (2026-11-16)
- `npx vitest run` ✅ `6` suites, `35` tests
- `npm run lint:check` ✅ (0 errors)
- `npm run build` (`nest build`) ✅
- `npm run smoke` ✅ (CI `smoke` job, disposable MongoDB 7)
- Deploy validated in production on SHA `455ba5b` (reports `?start=&end=` → 200)
- `docker build` + Node 22 container ✅ (`/api/docs` 200)
- `npm audit`: 7 dev-only moderate, 0 high

## Nest 12 upgrade (2026-11-11)
- Nest `common/core/platform-express` 12.4, `config` 12.1, `swagger` 12.1, `jwt` 12.0, `mongoose` 12.0, `passport` 12.0, `cli/schematics/testing` 12; TypeScript 6; Node 22 (CI and Dockerfile).
- Nest 12 is ESM-only; the build stays CommonJS and the runtime uses Node's native `require(ESM)` (`>=22.12`).
- Jest/ts-jest → Vitest 5 + `unplugin-swc` (decorator metadata); `jest.config.js` removed.

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

## Deliveries from 2026-11-11 (merged)

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
- Vitest 5 + `unplugin-swc` (replaced Jest/ts-jest), no database dependency.
- Scripts: `npm test`, `npm run test:watch`, `npm run test:cov`.
- Suites: `products.service.spec.ts`, `orders.service.spec.ts`, `orders.service.search.spec.ts`, `reports.service.spec.ts`, `common/search/search-utils.spec.ts`, `common/time/business-time.spec.ts`.
- Result on 2026-11-16: `6` suites, `35` tests passing.

### Lint and CI
- ESLint 9 flat config (`eslint.config.mjs`) + typescript-eslint.
- `npm run lint` (with `--fix`) and `npm run lint:check` (validation only).
- Unused imports removed across controllers/DTOs/services.
- `.github/workflows/ci.yml`: `npm ci` + `lint:check` + `test` + `build` on PRs and `main`.
- `.github/workflows/deploy.yml`: VPS deploy now only runs after CI succeeds (`workflow_run`), keeping `workflow_dispatch`.
- `.github/dependabot.yml`: weekly npm (groups `@nestjs/*` and dev tooling) and monthly GitHub Actions.

## Search and reports (2026-11-16)

### Server-side order search
- `GET /orders?status=&page=&limit=&search=` — filtering and pagination on the server (`page` minimum 1; `limit` between 1 and 100).
- Term normalized (no accents, case-insensitive) and regex escaped by `buildSearchRegex`.
- Numeric term (`12` or `#12`) matches **only** `code` — never `dayKey`, which is also numeric and would match every order.
- Non-numeric term matches `pickupName`, `items.name`, `dayKey` and `code` through `$expr/$toString` (no `CastError`).
- Before: searching `(` returned **500** (`CastError: Cast to number failed ... path "code"`).

### Report rules
- Sales count only paid orders: `SOLD_ORDER_STATUSES` = `PAGO`, `EM_PREPARO`, `PRONTO`, `ENTREGUE`.
- Day filter and grouping use `BUSINESS_TIMEZONE` (`America/Sao_Paulo`).
- Empty or blank `start`/`end` = "today" (the screen opens with `?start=&end=`); invalid format and start > end still return **400**.
- Aggregations project `date`, `shift`, `productId`, `method` and `_id: 0`, avoiding `"[object Object]"` after `TransformInterceptor`.

## Endpoint status (API: http://localhost:4000)

### Authentication
- `POST /auth/login` ✅ 200 (httpOnly `auth_token` cookie)
- `GET /auth/me` ✅ 200
- `POST /auth/register` ✅ 404 (removed)

### Orders
- Order reads (`findAll`, `findById`, `findByShift`, `findByCode`) populate `shift` with `{ number, id }`, required by the frontend to register payments in `/orders`.
- `GET /orders?page=1&limit=10&search=&status=` ✅ `data` + `total`/`totalPages` with string ids; server-side search
- `GET /orders?search=(` ✅ 200 (used to be 500); numeric term matches `code` only
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

### Reports
- `GET /reports/sales/period-shift` ✅ paid orders only, grouped by day/shift in the business timezone
- `GET /reports/sales/by-product` ✅ same filter
- `GET /reports/payments/by-method` ✅ same filter
- `GET /reports/cancellations-refunds` ✅ empty period = today; invalid = 400
- `GET /reports/orders/pending-delivery` ✅ admin/responsible/attendant
- `GET /reports/stock` ✅ summary by type and balance per product (see Products and stock)

## Regression script
- File: `server/scripts/smoke-sale-flow.mjs`
- Command: `npm run smoke`
- Variables: `API_URL` (default `http://localhost:4000`), `MONGODB_URI` (local default), `--keep` to skip cleanup.
- Runs in CI (`smoke` job): MongoDB 7 service container, disposable `quiosque_e2e` database and the API started from `dist/main.js`.
- Opens a shift automatically when none is open; in that case it also validates and deletes the shift at the end.
- Covers: login; create order; payment before submit (400); mismatched amount (400); mismatched shift (400); card without type (400); cash with change; Pix; idempotent confirmation; `pronto`/`pago` status; stock reserve/release; cash summary; audit; persisted shift close; Mongo cleanup.

## Local data
- `quiosque` database: 184 orders and 184 payments; no open shift at the moment (no smoke residue).
- Disposable test databases (`quiosque_smoke`, `quiosque_search_e2e`, `quiosque_reports_e2e`): dropped after validation.
- Optional old residue: cancelled order `6af461c2f6fa028bdd50c2e1` (pickup "Teste Regressao") + payment/logs.

## Next steps
- Keep Dependabot active and review grouped PRs weekly.
- Revisit `npm audit` when `typescript-eslint`/`minimatch` get a fix.
- PDF report export: evaluated on 2026-11-16 (recommendation: "Print / PDF" button with print CSS); not implemented by client decision — revisit if needed.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dash Meal** — SaaS food ordering platform for the CEMAC zone (Central Africa). Multi-tenant architecture: one `superadmin` manages multiple restaurant brands; each brand has an `admin` who manages orders, products, branches, and delivery.

## Monorepo Commands

```bash
# Root (Turbo)
pnpm dev          # Start all apps (admin: 3000, backend: 3001, mobile: Expo)
pnpm build        # Build all packages (shared → backend/admin)
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
pnpm clean        # Remove all dist/.next outputs

# Single package
pnpm --filter @dash-meal/admin dev
pnpm --filter @dash-meal/backend dev
pnpm --filter @dash-meal/mobile start

# No test runner — validate with typecheck + lint
pnpm --filter @dash-meal/admin typecheck
pnpm --filter @dash-meal/backend typecheck
```

## Architecture

### Packages
| Package | Tech | Port |
|---------|------|------|
| `apps/admin` | Next.js 16 App Router + React 19 | 3000 |
| `apps/backend` | Express 4 + ESM + tsx | 3001 |
| `apps/mobile` | Expo 54 + React Native 0.81 | Expo |
| `packages/shared` | TypeScript types + Zod schemas + constants | — |

### Shared Package (`@dash-meal/shared`)
Single source of truth for types, schemas, and constants. Import from `@dash-meal/shared` in both admin and backend. Key exports:
- `UserRole`, `AdminRole`, `OrderStatus`, `PaymentMethod`, `BrandApplicationStatus`
- Zod schemas for auth, products, orders, brands, payments
- `COMMISSION_RATE_ONLINE` (2%), `COMMISSION_RATE_INPERSON` (1.5%), `API_PREFIX` ("/api/v1")
- `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`, `AuthTokens`

### Admin App — Next.js App Router
**Route structure:** `src/app/[locale]/(auth)/` and `src/app/[locale]/(dashboard)/`

**i18n:** `next-intl` with `fr` (default) and `en`. Translations in `messages/fr.json` and `messages/en.json`. Always use `useTranslations()` hook — never hardcode French/English strings.

**Auth:** Zustand store (`src/stores/auth.ts`) persisted as `dash-meal-auth`. Auth tokens in cookies: `dm_access_token` (15min) and `dm_refresh_token` (30d). The Axios instance (`src/lib/api.ts`) auto-injects Bearer token and handles 401 refresh+retry.

**API calls:** Use typed helpers `apiGet<T>`, `apiPost<T>`, `apiPatch<T>`, `apiDelete<T>` from `src/lib/api.ts`. All return `response.data` directly (unwrapped from `{ success: true; data: T }`).

**State:** TanStack React Query for server state. Zustand only for auth.

**UI:** Radix UI primitives wrapped in `src/components/ui/`. Custom design tokens: brand orange (`#f97316`), dark surface palette (`surface.*`). Always use `cn()` from `src/lib/utils.ts` for conditional classes.

**Path alias:** `@/*` → `src/*`

### Backend App — Express
**Module pattern:** Every domain has `module.controller.ts` + `module.routes.ts` + `module.service.ts` under `src/modules/`.

**Middleware stack:** `helmet` → `cors` → `morgan` → `express-rate-limit` → `express.json` → routes → `errorHandler`

**Auth middleware** (`src/middleware/auth.ts`): Verifies JWT, attaches `req.user` with `{ id, role, brand_id? }`.

**Validation** (`src/middleware/validate.ts`): Wraps Zod schemas. Use `validate(schema)` before route handlers.

**All responses must follow:**
```typescript
// Success
res.json({ success: true, data: T, message?: string })
// Error — via errorHandler
throw new AppError(statusCode, "ERROR_CODE", "Human message")
// Paginated
res.json({ success: true, data: T[], pagination: { page, limit, total, total_pages } })
```

**Database:** Supabase (service role key) — all queries via `src/config/supabase.ts`. Never use Supabase Auth on the backend; use custom JWT.

### Mobile App — Expo
**Routing:** Expo Router (file-based, `src/app/`). Auth tokens in `expo-secure-store`.

**i18n:** i18next with inline translations in `src/lib/i18n.ts` (no external JSON files). Device locale detection via `expo-localization`, fallback to French.

## Key Conventions

- **Role isolation:** `superadmin` routes live under `/superadmin/*`. Regular `admin` routes must never expose superadmin data. Check `req.user.role` in backend middleware.
- **Brand isolation:** Every admin query must filter by `brand_id`. Never return cross-brand data to admins.
- **Currency:** CEMAC (CFA franc). Format amounts with `formatCurrency()` from `src/lib/utils.ts`.
- **Payments:** Mobile Money via Campay (CEMAC-specific). Webhook endpoint: `/api/v1/payments/webhook/campay`.
- **File uploads:** Multer → Supabase Storage. Buckets: `product-images`, `brand-documents`, `invoices`. Max 5MB, types: JPEG/PNG/WebP.
- **OTP:** Africa's Talking SMS. 6 digits, 10-minute expiry.
- **Commission:** Auto-calculated — 2% online payments, 1.5% in-person.

## Environment Files

- `apps/admin/.env.local` — `NEXT_PUBLIC_API_URL`
- `apps/backend/.env.local` — Supabase, JWT secrets, Campay, Africa's Talking, Google Maps, Expo push token
- `apps/mobile/.env.local` — `EXPO_PUBLIC_API_URL`

See `apps/backend/.env.local.example` for required variables.

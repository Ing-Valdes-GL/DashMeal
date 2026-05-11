# CLAUDE.md — Dash Meal Project Memory
> Last updated: 2026-05-11. Read this BEFORE touching any file — it prevents re-reading the whole codebase.

---

## TL;DR
SaaS food-delivery app for CEMAC zone (Central Africa, XAF). Monorepo: Next.js admin + Express backend + Expo mobile. Primary color: **`#53B175`** (Nectar green). Backend on Railway. DB on Supabase.

---

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

---

## Mobile Design System (Nectar-inspired)
```
Colors.primary      = "#53B175"   // Nectar green — buttons, active tabs, badges
Colors.primaryLight = "#F2F9F0"   // light green tint
Colors.primaryDark  = "#3E8C58"
Colors.bg           = "#FFFFFF"
Colors.pageBg       = "#F2F3F2"
Colors.card         = "#FFFFFF"
Colors.inputBg      = "#F2F3F2"
Colors.text         = "#181725"
Colors.text2        = "#7C7C7C"
Colors.text3        = "#B3B3B3"
Colors.border       = "#E2E2E2"
Colors.divider      = "#F2F3F2"
```
- Auth screens: **light/white** background (NOT dark — changed from previous dark theme)
- Buttons: full-width rounded green pill (height 56-67)
- All icons: Ionicons from `@expo/vector-icons` — NEVER emoji as structural icons
- i18n: `useTranslation()` from `react-i18next` in EVERY screen
- Currency: `formatCurrency(amount)` from `@/lib/utils`

## Mobile Tab Structure (5 tabs — Nectar style)
1. `index`     → Home (Shop): banner carousel + categories + products from API
2. `explore`   → Explore: category grid + product search (API)
3. `cart`      → Cart: items from Zustand + checkout navigation
4. `favorites` → Favourites: user favorites from API (auth wall for guests)
5. `profile`   → Account: orders link, settings, language, logout

Hidden (href:null): `reels` (accessible via home), `marketplace` (merged into explore), `orders` (in profile)

## Mobile API (Backend at Railway)
```
API_URL = process.env.EXPO_PUBLIC_API_URL (https://hopeful-gentleness-production.up.railway.app/api/v1)
Auth tokens: dm_access_token (SecureStore, 15min) + dm_refresh_token (30d)

POST /auth/user/register        { name, email, phone?, password }
POST /auth/user/login           { email, password } | { phone, password }
POST /auth/user/send-otp        { phone }
POST /auth/user/verify-phone    { phone, otp }
POST /auth/user/send-email-otp  { email }
POST /auth/user/verify-email    { email, otp }
POST /auth/refresh              { refresh_token }

GET  /branches/public           ?lat&lng&limit&category&search
GET  /products/public           ?flash&promo&limit&category&branch_id&search
GET  /products/public/:id
GET  /categories/public

GET  /orders                    (auth)
POST /orders                    (auth) { branch_id, items, type, address? }
GET  /orders/:id
GET  /reels                     ?limit&offset
POST /reels/:id/like            (auth)
DELETE /reels/:id/like          (auth)
GET  /user/favorites            (auth)
POST /user/favorites            (auth) { product_id }
DELETE /user/favorites/:id      (auth)
GET  /user/profile              (auth)
PATCH /user/profile             (auth)
```

## Key Files (mobile)
```
apps/mobile/src/lib/theme.ts      Design tokens (GREEN palette)
apps/mobile/src/lib/api.ts        Axios, interceptors, apiGet/Post/Patch/Delete
apps/mobile/src/lib/i18n.ts       i18next FR+EN, AsyncStorage, setLanguage()
apps/mobile/src/lib/utils.ts      formatCurrency, formatDate
apps/mobile/src/stores/auth.ts    Zustand: user, isAuthenticated, isGuest, continueAsGuest()
apps/mobile/src/stores/cart.ts    Zustand: items, addItem, updateQuantity, getTotal(), getCount()
```

## Done ✅ / Pending ⏳
### Done
- Mobile: 5-tab Nectar redesign (green palette, all screens)
- Mobile: react-native-maps@1.20.1 installed
- Mobile: Email+phone auth (login/register/OTP)
- Mobile: Guest mode (isGuest in auth store)
- Admin: PWA (@ducanh2912/next-pwa) + manifest + driver web app
- DB: Migration 010 (email auth, reels, drivers, deliveries, sponsored branches, flash/promo)

### Pending
- Backend: driver endpoints (GET/PATCH /driver/deliveries, GET /driver/earnings)
- Backend: reels + favorites endpoints
- Admin: Generate PWA icons → public/icons/*.png from realfavicongenerator.net
- Google OAuth + Apple Sign-In (currently stub Alert)
- Push notification token registration

# G1: Credits Points System — Test Report

## Summary

Implemented a full credits points system with tier-based multipliers, transaction ledger, and desktop UI.

## Backend (Den API)

### Schema (`ee/packages/den-db/src/schema/credits.ts`)
- `CreditsBalanceTable`: org_id (PK), tier (free/pro/enterprise), balance, total_purchased, total_consumed
- `CreditsTransactionTable`: id (PK), org_id, type (purchase/consumption/refund/grant), amount, balance_after, description, reference

### Service (`ee/apps/den-api/src/credits/credits-service.ts`)
- `getBalance(orgId)` — returns balance + tier + totals + multiplier
- `getTier(orgId)` — returns current tier
- `setTier(orgId, tier)` — updates tier
- `addCredits(input)` — purchase or grant; updates balance + total_purchased; records transaction
- `deductCredits(input)` — consumption; applies tier multiplier (ceil); rejects if insufficient; records transaction
- `refundCredits(input)` — refund; increases balance; records transaction
- `getTransactions(orgId, limit, offset)` — paginated transaction list
- `InsufficientCreditsError` — thrown when balance < effective amount

### Tier Multipliers
| Tier | Multiplier |
|------|-----------|
| free | 1.0 |
| pro | 0.8 |
| enterprise | 0.6 |

### Routes (`ee/apps/den-api/src/routes/credits/index.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/credits/balance` | Get org credits balance |
| GET | `/v1/credits/transactions` | List transactions (paginated) |
| POST | `/v1/credits/purchase` | Purchase credits |
| POST | `/v1/credits/grant` | Grant credits (admin) |
| POST | `/v1/credits/consume` | Consume credits |
| POST | `/v1/credits/refund` | Refund credits |
| PUT | `/v1/credits/tier` | Set org tier |

## Frontend (Desktop App)

### Den Client (`apps/app/src/app/lib/den.ts`)
- Added `DenCreditsBalance`, `DenCreditsTransaction`, `DenCreditsTier` types
- Added `getCreditsBalance`, `listCreditsTransactions`, `purchaseCredits`, `setCreditsTier` methods

### Settings UI (`apps/app/src/react-app/domains/settings/credits-section.tsx`)
- Balance display with tier, total purchased/consumed, multiplier
- Tier selector (free/pro/enterprise buttons)
- Purchase input + button
- Recent transactions list with type, amount, description, timestamp
- Error display

### i18n
- 27 `credits.*` keys added to both `en.ts` and `zh.ts`
- i18n completeness test: 6/6 pass (zh parity maintained)

## Test Results

### Credits Service Tests (`ee/apps/den-api/src/credits/credits-service.test.ts`)
```
bun test src/credits/credits-service.test.ts
11 pass
0 fail
18 expect() calls
```

Tests cover:
- Tier multipliers (free=1.0, pro=0.8, enterprise=0.6, unknown=1.0)
- TIER_MULTIPLIERS export values
- InsufficientCreditsError construction and inheritance
- Effective deduction math (including ceil rounding for pro tier)

### i18n Completeness (`apps/app/tests/i18n-completeness.test.ts`)
```
6 pass
0 fail
```

### Typecheck
- Den API: no credits-related errors
- Desktop app: no credits-related errors

## Status: PASSED
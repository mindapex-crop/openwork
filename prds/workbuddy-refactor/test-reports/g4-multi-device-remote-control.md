# G4: Multi-Device Remote Control — Test Report

## Feature Summary

Implemented full multi-device remote control infrastructure: desktop generates pairing codes, mobile pairs via code, mobile sends remote control commands (continue/stop/lock/unlock), desktop executes and shows lock overlay.

## Architecture

### Server (`apps/server/src/devices/` + `apps/server/src/routes/devices.ts`)
- **Device Store** (`device-store.ts`): SQLite tables `paired_devices` + `device_control_queue`
- **Device Service** (`device-service.ts`): Pairing logic (60s TTL pair codes), device CRUD, control queue
- **REST Routes** (`routes/devices.ts`): 9 endpoints
  - `POST /api/devices/pair-code` — generate pair code (owner scope)
  - `GET /api/devices/pair-code` — query current pair code
  - `POST /api/devices/pair` — mobile submits pair code
  - `GET /api/devices` — list paired devices
  - `DELETE /api/devices/:deviceId` — revoke device
  - `POST /api/devices/:deviceId/heartbeat` — device heartbeat
  - `POST /api/devices/:deviceId/control` — send control command
  - `GET /api/devices/:deviceId/control` — get pending command
  - `GET /api/devices/control/pending` — batch get all pending (desktop poll)
  - `POST /api/devices/:deviceId/control/ack` — acknowledge command execution

### Desktop (`apps/app/src/react-app/domains/devices/`)
- **Device Store** (`device-store.ts`): Zustand store — fetch devices, issue pair code, revoke, poll control, ack
- **Mobile Access Section** (`settings/mobile-access-section.tsx`): Toggle + pair code display + device list
- **Lock Overlay** (`lock-overlay.tsx`): Full-screen lock when remote lock command received
- **Feature Flag**: `mobileAccess` in `local-provider.tsx` feature flags

### Mobile (`apps/mobile/src/`)
- **Device API** (`api/devices.ts`): pair, heartbeat, sendControl, getPendingControl, ackControl
- **Pairing Screen** (`screens/PairingScreen.tsx`): 6-digit code input + device name + pair button
- **Navigation**: Pairing screen added to stack navigator, entry from Settings

### i18n
- 23 new keys added to `en.ts` and `zh.ts` (`devices.*` namespace)
- Plural keys: `paired_count_one/other`, `minutes_ago_one/other`, `hours_ago_one/other`

## Test Results

### Server Route Tests (`apps/server/src/routes/devices.test.ts`)
```
9 pass, 0 fail, 31 expect() calls
```
Tests:
1. POST pair-code generates 6-digit code (owner scope)
2. POST pair-code non-owner scope → 403
3. Full pairing flow: pair code → pair → list → heartbeat → control → ack → revoke
4. POST pair wrong code → 400 pair_code_mismatch
5. POST pair no code → 400 pair_code_expired_or_invalid
6. POST control invalid command → 400 invalid_command
7. DELETE non-existent device → 404
8. POST heartbeat non-existent device → 404
9. POST control/ack non-existent command → 404

### Frontend Store Tests (`apps/app/tests/device-store.test.ts`)
```
8 pass, 0 fail, 14 expect() calls
```
Tests:
1. fetchDevices loads paired device list
2. issuePairCode generates pairing code
3. revokeDevice removes device from list
4. pollControlCommands receives lock → locked = true
5. pollControlCommands receives unlock → locked = false
6. pollControlCommands no commands → activeControlCommand = null
7. ackCommand clears activeControlCommand
8. fetchDevices network error → sets error

### Typecheck
- `apps/server`: ✓ pass
- `apps/app`: ✓ pass
- `apps/mobile`: ✓ pass

### i18n Audit
- Placeholder integrity: ✓
- Plural completeness: ✓ (all 10 locales)
- zh parity: ✓ (100%)

## Remaining (deferred to G7)
- 8 non-primary locales (ja, vi, pt-BR, th, fr, ca, es, ru) missing `devices.*` keys — will be translated in G7
- Mobile remote control UI (continue/stop/lock buttons) — API infrastructure is complete, UI can be added in follow-up
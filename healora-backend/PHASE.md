# Healora Backend — Project Phase Tracker

> Last updated: 2026-09-06
> Tracked phases for the SIH build. This is a living doc — tick boxes as work lands.

## Legend
- [x] done · [/] in progress · [ ] not started

---

## Phase 1 — Scaffolding & Foundation
- [x] Project structure (`healora-backend/` with `src/{config,controllers,routes,services,middleware}`)
- [x] `package.json` + dependency install
- [x] `.env` / `.env.example` + `.gitignore`
- [x] Prisma schema: all 7 models + 4 enums (UUID pk, `String[]` symptoms)
- [x] Config layer (`env.js`, shared `db.js`)
- [x] Middleware: `auth.js` (JWT + role factory), `errorHandler.js`

## Phase 2 — Core API
- [x] Auth: register + login (bcrypt + JWT), `authRoutes.js` (public)
- [x] Patients: create / get / list (relation-filtered by `ashaWorkerId`)
- [x] Triage: multipart upload → voice client → persist + auto-referral (voice microservice contract defined)
- [x] Appointments: doctor matching + suggested slots, confirm endpoint
- [x] Referrals: create + list (`?patientId=`)
- [x] Follow-ups: `?dueToday=true` + complete endpoint

## Phase 3 — Offline Sync
- [x] Last-write-wins sync service (`updatedAt` comparison, conflict reporting)
- [x] `POST /api/sync` batch upsert for TriageRecords + Appointments with summary

## Phase 4 — Wiring & DX
- [x] `app.js` (middleware order, route mounting, 404, errorHandler last)
- [x] `server.js` (DB connect then listen)
- [x] Seed script (9 mock doctors, 4 patients, demo worker, demo clinical data)
- [x] README (setup + API reference)
- [x] AGENTS.md, PHASE.md, ARCHITECTURE.md

## Phase 5 — Verification (DONE)
- [x] Database provisioned → **Supabase** (hosted Postgres, direct connection :5432; no local Postgres/Docker needed)
- [x] `prisma db execute` reachability check passed
- [x] `prisma migrate deploy` applied `20260905114937_init` to Supabase
- [x] `npm run seed` success against Supabase (9 doctors, 4 patients, demo worker)
- [x] Full 15/15 API smoke suite passed (ran against a throwaway local Postgres before the Supabase swap) — register/login/patients/appointments/referrals/follow-ups/sync LWW conflicts/401/400
- [x] `npm run dev` + `/health` smoke against Supabase (live on :3000, Supabase DB)
- [x] Live voice-service end-to-end against Supabase: **10/10 E2E pass** — login 9999999999/asha123, fever → 201/ROUTINE (+record, +TTS, +audioUrl), chest-pain → 201/EMERGENCY + auto-Referral, gibberish → clean 422. STT path uses **vosk** (Node 20.11.1); fallback to vosk **verified live** by breaking whisper-cli

## Phase 6 — Hackathon polish
- [ ] Rotate Supabase DB password BEFORE demo (it was pasted in chat) → update `DATABASE_URL`
- [ ] Unpause Supabase free tier before demo day (it pauses after ~1 week idle)
- [ ] Git init + first commit
- [ ] Postman collection / curl script for demo
- [ ] Slide-ready architecture diagram export
- [ ] Optional: Doctor-role auth (schema-ready, endpoints not built)

## Phase 7 — ASHA Mobile App (`healora-app/`, Expo RN) — **BUILT (A–D, 2026-09-25)**
- [x] Scaffold `create-expo-app --template blank-typescript` + deps (expo-audio, expo-secure-store, expo-status-bar, expo-asset, react-navigation native-stack). Target **Expo Go** — no dev client. **SDK 57** (54→57 upgrade 2026-09-06; Expo Go only runs the latest SDK). `.nvmrc` = **22.23.2**
- [x] `api/client.ts` (axios + JWT attach + 401→logout), `authStorage`, LoginScreen, `RootNavigator` + auth guard
- [x] Patient picker: list worker's patients + inline "quick add" (POST /api/patients)
- [x] Voice triage end-to-end: RecordButton (hold-to-record) → `POST /api/triage` → TriageResult (RiskBadge, symptoms, TTS play, autoReferral-driven referral card, "Book Appointment" CTA for EMERGENCY/URGENT). Handles **422** ("didn't catch that") and **502** (voice down) gracefully
- [x] Verification: `npx expo-doctor` 21/21, `npx tsc --noEmit` clean, `npx expo export --platform android` bundles OK.
- [x] Appointments confirm flow: `AppointmentsScreen` (pick one of 3 client-mirrored 10:00 slots → `POST /api/appointments {scheduledFor}` → matched-doctor card → `PATCH /api/appointments/:id/confirm` → success). `scheduledFor` passthrough added to `appointmentController.js` (2026-09-25, curl-verified). **New `GET /api/appointments`** (filterable `?ashaWorkerId=&patientId=&status=`, includes doctor+patient) powers "My Appointments" + the patient-profile appointment section. TTS playback bug fixed on `TriageResultScreen` (reactive `isLoaded` gate, real play/pause/replay toggle, playback audio-mode) and symptom→doctor matching fixed in `doctorMatchService.js` (underscore→space normalization + keyword aliases — verified chest-pain → Cardiologist)
- [x] Follow-up dashboard: `FollowUpsScreen` (due-today list via `GET /api/followups?dueToday=true`, mark-done via `PATCH /api/followups/:id/complete` optimistic update) + Home tile with count
- [x] Dashboard + patients + settings (2026-09-25): Home is a quick-action grid (Start triage, Patients, My appointments, Follow-ups, Book appointment, Settings) + always-on sync footer; standalone `PatientsScreen` (reuses shared `PatientList` — list, inline add, offline cached fallback); `PatientProfileScreen` aggregates past triages (disease detections, bookable per triage), appointments, referrals, follow-ups; `MyAppointmentsScreen` (status pills); `SettingsScreen` with persisted EN/हिंदी toggle (SecureStore + boot apply). Booking gate removed — the "Book appointment" CTA shows at EVERY risk level and booking is reachable from dashboard/patients/profile
- [x] Offline queue (expo-sqlite ✚ expo-network): `src/db/offlineDb.ts` (queue table ✚ `cached_patients` snapshot table) ✚ `src/store/offlineQueue.ts` — offline recordings re-upload via `POST /api/triage` on reconnect, appointment vouchers via `/api/sync` (doctorId required); `useOnlineStatus` auto-syncs on reconnect; `SyncStatusScreen` + Home footer (online badge, pending count, Sync Now). `PatientPickerScreen` is offline-capable: every successful fetch snapshots the list to SQLite; when offline (or status-0) it shows the cached patients with an "Offline" banner instead of a network error, and hides "Add patient" (create needs the network). Cached-patients-only scope — no offline quick-add (decided 2026-09-25)
- [x] Native-UI polish pass (2026-09-25, guided by the `expo-native-ui` skill at `.agents/skills/expo-native-ui/`): native stack header titles on every screen (Home = brand lockup w/ logo); page titles moved out of body; `contentInsetAdjustmentBehavior="automatic"` + `flex gap` + `borderCurve: 'continuous'` + `boxShadow` (no legacy elevation/SafeAreaView in scrollables); `selectable` on patient/doctor/transcription data; per-platform icons (`src/components/Icon.tsx` — SF Symbols on iOS, MaterialIcons on Android) in the Home grid/sync footer/play/record/logout buttons; `expo-image` logo (copied from repo root `logo.jpeg` → `assets/logo.jpeg`) rendered in Login, Home header, Settings profile card. npx tsc --noEmit clean + expo export bundles OK
- [x] Verification: `npx tsc --noEmit` clean, `npx expo export --platform android` bundles OK, backend E2E curl-verified (triage EMERGENCY+autoReferral → book PENDING → confirm CONFIRMED → sync LWW updated; followups due-today = 3; ROUTINE booking works — no risk gate; `GET /api/appointments` filters + 401). **Remaining:** live phone probe (voice, TTS play/pause/replay, QR-free scroll of all new screens, airplane-mode queue → reconnect auto-sync, booking)
- [ ] README (created 2026-09-06) + bilingual EN/हिंदी labels (default EN via `src/i18n/labels.ts`) + demo creds note

### Locked decisions (2026-09-05)
- **Audio format — RESOLVED, no TODO:** record **m4a** and upload as-is. Voice service `upload.js` whitelists `audio/m4a`/`audio/mp4`/`application/octet-stream` (*"Allow raw binary uploads from mobile"*); `AudioProcessor.convertToWav` converts any codec → 16kHz mono s16 WAV via bundled **ffmpeg-static**. No client-side WAV recording (impossible in expo) and no conversion step needed.
- **`expo-av` is removed in current SDKs** → use **`expo-audio`** (`useAudioRecorder`/`useAudioPlayer`, `RecordingPresets.HIGH_QUALITY`) behind `hooks/useVoiceRecorder.ts` (same start/stop/getUri surface). SDK pinned **54** originally, **upgraded to 57 on 2026-09-06** (Expo Go on the demo phone only supports the latest SDK; downgrading Expo Go was not possible). Same expo-audio API on both — no app code changed.
- **Node split:** app `.nvmrc` = **22.23.2** (SDK 57 tooling needs ≥20.19.4). Backends MUST stay **20.11.1** (vosk/`ffi-napi` native build breaks on newer NAPI v10 headers).
- **Offline triage → re-upload via `POST /api/triage` on reconnect**, NOT `/api/sync` — the sync endpoint only upserts verdict-bearing vouchers (client `id`, appointments need `doctorId`); an offline recording has no verdict. UI shows placeholder + "will process when online" — never a faked result. Appointments queue only when a doctor candidate snapshot already exists.
- **TTS `audioUrl` host rewrite:** backend builds it absolute vs `VOICE_SERVICE_URL` (localhost:4000) — app rewrites host to the configured API host when localhost (keeps :4000). Both services bind 0.0.0.0.
- `app.config.js` → `extra.apiBaseUrl` from `API_BASE_URL` (fallback `EXPO_PUBLIC_API_URL`, then `http://localhost:3000`).
- Demo on a real phone = **same hotspot + LAN IP, never localhost**; Android emulator = `10.0.2.2:3000`.
- Verify build headless via `npx tsc --noEmit` + `npx expo export --platform android`. Only live-untested item: on-device mic permission + hold-to-record UX (no physical phone available here).

---

## Demo Script (live — backend + voice service must be running first; app requires both)
0. Start the app in Expo Go (phone on same hotspot): `API_BASE_URL=http://<LAN-IP>:3000 npx expo start` → login `9999999999` / `asha123`
1. `GET /health` → service alive
2. `POST /api/auth/login` (9999999999 / asha123) → JWT
3. `POST /api/patients` → create patient
4. `POST /api/triage` (multipart audio) → voice service verdict + auto-referral if urgency high
5. `POST /api/appointments` → doctor matched + slot proposed
6. `GET /api/followups?dueToday=true` → dashboard count
7. `POST /api/sync` with an offline-record batch → LWW summary shown
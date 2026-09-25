# AGENTS.md — Healora Backend (working memory for AI agents)

Project-specific conventions, commands, and gotchas. Read this before editing.

## Project
Offline-first rural healthcare backend (SIH 2026). Node.js + Express + Prisma/PostgreSQL + JWT.
Voice microservice is a SEPARATE repo (teammate) at `http://localhost:4000/api/v1/voice/process`.
This backend only forwards audio and stores the returned verdict — never reimplement triage.

## Mobile app — `healora-app/` (Expo RN, ASHA-worker) — **BUILT (Phases A–D + UI polish, 2026-09-25)**
Expo **SDK 57** app at workspace root `healora-app/` (upgraded 54→57 — Expo Go only supports the latest SDK). Target **Expo Go**, `.nvmrc` = **22.23.2** (app only — backends MUST stay on 20.11.1 for the vosk native build). `npx expo-doctor` 21/21; `tsc --noEmit` + `expo export --platform android` green. **App renamed to Medola (2026-09-25).** Phase D BUILT: appointments confirm flow, follow-up dashboard, offline queue (expo-sqlite) + auto-sync on reconnect + `SyncStatusScreen`. **Native-UI polish pass (2026-09-25):** follows the `expo-native-ui` skill at `.agents/skills/expo-native-ui/` — native stack headers everywhere, `contentInsetAdjustmentBehavior`, flex gap, `borderCurve`, `boxShadow`, per-platform icons (`src/components/Icon.tsx`: SF Symbols iOS / MaterialIcons Android), and the app logo (`logo.jpeg` → `assets/logo.jpeg`, rendered on Login / Home header / Settings). New deps: `expo-image`, `expo-symbols`, `@expo/vector-icons`. Only live-untested: phone probe of voice/TTS/airplane-mode sync + the new UI on-device. Full plan + checkboxes in `PHASE.md` Phase 7.
- **Built surface:** `src/{api,components,hooks,i18n,navigation,screens,store,theme,utils}`; screens Login / Home (**quick-action dashboard grid** ✚ sync footer) / PatientPicker (triage flow) / **Patients** (standalone list, same shared `PatientList` component — offline cached fallback) / RecordTriage (hold-to-record via `hooks/useVoiceRecorder` → expo-audio; offline branch enqueues + "saved offline") / TriageResult (autoReferral-driven card, TTS play/pause/replay, "Book Appointment" CTA at **every** risk level) / Appointments (pick slot → book → confirm) / **PatientProfile** (triages/ appointments/referrals/follow-ups + bookable per triage) / **MyAppointments** (status pills) / FollowUps / SyncStatus / **Settings** (worker info + persisted EN/हिंदी toggle via SecureStore + logout). Auth via `authStorage` (expo-secure-store) + axios interceptor (401→logout). Errors mapped → 422 "didn't catch that", 502 "voice service unreachable", else server `error`; **status 0 = offline → patient list falls back to cache, triage queues recording**.
- **Gotcha:** a network failure (backend down / wrong host) surfaces as the generic *"Login failed. Check credentials."* message (status 0) — identical-looking to a bad password unless the server actually answered 401 ("Invalid credentials"). When login fails on a real phone, first check the backend: `curl http://<LAN-IP>:3000/health`.
- **Contract facts that differ from the friend's bullets:** login → `{ token, worker }` (no `ashaWorker` key); triage 201 → `{ triageRecord{id,symptoms[]}, ttsResponse, audioUrl, riskLevel, autoReferral|null }` (no `triageRecordId`); symptoms are `string[]`; appointments → `{ appointment, matchedDoctor, suggestedSlots }` (book = `POST /api/appointments {patientId, symptoms[], riskLevel}`, confirm = `PATCH /api/appointments/:id/confirm`); follow-up complete = `PATCH /api/followups/:id/complete` (NOT `/confirm`); error bodies `{success:false,error}` keyed by status (422 unclear/VoiceUnclearInputError, 502 voice down, 401 auth).
- **Audio format — RESOLVED, no TODO:** record **m4a** and upload as-is. Voice `upload.js` whitelists `audio/m4a`/`audio/mp4`/`application/octet-stream`; `AudioProcessor.convertToWav` converts any codec → 16k mono s16 WAV via bundled `ffmpeg-static`. No client WAV recording.
- **expo-av is removed in current SDKs** → use **expo-audio** (`useAudioRecorder`/`useAudioPlayer`, `RecordingPresets.HIGH_QUALITY`) behind `hooks/useVoiceRecorder.ts` (start/stop/getUri).
- **Offline sync semantics:** `/api/sync` upserts verdict-bearing vouchers (`id` required; appointments need `doctorId`). Offline triage rows have NO verdict → on reconnect **re-upload via `POST /api/triage`**, never `/api/sync`. Appointments queue only with a doctor-candidate snapshot. `scheduledFor` is now accepted (optional ISO) on `POST /api/appointments`.
- **TTS `audioUrl` host rewrite:** absolute vs `VOICE_SERVICE_URL` (localhost:4000) → rewrite host to configured API host when localhost (keep :4000). Both services bind 0.0.0.0.
- Config: `app.config.js` `extra.apiBaseUrl` from `API_BASE_URL` (fallback `EXPO_PUBLIC_API_URL`, then `http://localhost:3000`). Phone demo = same hotspot, LAN IP (never localhost); emulator = `10.0.2.2:3000`.
- Verify: `npx tsc --noEmit` + `npx expo export --platform android`. On-device mic/UX probe is the only live-untested item.

## Live infrastructure (as of 2026-09-05)
- **Database: Supabase-hosted PostgreSQL** (direct connection, port 5432 — NOT the pooler).
  Project: `amfrvyjpqzpeqtaqfrvp`. DB `postgres`, user `postgres`. URL lives in `.env` only.
- `migrate deploy` has applied `20260905114937_init`; seed data is live (9999999999 / asha123).
- **Gotcha: the DB password was pasted into chat → user must ROTATE it before demo** and update `.env`.
- **Gotcha: Supabase free tier pauses after ~1 week idle → unpause before live practice/demo.**

## Commands (run from `healora-backend/`)
- `npm run dev` — start server (nodemon, port 3000)
- `npm run start` — production start
- `npm run seed` — seed mock doctors / patients / demo worker (idempotent upserts)
- `npx prisma generate` — regenerate client after schema edits
- `npx prisma migrate deploy` — apply existing migrations to the remote DB (use for remote/Supabase)
- `npx prisma migrate dev --name <name>` — generate + apply a NEW migration (local shadow DB workflow)
- `npx prisma validate` — check schema syntax
- `npx prisma db execute --stdin <<< "SELECT 1;"` — quick reachability check
- Tests: no runner; smoke suite exists at `/tmp/opencode/pg/run_smoke.mjs` (local throwaway harness, not in repo)

## Conventions (thumb rules)
- **Route file naming:** `XxxRoutes.js` (singular), e.g. `authRoutes.js`, `patientRoutes.js`, `triageRoutes.js`,
  `appointmentRoutes.js`, `referralRoutes.js`, `followUpRoutes.js`, `syncRoutes.js`.
- **Controller file naming:** `XxxController.js`; handlers are `export const handler = async (req,res,next)`.
- **Every protected route** uses `authenticate` from `src/middleware/auth.js`. No route other than `/api/auth/*` may be public.
- **Every async handler** wraps logic in try/catch and calls `next(error)` — never `throw` from handlers (Express 4 does not catch async throws).
- **One shared PrismaClient** in `src/config/db.js` — never `new PrismaClient()` in controllers.
- **Config via `src/config/env.js`** — never read `process.env` directly in controllers/services/routes.
- **Comments are REQUIRED** in this repo — code is presented live to SIH judges; explain the "why".
- ESM (`import`/`export`), `"type"` handled via explicit `.js` extensions on imports (Node ESM requires them).

## Auth model
- `authenticate` verifies Bearer JWT and sets `req.user = { id, role }`.
- `authorize(...roles)` is a factory for role checks.
- Tokens issued by controllers with `jwt.sign({ id, role }, env.jwtSecret, { expiresIn: '7d' })`.
- ASHA workers are the only auth role implemented so far (`role: 'ASHA'`). Doctor role constant defined but doctor signup/login not yet needed.

## Schema notes (prisma/schema.prisma)
- All PKs are `String @id @default(uuid())` — required for offline-first (client-generated ids).
- `TriageRecord.symptoms` is `String[]` → Postgres `text[]`.
- `TriageRecord.synced Boolean @default(false)` — offline queue marker.
- `TriageRecord` and `Appointment` have `updatedAt @updatedAt` — used for last-write-wins conflict resolution in sync.
- `Patient` has NO direct link to `AshaWorker`; the "patients of a worker" query filters the relation via
  `triageRecords: { some: { ashaWorkerId } }`.
- `Doctor` is a MOCK directory (no real integration).

## Sync design
- `services/syncService.js` implements last-write-wins: compare `updatedAt`, server wins ties/older, reports conflicts.
- `POST /api/sync` accepts `{ triageRecords: [], appointments: [] }`; offline appointments MUST already carry a `doctorId`.
- Every upsert sets `synced: true`.

## Voice pipeline contract
`POST {VOICE_SERVICE_URL}/api/v1/voice/process`, multipart field `audio`.
`services/voicePipelineClient.js` NORMALIZES the service's own shape into `{ transcription, symptoms[], riskLevel, ttsResponse, audioUrl }` at the boundary. Raw shapes differ:
- `transcription` is an object `{ text, engine, ... }` (not a string); `medical.symptoms` is an array of OBJECTS `{ id, confidence }` (not strings); verdict is `triage.level` (not `riskLevel`); TTS text is `response.text`; audio is `audio.url` (relative → client prefixes `VOICE_SERVICE_URL`).
- Fringe cases throw typed errors, never 500: `success:false` (e.g. STT_FAILED), `requiresConfirmation:true` (fuzzy match, no triage in payload), and `triage.level === UNKNOWN` → all map to **422 VoiceUnclearInputError** ("re-record"). Unreachable voice service → **502**.
Risk levels storeable in the `RiskLevel` enum: `EMERGENCY | URGENT | ROUTINE | SELF_CARE` (service also emits `UNKNOWN` — that is NOT stored). EMERGENCY/URGENT auto-create a `Referral`.

## Doctor matching (doctorMatchService.js)
Keyword-scored specialty mapping → mock `Doctor` table filtered by `available: true` and facility tier.
Facility tiers for riskLevel: EMERGENCY→District only, URGENT→District/CHC, ROUTINE→CHC/PHC, SELF_CARE→PHC.
Slots are generated (`suggestSlots`) since there is no real schedule system — appointment starts PENDING for worker confirmation.

## Gotchas / traps
- Do NOT rename `src/routes/*Routes.js` to dotted names — user explicitly chose the camelCase convention.
- Multer is memory storage; the upload field for triage is `audio`, and the route must register the multer middleware (`uploadAudio`) BEFORE the handler.
- `Number(age)` coercion is needed — HTTP bodies deliver strings.
- `.env` must never be committed; treat Supabase URL/password as secret.
- No test runner configured. Verify with `npm run dev` + curl smoke tests.
- Voice service often NOT running locally — triage endpoint will 5xx until it is up; that is expected.
- Voice service local setup needs `nodejs-whisper`'s whisper.cpp compiled (`node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-cli`) — requires **cmake** (user-space: `python3 -m pip install --user --break-system-packages cmake`) + gcc/make. The `npx nodejs-whisper` wizard is interactive; building via `cmake` in the cpp dir works instead.
 - **STT engine (2026-09-05):** voice service runs `PRIMARY_STT=vosk` (Devanagari-native), whisper only as fallback. Vosk's model was ALREADY downloaded (`models/vosk/vosk-model-small-hi-0.22`). Verified live: E2E 10/10 green — fever → 201/ROUTINE, chest-pain → 201/EMERGENCY + auto-Referral, gibberish → clean 422. whisper-tiny romanizes and whisper-base emits ARABIC/Urdu script, so the whisper path must NOT be the primary for Hindi.
 - **Fallback VERIFIED live (2026-09-05):** deliberately set `PRIMARY_STT=whisper` while renaming `whisper-cli` (broken binary) → whisper `transcribe()` threw (`whisper-cli executable not found`) → `ModelManager` logged `Primary STT failed, attempting fallback` → vosk initialized and returned `transcription.engine="vosk"` with clean Devanagari + exact symptoms + `ROUTINE`. Caveat noted to the friend: the fallback rescues a **thrown** error only; whisper's bad-but-successful romanized output does NOT trigger it.
 - **Node version (critical):** both repos carry `.nvmrc` = **20.11.1**. Newer LTS minors (20.18+, 22.14+, 24.x) backported NAPI v10 (`node_api_basic_env`) into the headers UNGUARDED → the vosk/`ffi-napi`/`node-addon-api@3.2.1` build breaks (`napi.h`/`get-uv-event-loop-napi-h` errors). `require('vosk')` only compiles clean on ≤20.11.1.
 - **Installing vosk in the voice repo:** the committed `package-lock.json` OMITS vosk (it failed as an optional dep on the author's machine) and `npm install` skips it silently. Install via a FRESH resolution: `nvm use 20.11.1; rm -f package-lock.json; npm i vosk@0.3.39; git checkout -- package-lock.json`. If the checkout path contains SPACES, node-gyp's `<!(require('node-addon-api').include)` expansion collapses → `napi.h: No such file`; shim with `CPATH=<repo>/node_modules/node-addon-api:<repo>/node_modules/get-uv-event-loop-napi-h/include:<repo>/node_modules/get-symbol-from-current-process-h/include:<repo>/node_modules/ref-napi/include` and `node-gyp rebuild` each native pkg.
 - **vosk runtime shim (node_modules-level, NOT repo):** the voice repo's `VoskSTTService.js:93` does `JSON.parse(rec.finalResult())`, but vosk ^0.3.39's `finalResult()` already returns a parsed object (there is no `finalResultString()`). Shim applied in `node_modules/vosk/index.js` (return raw string from `finalResult()`). REAL fix for the friend: line 93 → `const result = rec.finalResult();`. The dev machine's install also depends on this shim persisting in `node_modules`.
 - Demo audio: Piper-generated Hindi clips live in voice repo `public/samples/` (`sample_fever_routine.wav`, `sample_chestpain_emergency.wav`, `sample_unclear_gibberish.wav`). Evidence baseline (recorded 2026-09-05) for "how accurate is your Hindi recognition?" — fever: `मुझे बुखार है और खांसी भी हो रही है`; chest: `मेरे सीने में बहुत दर्द है और मुझे सांस लेने में तकलीफ हो रही है`; gibberish: `हम कर्म कर्म ब्लाह ब्लाह अजीब आवाजें आ रही हैं`. whisper-tiny produced `Hammakam Kamdla...` (gibberish) and `Majhhe bookar...` (fever) — unusable.
- Never create a second `PrismaClient`; use `src/config/db.js` every time.
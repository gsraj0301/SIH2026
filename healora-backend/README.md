# Healora Backend

Offline-first, ASHA-worker-assisted rural healthcare backend.
Built for **Smart India Hackathon** using **Node.js, Express, Prisma + PostgreSQL, JWT auth**.

The backend does **not** reimplement triage/transcription logic — it delegates voice
processing to a teammate's microservice at `POST /api/v1/voice/process` and stores the verdict.

---

## Tech Stack

| Layer          | Choice                             |
| -------------- | ---------------------------------- |
| Runtime        | Node.js (≥ 18)                     |
| Framework      | Express 4                          |
| ORM            | Prisma 6 + PostgreSQL              |
| Auth           | JWT (jsonwebtoken) + bcryptjs      |
| File upload    | multer (in-memory)                 |
| HTTP client    | axios (voice microservice)         |
| Process        | nodemon (dev)                      |

## Setup

```bash
cd healora-backend
npm install

# 1. Configure the database (.env)
cp .env.example .env
#    Option A — Supabase (hosted Postgres, recommended):
#      Dashboard → Project Settings → Database → Connection string → URI (direct, port 5432)
#      DATABASE_URL="postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres"
#    Option B — local Postgres:
#      DATABASE_URL="postgresql://postgres:<password>@localhost:5432/healora"
#      → create the DB:  createdb healora

# 2. Apply the already-generated migration (creates tables)
npx prisma migrate deploy

# 3. Seed mock data (doctors, sample patients, demo ASHA worker)
npm run seed

# 4. Start the server
npm run dev
```

Server starts at `http://localhost:3000` → health check: `GET /health`.

> **Demo ASHA login** (from seed): phone `9999999999`, password `asha123`

## Mobile App (`healora-app/`)

Expo **SDK 57** React Native client for ASHA workers: auth, patient picker, Hindi voice triage,
triage result + TTS playback. Sits at the workspace root in `healora-app/` and talks to this API.

```bash
cd healora-app
nvm use 22.23.2            # app Node (backends stay on 20.11.1)
npm install
API_BASE_URL=http://192.168.1.6:3000 npx expo start   # LAN IP for a real phone (never localhost)
```

- Phone must be on the same Wi-Fi/hotspot as the backend + voice service (`:3000` and `:4000`).
- Android emulator instead: `API_BASE_URL=http://10.0.2.2:3000`.
- Verify changes: `npx expo-doctor`, `npx tsc --noEmit`, `npx expo export --platform android`.
- See `healora-app/README.md` for details and demo creds.

## Environment Variables

| Variable            | Description                              |
| ------------------- | ---------------------------------------- |
| `DATABASE_URL`      | Postgres connection string (Supabase or local) |
| `JWT_SECRET`        | Secret used to sign JWTs                  |
| `VOICE_SERVICE_URL` | Base URL of the voice microservice        |
| `PORT`              | This backend's port (default 3000)        |

## API Overview

All endpoints except `/api/auth/*` require `Authorization: Bearer <JWT>`.

### Auth
| Method | Path                 | Body                          |
| ------ | -------------------- | ----------------------------- |
| POST   | `/api/auth/register` | name, phone, password, village |
| POST   | `/api/auth/login`    | phone, password               |

### Patients
| Method | Path                  | Notes                                    |
| ------ | --------------------- | ---------------------------------------- |
| POST   | `/api/patients`       | name, age, gender, phone?, village        |
| GET    | `/api/patients`       | `?ashaWorkerId=` filters by worker history|
| GET    | `/api/patients/:id`   | includes triage + follow-up history       |

### Triage (core integration)
| Method | Path           | Notes                                              |
| ------ | -------------- | -------------------------------------------------- |
| POST   | `/api/triage`  | multipart `audio` file + `patientId`; auto-creates referral when EMERGENCY/URGENT |

The response includes `triageRecord`, `ttsResponse` (spoken reply for the worker) and
`autoReferral` when triggered.

### Appointments
| Method | Path                          | Notes                                        |
| ------ | ----------------------------- | -------------------------------------------- |
| POST   | `/api/appointments`           | body: patientId, symptoms[], riskLevel; doctor-matched via mock directory |
| PATCH  | `/api/appointments/:id/confirm` | sets status PENDING → CONFIRMED            |

### Referrals
| Method | Path             | Notes                      |
| ------ | ---------------- | -------------------------- |
| POST   | `/api/referrals` | manual creation            |
| GET    | `/api/referrals` | `?patientId=` filter       |

### Follow-ups
| Method | Path                        | Notes                                  |
| ------ | --------------------------- | -------------------------------------- |
| GET    | `/api/followups`            | `?dueToday=true` → dashboard count     |
| PATCH  | `/api/followups/:id/complete` | PENDING → DONE                        |

### Sync (offline support)
| Method | Path      | Body                                                      |
| ------ | --------- | --------------------------------------------------------- |
| POST   | `/api/sync` | `{ triageRecords: [...], appointments: [...] }` → last-write-wins upsert, returns summary |

## Folder Structure

```
healora-backend/
├── prisma/
│   └── schema.prisma          # Postgres models + enums
├── seed/
│   └── seed.js                # mock doctors, sample patients, demo worker
├── src/
│   ├── config/                # env + shared PrismaClient
│   ├── controllers/           # request/response logic (one per resource)
│   ├── routes/                # path + middleware + handler wiring
│   ├── services/              # voice client, doctor matching, offline sync
│   ├── middleware/            # JWT guard, role guard, central error handler
│   ├── app.js                 # Express app assembly
│   └── server.js              # boot + DB connect
└── .env.example
```

## Key Design Decisions

- **UUID primary keys** → records can be created offline on the device without a central counter; no collisions on sync.
- **Last-write-wins sync** → offline queue upserts compare `updatedAt`; older writes lose and are reported as conflicts.
- **`next(error)` everywhere + single errorHandler** → no unhandled promise rejection can crash the server.
- **JWT payload `{ id, role }`** → controllers trust the token, never the client body, for `ashaWorkerId`.
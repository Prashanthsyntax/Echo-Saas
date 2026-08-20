# Echo — Setup Guide

Complete environment setup, from an empty folder to a fully running local development environment. Every step is in the order it was actually performed.

---

## 1. Prerequisites

- Node.js 22+ and npm
- Python 3.11+ (for the Chroma RAG microservice)
- Git
- A GitHub account
- Windows PowerShell (or equivalent shell) — this project was built on Windows

All tools and services used are free-tier — no credit card required anywhere in this setup.

---

## 2. Project Scaffolding

```powershell
npx create-next-app@latest echo
```

Prompts answered:
```
TypeScript                 → Yes
ESLint                     → Yes
Tailwind CSS               → Yes
src/ directory             → Yes
App Router                 → Yes
Import alias (@/*)         → No (default)
```

Verify dev server runs:
```powershell
cd echo
npm run dev
```

### Folder structure correction
If `create-next-app` placed `app/` at the project root instead of inside `src/`, move it manually:
```powershell
mkdir src
mv app src/app
```
Update `tsconfig.json` paths:
```json
"paths": { "@/*": ["./src/*"] }
```

### Create supporting folders
```powershell
mkdir -p src/components/ui src/lib src/server src/types prisma
```

| Folder | Purpose |
|---|---|
| `src/components/ui` | shadcn/ui components |
| `src/lib` | Shared utilities, DB client, third-party SDK clients |
| `src/server` | Express/Socket.io real-time server (separate deploy) |
| `src/types` | Shared TypeScript type declarations |
| `prisma/` | Database schema and migrations |

---

## 3. shadcn/ui Setup

```powershell
npx shadcn@latest init
```

Prompts:
```
Component library    → Radix
Style                 → New York
Base color            → Zinc
CSS variables         → Yes
```

> Note: shadcn's CLI evolved mid-project to a "presets" flow (Nova, Vega, Maia, etc.) on v4.11. If presented with presets, choose **Custom** (or any preset — values get overwritten in the next step regardless).

Install icons:
```powershell
npm install lucide-react
```

Add core components used throughout the app:
```powershell
npx shadcn@latest add button card avatar dropdown-menu separator skeleton dialog input badge textarea tabs switch label select
```

### Custom theme tokens

Replace the `:root` / `.dark` blocks in `src/app/globals.css` with the project's violet/sky/near-black palette (see `globals.css` in the repo for exact HSL values). Key decisions:
- Primary: violet, `263° hue`
- Accent: sky blue, `199° hue`
- Background (dark): near-black `240 6% 4%`, not pure `#000`
- Single `--radius` value drives all corner rounding

**Common pitfall:** running `npx shadcn add <component>` can append a second, duplicate `:root`/`.dark` block to `globals.css` instead of merging into the existing one. Since CSS cascade means the later block wins, this silently overrides custom theme colors. After every `shadcn add`, grep for duplicate `:root` declarations:
```powershell
findstr /n ":root" src\app\globals.css
```
Should return exactly one match.

---

## 4. Database — Prisma + Neon

### Create free Neon Postgres database
1. https://neon.tech → sign up free (GitHub login, no card)
2. Create project `echo`
3. Copy the pooled connection string

### Install Prisma
```powershell
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

### Set the connection string
In `.env`:
```
DATABASE_URL="postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=verify-full&connect_timeout=30"
```
`sslmode=verify-full` (not `require`) avoids a deprecation warning from the `pg` driver. `connect_timeout=30` accommodates Neon's free-tier cold start after inactivity.

### Prisma 7 architecture note
Prisma 7 removed the `url` field from `schema.prisma`'s `datasource` block. The URL now lives in `prisma.config.ts` (for the CLI/migrations) and is passed explicitly to a driver adapter at runtime (for the app).

`prisma.config.ts`:
```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

`schema.prisma` datasource block:
```prisma
datasource db {
  provider = "postgresql"
}
```

Install the Postgres driver adapter:
```powershell
npm install @prisma/adapter-pg pg
npm install --save-dev @types/pg
```

`src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```
`max: 1` caps the connection pool — important on Neon's free tier connection limits, especially with Next.js hot-reload spawning new client instances in dev.

### Write the schema and migrate
The full schema (10 models — User, Workspace, Membership, Folder, Video, Comment, Subscription, Invite, AgentKey, RagFeedback, ChunkScore) lives in `prisma/schema.prisma`. After writing it:
```powershell
npx prisma migrate dev --name init
npx prisma generate
```

Verify visually:
```powershell
npx prisma studio
```

**Keeping Neon warm during dev sessions:** the free tier suspends compute after ~5 minutes idle. Open Prisma Studio at the start of each working session — it wakes the DB before you start hitting it from the app, avoiding 10+ second cold-start delays on your first request.

---

## 5. Authentication — Clerk

1. https://clerk.com → sign up, create application `echo`
2. Enable Email + Google sign-in methods
3. Copy API keys into `.env`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/overview
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/overview
```
```powershell
npm install @clerk/nextjs
```

### Route protection middleware
Next.js 16 renamed `middleware.ts` → `proxy.ts`. File lives at `src/proxy.ts`:
```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/overview(.*)", "/dashboard(.*)", "/record(.*)", "/canvas(.*)",
  "/workflows(.*)", "/knowledge(.*)", "/chat(.*)", "/agents(.*)",
  "/rag(.*)", "/settings(.*)", "/billing(.*)",
  "/api/rag(.*)", "/api/agents(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### Webhook — sync Clerk users into Postgres
```powershell
npm install svix
```
Route at `src/app/api/webhooks/clerk/route.ts` verifies the signature with `svix`, then upserts a `User` row on `user.created`/`user.updated`, deletes on `user.deleted`.

**Local webhook testing requires a public tunnel** (Clerk's servers can't reach `localhost`):
```powershell
ngrok http 3000
```
Register the printed `https://xxxx.ngrok-free.app/api/webhooks/clerk` URL in Clerk's dashboard under Webhooks, copy the signing secret into `.env` as `CLERK_WEBHOOK_SECRET`.

**Known friction point:** free ngrok URLs regenerate on every restart, silently breaking the webhook until the URL is updated in Clerk's dashboard. A free static ngrok domain (Dashboard → Domains) eliminates this permanently:
```powershell
ngrok http 3000 --domain=your-reserved-name.ngrok-free.app
```

**Defensive pattern used throughout the app:** every route that needs the internal `User` row first tries `db.user.findUnique`, and if not found, creates it inline using Clerk's `currentUser()`. This makes the app resilient to the webhook not having fired yet (race condition between signup and webhook delivery).

---

## 6. File Storage — Supabase

R2 was the original plan but requires a card on file even on the free tier. Supabase Storage requires no card.

1. https://supabase.com → sign up free, create project `echo`
2. Storage → New bucket → name `videos` → toggle **Public bucket** on
3. Settings → API → copy Project URL and `service_role` key (not `anon`)

```
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_STORAGE_BUCKET="videos"
```
```powershell
npm install @supabase/supabase-js
```

**Architecture decision:** uploads go through the Next.js API route (base64-encoded in the request body) rather than a presigned-URL-direct-to-storage pattern. Slightly more data passes through the server, but it requires no S3-style signing setup and works identically on every free storage provider.

---

## 7. Payments — Stripe

1. https://stripe.com → sign up, stay in **Test mode**
2. Developers → API keys → copy publishable + secret keys
3. Product catalog → create "Echo Pro" product, $12/month recurring → copy the Price ID

```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_PRO_PRICE_ID="price_..."
```
```powershell
npm install stripe @stripe/stripe-js

stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe

after entering these commands then perform the stripe billing
```

### Local webhook testing
```powershell
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the printed `whsec_...` into `.env` as `STRIPE_WEBHOOK_SECRET`. Like ngrok, this regenerates on every CLI restart — re-sync after restarting.

Enable the Customer Portal once, in test mode: https://dashboard.stripe.com/test/settings/billing/portal → Activate test link.

---

## 8. AI — Groq (Free Whisper + Llama)

```
GROQ_API_KEY="gsk_..."
```
```powershell
npm install groq-sdk
```
No credit card required. Free tier: 2,000 audio transcription requests/day (Whisper Large v3), generous daily token limits on Llama 3.3 70B chat completions.

`src/lib/groq.ts` exports a singleton `groq` client used by: video transcription, AI title/summary generation, the website chatbot, the dashboard chat, and the RAG answer generation (`echo-nemo-1.0`'s default model).

---

## 9. Recording Pipeline

No new service — uses browser-native `MediaRecorder` and `getDisplayMedia`/`getUserMedia` APIs. Logic lives in `src/hooks/use-recorder.ts` as a custom hook (state machine: `idle → requesting → ready → recording → uploading → done`).

```powershell
npm install socket.io-client
```
(Socket.io client installed for future real-time progress; current implementation uses a direct base64 upload to the Next.js API rather than chunked socket streaming.)

---

## 10. Canvas — Fabric.js

```powershell
npm install fabric
npm install --save-dev @types/fabric
```
**React 18 Strict Mode gotcha:** Strict Mode runs effects twice in development, which causes Fabric to throw "canvas already initialized" if not guarded. Fix: an `initializingRef` flag prevents a second `new Canvas()` call on the same DOM node during the double-invoke.

---

## 11. Workflow Builder — React Flow

```powershell
npm install @xyflow/react
```
Dark-mode CSS overrides for React Flow's default light styling are appended to `globals.css` (`.react-flow__controls`, `.react-flow__edge-path`, etc.).

---

## 12. PDF → Knowledge Graph

```powershell
npm install d3 pdfjs-dist
npm install --save-dev @types/d3
```
`pdfjs-dist`'s worker is loaded from a CDN (`cdn.jsdelivr.net`) rather than bundled, avoiding Webpack/Turbopack bundling issues with the worker file.

---

## 13. echo-nemo-1.0 — RAG Microservice (Chroma)

This is a **separate Python service**, not part of the Next.js app, because Chroma + sentence-transformers need a Python runtime.

```
echo/
└── chroma-service/
    ├── main.py
    ├── requirements.txt
    └── render.yaml
```

`requirements.txt`:
```
fastapi==0.115.0
uvicorn==0.30.6
chromadb==0.5.15
sentence-transformers==3.0.1
pypdf==4.3.1
python-docx==1.1.2
pandas==2.2.2
beautifulsoup4==4.12.3
requests==2.32.3
python-multipart==0.0.9
```

### Local development
```powershell
cd chroma-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
```
CHROMA_SERVICE_URL="http://localhost:8000"
```

### Production deployment (Render)
1. Push `chroma-service/` to its own repo (or as a subfolder with Root Directory set)
2. Render → New Web Service → connect repo
3. Root Directory: `chroma-service`
4. Build: `pip install -r requirements.txt`
5. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add a **persistent disk**: mount path `/data`, size 1GB (free tier) — without this, Chroma's vector data is wiped on every redeploy
7. Deploy (~3-5 min first build — downloads the embedding model)

Update `.env` with the Render URL:
```
CHROMA_SERVICE_URL="https://echo-nemo-chroma.onrender.com"
```

**Cold start note:** Render's free tier sleeps the service after inactivity. First request after sleep takes longer; the app handles this by surfacing a "retrieval service unavailable" message gracefully rather than crashing.

---

## 14. Agent Key Encryption

```
ENCRYPTION_SECRET="<32-byte hex string>"
```
Generate one:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
AES-256-GCM encryption (`src/lib/crypto.ts`) — user-provided third-party API keys (Claude/OpenAI/Gemini/Mistral) are encrypted before being written to Postgres, never stored or logged in plaintext.

---

## 15. Electron Desktop App

```powershell
npm install --save-dev electron electron-builder concurrently wait-on cross-env @electron/rebuild
```

Folder structure:
```
echo/
└── electron/
    ├── main.ts        # main process — window, tray, IPC handlers
    ├── preload.ts      # contextBridge — safe API exposed to renderer
    ├── tsconfig.json
    ├── electron-builder.yml
    └── assets/
        └── icon.png    # app icon — convert to .ico/.icns for distribution
```

`package.json` scripts:
```json
"electron:compile": "tsc -p electron/tsconfig.json",
"electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && cross-env NODE_ENV=development electron .electron/main.js\"",
"electron:build": "npm run build && npm run electron:compile && electron-builder --config electron/electron-builder.yml"
```

Run locally:
```powershell
npm run electron:compile
npm run electron:dev
```

**Icon conversion** (no card-free built-in tool): use https://cloudconvert.com to convert a source PNG to `.ico` (Windows) and `.icns` (macOS).

---

## 16. Final `.env` (complete reference)

```
# Database
DATABASE_URL=""

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/overview
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/overview
CLERK_WEBHOOK_SECRET=""

# Supabase Storage
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_STORAGE_BUCKET="videos"

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRO_PRICE_ID=""

# Groq
GROQ_API_KEY=""

# echo-nemo-1.0 RAG
CHROMA_SERVICE_URL=""
ENCRYPTION_SECRET=""

# App
APP_URL="http://localhost:3000"
```

---

## 17. Running the Full Stack Locally

Four processes, four terminals:

```powershell
# Terminal 1 — Next.js app
npm run dev

# Terminal 2 — Chroma RAG microservice
cd chroma-service && uvicorn main:app --port 8000

# Terminal 3 — Clerk webhook tunnel
ngrok http 3000 --domain=<your-reserved-domain>

# Terminal 4 — Stripe webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Optional fifth terminal for the desktop shell:
```powershell
npm run electron:dev
```

---

## 18. Production Deployment Summary

| Component | Platform | Notes |
|---|---|---|
| Next.js app | Vercel | Auto-deploys from GitHub push |
| Chroma RAG service | Render | Persistent disk required for vector data |
| Postgres database | Neon | Run `npx prisma migrate deploy` after schema changes |
| Video storage | Supabase | Same instance as dev — no migration needed |
| Auth | Clerk | Switch webhook endpoint URL to production domain |
| Payments | Stripe | Switch webhook endpoint URL to production domain; flip out of Test Mode when ready for real payments |

After deploying, update environment variables in Vercel's dashboard to match production URLs (`APP_URL`, Clerk webhook, Stripe webhook) — these cannot point at `localhost` or ngrok URLs in production.

# Echo — Project Overview

What this project is, what was built, and why each piece exists. This is the map of the entire system — for line-by-line concept explanations see `CONCEPTS_AND_ARCHITECTURE.md`.

---

## What Echo Is

Echo started as an async video messaging SaaS (a Loom-style product) and grew into a full productivity platform. A user can: record their screen/webcam, get an instantly shareable link with AI-generated transcripts and summaries, collaborate with teammates across multiple workspaces, sketch on an infinite canvas, build simple automation workflows, turn any PDF into a visual knowledge graph, and — the centerpiece — query their own private, continuously-learning RAG (Retrieval-Augmented Generation) AI model called **echo-nemo-1.0**.

Every single service used is free-tier. There is no part of this stack that requires a credit card to build or run at the scale of a personal/portfolio project.

---

## Tech Stack (Complete)

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | shadcn/ui (Radix primitives) + Tailwind CSS v4 |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 7 (driver-adapter architecture) |
| Auth | Clerk |
| File storage | Supabase Storage |
| Payments | Stripe |
| AI (default) | Groq (Llama 3.3 70B + Whisper Large v3) |
| Vector DB | Chroma (self-hosted on Render) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| Canvas | Fabric.js |
| Workflow graph | React Flow (@xyflow/react) |
| Knowledge graph viz | D3.js (force simulation) |
| PDF parsing | pdfjs-dist (client) / pypdf (server, Python) |
| Desktop shell | Electron |
| Deployment | Vercel (Next.js) + Render (Python RAG service) |

---

## Feature-by-Feature Breakdown

### 1. Landing Page
Marketing site with a hero section (mock recorder window as the signature visual element instead of a generic gradient blob), features grid, "how it works" steps, pricing teaser, and footer. Built with a deliberate black-theme design system (violet primary, sky accent, near-black background) rather than defaulting to a templated light SaaS look.

### 2. Authentication & Multi-Tenancy
Clerk handles identity. A webhook (`/api/webhooks/clerk`) syncs Clerk users into the app's own `User` table on signup/update/delete. The `Membership` join table (not a direct `User ↔ Workspace` relation) is the multi-tenancy backbone — it's what allows one user to belong to many workspaces with different roles (`OWNER`/`ADMIN`/`MEMBER`) in each.

### 3. Dashboard Shell
Fixed sidebar (not collapsible, by deliberate choice), workspace switcher dropdown, user profile modal with sign-out, and a persistent dot-grid background across every authenticated page — visually distinguishing the "app" from the "marketing site."

### 4. Recording Pipeline
Browser-native `MediaRecorder` API captures screen and/or webcam. No third-party recording SDK. Recorded chunks are assembled into a Blob, base64-encoded, and POSTed to a Next.js API route, which uploads to Supabase Storage and creates a `Video` row (`status: UPLOADING → READY`).

### 5. AI Transcription & Summary
After upload, the video's audio is sent to Groq's Whisper Large v3 (free) for transcription, then the transcript is sent to Groq's Llama 3.3 70B to generate a title and 2-3 sentence summary. This runs as a fire-and-forget background call — the user is redirected to the video page immediately, which polls for the transcript to appear (avoiding a 10-30 second blocking wait).

### 6. Video Player & Comments
Custom HTML5 video player (no third-party player library) with play/pause, scrub bar, mute, fullscreen. Timestamped comments stored in their own `Comment` table, linked to both `Video` and `User`.

### 7. Video Library / Dashboard
Server-rendered grid of a user's videos with search (via URL query params, debounced client-side), delete (removes both the DB row and the Supabase storage object), and a real empty state (not just "no videos" text — icon, explanation, CTA).

### 8. Billing
Stripe Checkout for Free → Pro upgrade, Stripe Customer Portal for self-serve plan management, and a webhook (`/api/webhooks/stripe`) that keeps the `Subscription` table in sync with Stripe's source of truth (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).

### 9. Workspace System
Full multi-workspace support: create unlimited workspaces, switch between them via a sidebar dropdown (state held in a React Context + localStorage), invite teammates by email (generates a tokenized, expiring invite link), accept invites via a public `/invite/[token]` page, manage members and pending invites in a modal, remove members (role-gated — only OWNER/ADMIN can remove). Switching workspaces triggers `router.refresh()` so every server-rendered page re-fetches data scoped to the new workspace.

### 10. Settings
Two-column settings layout (label + content, the Stripe/Vercel pattern) covering profile (display name, avatar via Clerk, email read-only) and workspace (rename) sections.

### 11. Canvas (Eraser.io-style)
Infinite drawing surface using Fabric.js: select/draw/rectangle/circle/line/text/sticky-note tools, pan (Alt+drag), zoom (scroll wheel), delete, and PNG export. Floating toolbar and properties panel (stroke/fill color, stroke width) over a dark canvas.

### 12. Automation Workflow Builder (n8n-style, basic)
Drag-and-drop node graph using React Flow. Three node categories (Trigger / Action / Condition) in a draggable palette; nodes drop onto the canvas, connect via drawn edges, and a "Run" button animates a simulated execution log. Two pre-built templates included. This is explicitly a visual builder — there is no real execution engine wired to external services (Slack, email, etc.) yet; the run log is illustrative.

### 13. PDF → Knowledge Graph
Upload a PDF → client-side text extraction via `pdfjs-dist` (first 15 pages) → text sent to Groq Llama 3.3 70B with a structured-JSON-extraction prompt → returns nodes (entities: concept/person/org/process/technology/location/event) and edges (labeled relationships) → rendered as an interactive D3.js force-directed graph with draggable nodes, zoom/pan, and a click-to-inspect detail panel.

### 14. Dashboard Chat (graph Q&A)
A separate chat interface that answers questions about the *extracted knowledge graph* specifically (not general documents) — the full node/edge list is serialized into the system prompt as structured context, and Groq answers questions about relationships, clusters, and central concepts within that specific graph.

### 15. Website Chatbot
A floating bottom-right widget present on every page (landing + dashboard), backed by Groq Llama 3.3 70B with a narrow system prompt restricting it to Echo product questions (recording, pricing, features) — declines out-of-scope questions rather than hallucinating answers about unrelated topics.

### 16. echo-nemo-1.0 — Adaptive RAG System (the centerpiece)
A full production RAG (Retrieval-Augmented Generation) pipeline, not a "custom trained LLM" (that distinction is covered in depth in the concepts document):

- **Ingestion**: PDF, DOCX, CSV, TXT, MD, and arbitrary URLs, plus auto-ingestion of every Echo video's AI transcript
- **Processing**: documents converted to clean Markdown, split into overlapping 512-token chunks
- **Embedding**: chunks embedded with `sentence-transformers/all-MiniLM-L6-v2` (free, runs in the Python service, no API cost)
- **Storage**: embeddings stored in Chroma, a separate per-user namespace ("collection") per user — full data isolation between users
- **Retrieval**: a user's question is embedded and compared against their namespace via cosine similarity to retrieve the top-k most relevant chunks
- **Adaptive re-ranking**: every thumbs up/down on an answer adjusts a per-source score in Postgres; future retrievals for that user boost/penalize chunks from sources with feedback history
- **Query expansion**: follow-up questions are expanded using recent conversation history before retrieval, improving recall on pronoun-heavy or context-dependent questions
- **Generation**: retrieved chunks + system prompt + question are sent to Groq Llama 3.3 70B (default) to produce a grounded answer with source citations
- **Agent override**: a user can connect their own Claude/GPT-4/Gemini/Mistral API key; the same retrieval pipeline runs, but the connected model generates the final answer instead of Groq
- **Observability**: a live "model card" on the dashboard overview shows accuracy %, total queries, chunks indexed, documents indexed, and top-performing sources

### 17. Agent Connection System
A settings-style page where users paste their own third-party API keys (Claude, OpenAI, Gemini, Mistral). Keys are validated against the real provider API on submission (a live, cheap test call) before being stored. Stored keys are AES-256-GCM encrypted at rest — the database only ever holds ciphertext plus a 4-character display hint (`...xK9p`), never the raw key.

### 18. Electron Desktop App
A native shell wrapping the same Next.js app, adding: system tray icon with a "New Recording" quick action, native screen-source picker via `desktopCapturer` (broader access than browser `getDisplayMedia`), and native OS permission prompts for camera/mic/screen (macOS-specific flows for opening System Preferences when needed). Built last, deliberately — it reuses the already-proven web recording logic rather than debugging recording and native packaging simultaneously.

### 19. Dashboard Overview Page (Cognee-inspired)
The first thing a user sees after login: a time-aware greeting, a live stats strip (recordings, views, comments, AI transcripts, RAG queries, workspaces) pulled directly from Postgres, the echo-nemo-1.0 model card, a grid of "Get started" action cards (custom inline SVG icons, not raster images, for crisp scaling), an "Agents" section advertising AI tool connections, and a "Data sources" section (Slack/Notion/GitHub/etc., UI-only "coming soon" state, no backend wired).

---

## Database Schema (Final — 10 Models)

| Model | Purpose |
|---|---|
| `User` | Synced from Clerk; root identity |
| `Workspace` | Multi-tenant container; has a `plan` (FREE/PRO) |
| `Membership` | Join table: User ↔ Workspace with a `Role` |
| `Folder` | Self-referential (nestable) video organization |
| `Video` | Core recording entity; `status` enum drives UI state |
| `Comment` | Timestamped feedback on a Video |
| `Subscription` | Mirrors Stripe subscription state |
| `Invite` | Tokenized, expiring workspace invitations |
| `AgentKey` | Encrypted third-party LLM API keys, one per user per provider |
| `RagFeedback` | Every thumbs up/down, with the question/answer/sources/chunks that produced it |
| `ChunkScore` | Aggregated per-source feedback score, used to re-rank future retrievals |

---

## What Was Deliberately Left Out of Scope

- **Real workflow execution** — the workflow builder is a visual tool; nodes don't actually call Slack/email/etc. yet
- **Mobile native apps** — web is responsive; no React Native/Flutter app
- **Enterprise SSO, SOC2, audit logs** — not needed at this stage
- **Real-time collaborative canvas/cursors** — canvas is single-user per session
- **Video editing/trimming** — record-and-share only, no in-app editing
- **Custom-trained foundation model** — explicitly chose RAG over training/fine-tuning from scratch; see the concepts document for why this is the correct engineering decision, not a shortcut

---

## File/Folder Map (High Level)

```
echo/
├── prisma/                    # schema.prisma, migrations/
├── src/
│   ├── app/
│   │   ├── (marketing)/       # landing page route group
│   │   ├── (auth)/            # sign-in / sign-up route group
│   │   ├── (dashboard)/       # all authenticated app pages
│   │   ├── v/[videoId]/       # public video player (no auth required)
│   │   ├── invite/[token]/    # public invite acceptance page
│   │   └── api/               # all route handlers (webhooks, RAG, agents, etc.)
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   ├── marketing/         # landing page sections
│   │   ├── dashboard/         # sidebar, video cards, workspace UI
│   │   ├── canvas/            # Fabric.js toolbar, properties panel
│   │   ├── workflows/         # React Flow nodes, palette
│   │   ├── knowledge/         # PDF uploader, D3 graph view
│   │   └── overview/          # dashboard home page sections
│   ├── lib/                   # db client, groq, storage, stripe, crypto, workspace context
│   ├── hooks/                 # use-recorder (MediaRecorder state machine)
│   └── proxy.ts                # Clerk route-protection middleware
├── chroma-service/             # separate Python FastAPI microservice (RAG)
│   ├── main.py
│   └── requirements.txt
└── electron/                   # desktop shell (main process, preload, icons)
```

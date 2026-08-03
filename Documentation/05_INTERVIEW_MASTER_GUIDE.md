# Echo Interview Master Guide

This guide explains the Echo project end to end in an interview-ready way. It is based on the actual repository structure, Prisma schema, API routes, Electron shell, and the separate `echo-rag` Chroma/FastAPI service.

## 1. One-Minute Project Pitch

Echo is an async video recording and productivity SaaS. It started as a Loom-style app where users can record screen or webcam videos, upload them, generate shareable links, add timestamped comments, and get AI transcripts and summaries. It then expanded into a broader workspace platform with multi-tenant workspaces, Stripe billing, a visual canvas, a workflow builder, PDF-to-knowledge-graph extraction, an AI chatbot, and a private RAG assistant called `echo-nemo-1.0`.

The strongest interview framing is:

> I built Echo as a full-stack AI productivity platform. The core workflow is record -> upload -> share -> comment -> transcribe -> summarize -> index into a private knowledge base. The app uses Next.js App Router and TypeScript for the web app, Clerk for auth, PostgreSQL/Neon with Prisma for relational data, Supabase Storage for videos, Stripe for billing, Groq for Whisper and Llama generation, and a separate Python FastAPI + Chroma service for vector search and document ingestion.

## 2. Problem and Real-World Use Case

Echo solves the problem of asynchronous communication and knowledge capture.

Common real-world use cases:

- A developer records a bug walkthrough and shares a link instead of scheduling a meeting.
- A product manager records a feature demo and teammates comment at specific timestamps.
- A user uploads PDFs, docs, URLs, CSVs, or video transcripts and asks questions over their private knowledge base.
- A team organizes recordings inside workspaces and manages billing centrally.
- A desktop user starts a screen recording quickly through an Electron tray app.

The non-technical value proposition is: fewer meetings, better documentation, faster team communication, and AI-assisted knowledge recall.

## 3. Repository Map

Main app: `C:\Users\prash\OneDrive\Documents\echo`

- `src/app`: Next.js App Router routes, layouts, API route handlers, public video page, invite page.
- `src/components`: UI components grouped by feature: marketing, dashboard, shared video UI, canvas, workflows, knowledge graph, overview.
- `src/hooks`: custom hooks for recording, chat persistence, workspace navigation.
- `src/lib`: shared infrastructure wrappers: Prisma, Supabase, Groq, Stripe, crypto, workspace context, graph store.
- `prisma`: schema and migrations for Postgres.
- `electron`: Electron main/preload/build config and assets.
- `Documentation`: setup notes, project overview, architecture concepts, interview questions, and this master guide.
- `images` and `public`: screenshots, static icons, fonts, agent images.

RAG service: `C:\Users\prash\OneDrive\Documents\echo-rag`

- `chroma-service/main.py`: FastAPI service for ingestion, chunking, embedding, vector storage, search, scoring, and deletion.
- `chroma-service/requirements.txt`: Python dependencies.
- `chroma-service/render.yaml`: Render deployment notes with persistent disk configuration.

## 4. Tech Stack and Why It Was Chosen

| Layer | Technology | Why it fits | Alternatives |
|---|---|---|---|
| Framework | Next.js 16 App Router | Full-stack React, layouts, route handlers, server components | Express + React, Remix, SvelteKit |
| Language | TypeScript | Type safety across UI, API, Prisma | JavaScript |
| UI | Tailwind CSS v4, shadcn/ui, Radix | Fast styling, accessible primitives, owned component code | MUI, Chakra, Mantine |
| Auth | Clerk | Managed auth, sessions, UI, webhooks | Auth.js, Supabase Auth, custom auth |
| DB | PostgreSQL on Neon | Relational model, joins, constraints, free serverless tier | MySQL, PlanetScale, MongoDB |
| ORM | Prisma 7 | Typed client, migrations, schema-driven modeling | Drizzle, Kysely, raw SQL |
| Video storage | Supabase Storage | Free storage bucket and public URLs | S3, Cloudflare R2, UploadThing |
| AI | Groq | Fast free-tier Llama/Whisper access | OpenAI, Anthropic, Gemini |
| Vector DB | Chroma | Simple local/persistent vector DB for RAG | Pinecone, Weaviate, Qdrant, pgvector |
| Embeddings | all-MiniLM-L6-v2 | Free CPU-friendly sentence-transformer | OpenAI embeddings, BGE, E5 |
| Billing | Stripe | Checkout, webhooks, customer portal | Lemon Squeezy, Paddle |
| Desktop | Electron | Reuses web app and adds native capture/tray | Tauri, native Swift/WinUI |
| Graph/canvas | D3, Fabric.js, React Flow | Specialized interaction libraries | Cytoscape, Konva, custom canvas |

## 5. Next.js Architecture

The app uses the App Router. Route groups separate shells without polluting URLs:

- `(marketing)` -> landing page at `/`.
- `(auth)` -> Clerk sign-in/sign-up pages.
- `(dashboard)` -> authenticated app pages with sidebar shell.
- `v/[videoId]` -> public shareable video page.
- `invite/[token]` -> public workspace invite acceptance.
- `api/**` -> backend route handlers.

Important Next.js 16 detail: this project uses `src/proxy.ts`, not `middleware.ts`. The local Next docs state that in Next.js 16, Middleware is now called Proxy. Echo uses `proxy.ts` with Clerk's route matcher to protect dashboard routes and selected API routes.

## 6. Database Design

The Prisma schema models a multi-tenant SaaS.

Core models:

- `User`: local user synced from Clerk.
- `Workspace`: tenant boundary; owns videos, members, plan, subscription.
- `Membership`: join table between user and workspace with `OWNER`, `ADMIN`, `MEMBER`.
- `Video`: recording metadata, public URL, transcript, summary, status, view count.
- `Comment`: linked to user and video.
- `Folder`: self-referential hierarchy for video organization.
- `Subscription`: Stripe subscription mirror.
- `Invite`: tokenized workspace invite with expiry and accepted state.
- `AgentKey`: encrypted third-party LLM API keys.
- `RagFeedback`: raw thumbs up/down events for RAG answers.
- `ChunkScore`: aggregated feedback score used for adaptive retrieval.
- `ChatSession` and `ChatMessage`: persisted RAG chat per user/workspace.

Design decisions:

- `Membership` is a separate table because roles belong to the relationship, not only the user.
- Composite unique constraints prevent duplicate memberships and duplicate provider keys per user.
- Cascading deletes remove dependent data when a user/workspace is deleted.
- `Folder -> Video` uses `SetNull` so deleting a folder does not destroy recordings.
- `VideoStatus` is an enum: `UPLOADING`, `PROCESSING`, `READY`, `FAILED`.

## 7. End-to-End Recording Flow

1. User opens `/record`.
2. `useRecorder` manages the recording state machine.
3. User selects `screen`, `camera`, or `both`.
4. Browser uses `getDisplayMedia` or `getUserMedia`; Electron uses `desktopCapturer` when available.
5. `MediaRecorder` starts and emits chunks every second.
6. On stop, chunks are assembled into a `Blob`.
7. Blob is converted to base64 and POSTed to `/api/upload`.
8. API verifies Clerk auth.
9. API finds or creates local `User`.
10. API finds or creates a default `Workspace`.
11. API creates a `Video` row with `UPLOADING`.
12. API decodes base64 to a `Buffer`.
13. API uploads the buffer to Supabase Storage.
14. API updates `Video` to `READY` with public URL and duration.
15. Client redirects to `/v/[videoId]`.
16. Client fires `/api/videos/[videoId]/transcribe` in the background.
17. Transcription route downloads the video from Supabase.
18. Groq Whisper transcribes the media.
19. Groq Llama generates title and summary.
20. Transcript is auto-ingested into the RAG service when configured.
21. Video row is updated with transcript, title, summary, and `READY`.
22. Public video page polls until transcript/summary appear.

Interview answer for the base64 trade-off:

> I used base64 JSON upload because it was the fastest free-tier-compatible path with Supabase Storage through my API route. The trade-off is memory overhead and larger payload size. In production, I would move to direct browser-to-storage uploads using signed URLs or chunked streaming to avoid holding the entire recording in memory.

## 8. Frontend Workflow

Marketing flow:

- `/` renders hero, features, how-it-works, pricing teaser, footer, and chatbot.

Auth flow:

- Clerk handles sign-in/sign-up.
- Clerk webhooks keep local DB users synced.

Dashboard flow:

- Authenticated routes use the dashboard layout and sidebar.
- `/overview` shows greeting, stats, model card, actions, agents, data sources.
- `/dashboard` shows video library, search, empty states, delete/share actions.
- `/record` captures media and uploads video.
- `/settings` manages profile/workspace.
- `/billing` starts Stripe checkout or portal.
- `/chat` is the RAG chat UI with document panel and persisted messages.
- `/knowledge` extracts a knowledge graph from documents.
- `/canvas` provides Fabric.js drawing.
- `/workflows` provides React Flow visual automation builder.
- `/agents` stores connected model provider keys.

## 9. Backend/API Workflow

Important API groups:

- `/api/upload`: creates videos and uploads files to Supabase.
- `/api/videos/[videoId]`: GET public video metadata, PATCH title/status, DELETE video/storage.
- `/api/videos/[videoId]/transcribe`: Whisper transcription, Llama summary, optional RAG ingestion.
- `/api/videos/[videoId]/comments`: create authenticated comments.
- `/api/webhooks/clerk`: verify Svix signature and sync users.
- `/api/webhooks/stripe`: verify Stripe signature and sync subscription state.
- `/api/billing/checkout`: create Stripe Checkout session.
- `/api/billing/portal`: create Stripe Customer Portal session.
- `/api/workspaces`: list/create workspaces.
- `/api/workspace/[workspaceId]`: rename workspace with role check.
- `/api/workspaces/[workspaceId]/members`: list/remove members.
- `/api/workspaces/[workspaceId]/invite`: create expiring invite token.
- `/api/rag/ingest`: forward file/URL/text ingestion to Chroma service.
- `/api/rag/query`: retrieve chunks, optionally use connected agent, generate answer.
- `/api/rag/feedback`: store feedback and update chunk/source scores.
- `/api/rag/documents`: list/delete ingested documents.
- `/api/agents/keys`: validate, encrypt, list, or delete provider API keys.
- `/api/chat/session`: create/load/clear persisted RAG sessions.
- `/api/chat/session/message`: save messages and feedback.
- `/api/knowledge/extract`: LLM-based PDF/text to graph JSON.
- `/api/knowledge/chat`: graph-specific Q&A.
- `/api/chat`: product-support chatbot.

## 10. Authentication and Authorization

Authentication is handled by Clerk. Echo does not store passwords.

Authorization is app-owned:

- `src/proxy.ts` protects dashboard routes and selected API routes.
- API routes call `auth()` to verify session.
- Mutating workspace actions check `Membership.role`.
- Public share video route is intentionally unauthenticated.
- Comments require auth.
- RAG routes are protected and scoped by Clerk user ID.

Webhook security:

- Clerk webhooks use Svix signature verification.
- Stripe webhooks use `stripe.webhooks.constructEvent`.
- Both reject invalid/missing signatures.

Race-condition mitigation:

Several routes create the local `User` inline if Clerk auth exists but the Clerk webhook has not yet created the DB row. This protects the first request after signup.

## 11. Stripe Billing Flow

1. User clicks upgrade.
2. `/api/billing/checkout` authenticates user and finds workspace.
3. If no Stripe customer exists, one is created and stored on `Workspace`.
4. API creates a subscription-mode Checkout Session with `workspaceId` in metadata.
5. User pays on Stripe-hosted Checkout.
6. Stripe sends `checkout.session.completed`.
7. `/api/webhooks/stripe` verifies signature.
8. Handler retrieves subscription and upserts `Subscription`.
9. Workspace plan flips to `PRO`.
10. Customer Portal route lets user manage/cancel subscription.
11. Subscription update/delete webhooks keep local DB in sync.

Interview highlight:

> I never handle card numbers. Stripe Checkout hosts the payment form, so the app stores only customer IDs, subscription IDs, status, and plan state.

## 12. RAG Architecture: echo-nemo-1.0

`echo-nemo-1.0` is not a custom-trained foundation model. It is a RAG system around a general-purpose LLM.

Ingestion flow:

1. User uploads file, URL, or transcript.
2. Next.js route forwards to FastAPI service.
3. Service extracts text from PDF/DOCX/CSV/TXT/MD/URL.
4. Text is cleaned into Markdown.
5. Text is chunked into overlapping chunks.
6. Chunks are embedded with `sentence-transformers/all-MiniLM-L6-v2`.
7. Embeddings and metadata are stored in Chroma.
8. Collection name is scoped per user for data isolation.

Query flow:

1. User asks a question in `/chat`.
2. Query may be expanded using recent chat history.
3. Postgres `ChunkScore` values provide source boosts from prior feedback.
4. Next.js calls Chroma `/query/scored`.
5. Chroma returns top chunks, sources, chunk IDs, and scores.
6. Next.js builds a grounded prompt from retrieved chunks.
7. If user has a connected agent key, the chosen provider generates the answer.
8. Otherwise Groq Llama generates the answer.
9. Answer, sources, model, and chunk IDs are returned and persisted.
10. Thumbs up/down updates `RagFeedback` and `ChunkScore`.

Why RAG over fine-tuning:

> Fine-tuning changes model behavior or style, but it is not ideal for constantly changing user-specific knowledge. RAG retrieves fresh private data at query time, so a document becomes queryable immediately after ingestion, without retraining.

Adaptive mechanism:

- Positive feedback increases source score.
- Negative feedback decreases source score.
- Future retrieval adds a weighted boost to sources with good history.
- This is not full ML training; it is deterministic re-ranking.

Important code caveat:

- In the current `echo-rag/chroma-service/main.py`, the intended URL/text duplicate-removal logic references `collection` before it is assigned in `ingest_url` and `ingest_text`. The fix is to call `collection = get_collection(...)` before `collection.get(...)`. This is a good honest interview talking point: the architecture is sound, and the bug is small and easy to explain.

## 13. AI Features

Video AI:

- Groq Whisper Large v3 transcribes videos.
- Groq Llama 3.3 70B generates title and summary.
- Failures do not break the video; status returns to `READY`.

Product chatbot:

- Narrow system prompt answers only Echo product questions.
- Last 10 messages are sent for context.

Knowledge graph:

- Text is sent to Groq with a structured JSON extraction prompt.
- Response is parsed after stripping code fences.
- Invalid edges are filtered if source/target IDs are missing.
- D3 renders force-directed graph.
- Separate graph chat answers questions over nodes/edges.

Agent connections:

- User can connect OpenAI, Claude, Gemini, or Mistral key.
- Key is validated with a live provider call before storage.
- Key is encrypted with AES-256-GCM.
- API responses return metadata and key hint only, never plaintext.

## 14. Electron Desktop App

Electron reuses the web app and adds native features:

- Main process creates `BrowserWindow`.
- Preload exposes limited `window.electron` APIs through context bridge.
- Renderer remains isolated from Node APIs.
- `desktopCapturer` lists screen/window sources.
- macOS permission helpers request camera/mic or open screen-recording settings.
- Tray menu supports Open Echo, New Recording, Quit.
- Device presets are stored in an in-memory map for the session.

Interview answer:

> I built desktop last so the recording pipeline was already proven in the web app. Electron then became a thin native shell around the same Next.js UI, adding native capture and tray convenience without duplicating product logic.

## 15. Important Design Decisions and Trade-Offs

- Monolith plus one microservice: Next.js handles most product logic; Python service exists only because Chroma and sentence-transformers need Python.
- Server Components by default: reduce browser JS and fetch data close to DB.
- Client Components only for browser APIs: recording, canvas, chat, drag/drop.
- Polling for transcript: simpler than WebSockets for 10-30 second jobs.
- Supabase Storage public URLs: simple sharing; private/signed URLs would be stronger for enterprise privacy.
- Base64 upload: easy to implement; worse memory and bandwidth than direct/chunked uploads.
- Clerk managed auth: safer and faster than custom password auth.
- Prisma: strong types and migrations; less control than hand-tuned SQL.
- Chroma per-user collections: structural isolation; collection sprawl needs monitoring at larger scale.
- Feedback re-ranking: explainable and cheap; less powerful than trained ranking model.
- Workflow builder simulated execution: good UI demonstration; real execution requires queue, OAuth, schedulers, retries.

## 16. Performance, Scalability, Security

Performance:

- Server Components for initial data fetching.
- Suspense skeletons for dashboard search.
- Parallel `Promise.all` for stats and member lists.
- Chroma embedding model loaded once at FastAPI startup.
- Query top-k limits bound retrieval and generation cost.
- Transcript generation runs asynchronously from user redirect.

Scalability:

- Vercel/Next route handlers scale per request.
- Neon serverless Postgres handles relational data.
- Prisma client singleton avoids dev connection explosions.
- RAG service can scale separately from web app.
- Chroma persistent disk preserves vector data across restarts.

Security:

- Clerk sessions and route protection.
- Signature verification for Clerk/Stripe webhooks.
- RBAC on workspace mutations.
- API key encryption with AES-256-GCM.
- API key hints only, no plaintext key exposure.
- Server-only service role keys and environment variables.
- Per-user vector collections.

Future hardening:

- Signed/private video URLs instead of public storage URLs.
- File size/type limits and virus scanning.
- Rate limiting on upload, chat, and webhook endpoints.
- Stronger authorization checks on public video editing/title updates.
- Move secrets to managed secret store.
- Add audit logs for workspace admin actions.

## 17. Challenges and How to Explain Them

Next.js 16 Proxy:

> Middleware was renamed to Proxy. I checked the bundled Next docs and used `src/proxy.ts` for Clerk route protection.

Webhook race:

> A new user can hit an API before the Clerk webhook creates the local row. I handled this by creating the user inline as a fallback.

Stripe API typing change:

> I used a helper to read period end from current or changed fields, making the webhook resilient to SDK/API shape drift.

Large recordings:

> Base64 upload was practical for an MVP, but the production evolution is direct signed upload or streaming chunks.

LLM JSON reliability:

> I prompt for raw JSON, strip code fences, catch parse errors, and validate edges before rendering.

RAG service bug:

> I found a small ordering bug where `collection` is used before assignment in URL/text ingestion. The fix is moving collection initialization before duplicate deletion. This is exactly the sort of implementation issue I would catch with integration tests around ingestion routes.

## 18. Interview Questions and Answers

### Beginner Technical

**Q: What is Echo?**  
A: Echo is a full-stack async video recording and AI knowledge platform. Users can record videos, upload them, share links, comment, generate transcripts/summaries, organize workspaces, and query their private documents through a RAG assistant.

**Q: What are the main technologies?**  
A: Next.js 16, React 19, TypeScript, Tailwind, shadcn/Radix, Prisma 7, PostgreSQL/Neon, Clerk, Supabase Storage, Stripe, Groq, Chroma, FastAPI, Electron, Fabric.js, D3, and React Flow.

**Q: What is the database used for?**  
A: Postgres stores relational product data: users, workspaces, memberships, videos, comments, subscriptions, invites, agent keys, RAG feedback, chunk scores, and chat sessions.

**Q: What is Supabase used for?**  
A: Supabase Storage stores uploaded video files. The database remains in Postgres/Neon; Supabase is used mainly as object storage.

**Q: What is Clerk used for?**  
A: Clerk handles authentication, sessions, and sign-in/sign-up UI. Echo syncs Clerk users into its own database through verified webhooks.

### Recording and Video Pipeline

**Q: Explain the recording pipeline.**  
A: The browser or Electron shell captures media using `MediaRecorder`. Chunks are assembled into a Blob, converted to base64, sent to `/api/upload`, decoded server-side, uploaded to Supabase Storage, and stored as a `Video` row. The app redirects to the public video page while transcription runs in the background.

**Q: Why use MediaRecorder?**  
A: It is browser-native, avoids paid recording SDKs, and supports screen/camera capture with standard APIs.

**Q: What are the limitations of the current upload strategy?**  
A: Base64 increases payload size and requires holding the entire video in memory. For production, signed direct upload or chunked streaming would scale better.

**Q: Why does transcription not block upload?**  
A: The user can watch/share the video immediately. AI metadata is optional enrichment, so it runs asynchronously and the UI polls for completion.

### Backend/API

**Q: Why use Next.js route handlers instead of a separate backend?**  
A: The app benefits from a single deployable unit, shared TypeScript types, and colocated backend endpoints. A separate service is used only where necessary: Python-based RAG.

**Q: How do API routes authenticate users?**  
A: Protected routes call Clerk `auth()` to read the current session. `proxy.ts` also blocks access to dashboard and selected API routes before handlers run.

**Q: How do you handle authorization?**  
A: Auth identifies the user; authorization checks membership and role in the database, especially for workspace mutations like rename, invite, and member removal.

### Database and Multi-Tenancy

**Q: Why did you use a `Membership` table?**  
A: Users and workspaces are many-to-many, and the role belongs to that relationship. A user can be an owner in one workspace and a member in another.

**Q: What is the tenant boundary?**  
A: `Workspace` is the tenant boundary for product data, while RAG vector data is isolated by per-user Chroma collections.

**Q: What would you improve for strict multi-tenant security?**  
A: I would ensure every query verifies membership, add row-level access tests, consider Postgres RLS, and avoid relying only on client-provided workspace IDs.

### Auth, Webhooks, and Billing

**Q: How does Clerk sync to your DB?**  
A: Clerk sends `user.created`, `user.updated`, and `user.deleted` events. Echo verifies Svix headers and upserts/deletes local user rows.

**Q: Why verify webhooks?**  
A: Webhook URLs are public. Signature verification proves the event came from Clerk or Stripe and was not forged.

**Q: Explain Stripe checkout.**  
A: The app creates a Stripe customer if needed, creates a subscription Checkout Session, redirects to Stripe, then Stripe webhooks update local subscription and workspace plan.

**Q: Do you handle payment details?**  
A: No. Stripe-hosted Checkout handles card data, reducing PCI scope.

### RAG and AI

**Q: Did you train a custom model?**  
A: No. `echo-nemo-1.0` is a product name for a RAG system. It retrieves user-specific context and sends it to an existing LLM. The model weights are not trained.

**Q: Why RAG instead of fine-tuning?**  
A: RAG is better for changing private knowledge. New documents become queryable immediately. Fine-tuning is more suitable for changing style/behavior and requires retraining when facts change.

**Q: What is an embedding?**  
A: An embedding is a numeric vector representing semantic meaning. Similar texts have nearby vectors, enabling semantic search beyond exact keyword matching.

**Q: How does retrieval work?**  
A: The question is embedded with the same model as the chunks. Chroma compares vectors using cosine distance and returns the most relevant chunks.

**Q: What makes your RAG adaptive?**  
A: User feedback updates source scores in Postgres. Future retrieval adds a boost for sources that historically produced helpful answers.

**Q: How do you prevent hallucinations?**  
A: The system prompt tells the model to answer only from context and say it lacks information when context is insufficient. Low temperature also reduces randomness, though this is not a perfect guarantee.

**Q: Why a separate Python service?**  
A: Chroma and sentence-transformers fit Python. Keeping that in FastAPI avoids forcing Python dependencies into the Next.js deployment.

### Security

**Q: How are third-party API keys stored?**  
A: Keys are validated, encrypted with AES-256-GCM using a server-only secret, and stored as ciphertext plus a short display hint.

**Q: What security risks remain?**  
A: Public video URLs, lack of rate limiting, file scanning, and finer-grained membership checks are areas for hardening.

**Q: How is user data isolated in RAG?**  
A: Chroma collections are per user, so queries target only that user's collection.

### Architecture and System Design

**Q: Draw the high-level architecture.**  
A: Browser/Electron client -> Next.js app/API -> Clerk, Postgres/Prisma, Supabase Storage, Stripe, Groq, and FastAPI RAG service -> Chroma persistent vector store.

**Q: Why not use WebSockets for transcription status?**  
A: Polling every few seconds is enough for a 10-30 second background process. WebSockets add persistent infrastructure that is unnecessary at this scale.

**Q: How would you scale video uploads?**  
A: Use direct signed uploads, multipart/chunked upload, background jobs for transcription, and queue workers for AI processing.

**Q: How would you scale RAG?**  
A: Move from a single Chroma instance to managed vector DB or sharded collections, add caching, batch embeddings, job queues for ingestion, and observability around latency/recall.

### Project-Specific Implementation

**Q: What does `/api/rag/query` do?**  
A: Authenticates user, loads feedback-based source boosts, optionally expands the query, calls Chroma scored retrieval, builds a context prompt, selects connected agent or Groq, generates an answer, and returns answer/sources/chunk IDs.

**Q: What does `/api/videos/[videoId]/transcribe` do?**  
A: Authenticates the owner, marks video processing, downloads video from Supabase, transcribes via Whisper, summarizes via Llama, optionally ingests transcript into RAG, updates the video row, and handles failure gracefully.

**Q: What does the Electron shell add?**  
A: Native screen source capture, OS permission helpers, tray menu, and a thin desktop wrapper around the same Next.js app.

**Q: What is the knowledge graph feature?**  
A: It extracts entities and relationships from document text using Llama, validates graph JSON, and renders it as a D3 force-directed graph with a graph-specific chat interface.

### "Why This Approach?"

**Q: Why Prisma?**  
A: Type-safe queries, migrations, schema clarity, and faster iteration. Raw SQL may be faster for complex queries but increases maintenance.

**Q: Why Clerk?**  
A: Auth is security-sensitive and time-consuming. Clerk gives managed sessions, UI, and webhooks so I can focus on product logic.

**Q: Why Supabase Storage?**  
A: It was free-tier friendly and simple for video object storage. For production scale, S3/R2 with signed URLs could be stronger.

**Q: Why Groq?**  
A: Fast inference and useful free access for Llama and Whisper made it practical for a portfolio-scale project.

**Q: Why not build canvas/workflow logic from scratch?**  
A: Fabric.js and React Flow solve complex interaction problems like object selection, transforms, drag/drop, edges, zoom, and pan. Reusing proven libraries let me focus on product UX.

### Scenario Questions

**Q: A transcript fails. What happens?**  
A: The video remains usable. The route catches the error and reverts status to `READY` rather than marking the whole video failed.

**Q: Stripe sends the same webhook twice. What happens?**  
A: The subscription handler uses `upsert` for checkout completion, making retries idempotent.

**Q: A user accepts an expired invite. What happens?**  
A: The invite page and server action both check expiry and refuse expired invites.

**Q: RAG service is down. What happens?**  
A: RAG endpoints return errors or empty document lists gracefully. The core video product still works.

**Q: A user pastes an invalid API key. What happens?**  
A: The app validates it against the provider before storing and rejects invalid keys.

**Q: How would you debug bad RAG answers?**  
A: Inspect retrieved chunks, sources, distances/scores, prompt construction, feedback scores, chunking quality, and whether the answer is unsupported by context.

### Advanced Follow-Ups

**Q: How would you add background jobs?**  
A: Add a queue such as BullMQ, Inngest, or Trigger.dev. Upload route enqueues transcription and ingestion jobs; workers update status asynchronously.

**Q: How would you make videos private?**  
A: Store objects privately, issue signed URLs only after authorization, and add per-video sharing permissions.

**Q: How would you support teams/enterprise?**  
A: Add SSO/SAML, audit logs, SCIM, RBAC permissions, data retention policies, workspace-level RAG collections, and admin dashboards.

**Q: How would you measure RAG quality?**  
A: Track retrieval precision, answer helpfulness, source citation accuracy, thumbs up/down, latency, and create evaluation datasets with expected answers.

**Q: How would you improve adaptive ranking?**  
A: Store feedback per chunk ID instead of answer-derived hash, add recency weighting, normalize source scores, and eventually train or use a learning-to-rank model.

## 19. HR and Behavioral Questions

**Q: Tell me about a challenging bug in this project.**  
A: One challenge was the signup/webhook race. A newly authenticated user could call an API before Clerk's webhook created the local DB row. I solved it by making important routes resilient: if the DB user is missing but Clerk auth is valid, the route creates the local user inline.

**Q: What are you most proud of?**  
A: The end-to-end integration. It is not only UI; it includes auth, database modeling, file storage, AI transcription, RAG, billing, workspaces, and desktop support. The project shows I can connect many systems into one coherent product.

**Q: What would you improve if you had more time?**  
A: I would replace base64 uploads with signed/chunked uploads, add background queues, harden video privacy, add rate limiting, write integration tests, and fix the RAG ingestion ordering bug.

**Q: How did you prioritize features?**  
A: I built the core user value first: record, upload, share, comment. Then I added business/product layers: auth, workspaces, billing. Finally I added differentiators: AI summaries, RAG, agents, knowledge graph, desktop.

**Q: What did this project teach you?**  
A: It taught me how to integrate real services safely, design multi-tenant schemas, handle asynchronous workflows, choose simple solutions where appropriate, and explain trade-offs clearly.

## 20. Best Interview Closing Summary

Use this as your final answer when asked to summarize:

> Echo is a full-stack AI video and knowledge platform. The user-facing workflow is simple: record a screen/camera video, upload it, share it, comment on it, and get AI transcript/summary. Under the hood, it combines Next.js App Router, Clerk auth, Prisma/Postgres multi-tenancy, Supabase video storage, Stripe billing, Groq AI, and a FastAPI/Chroma RAG service. The most important engineering decisions were using a membership-based workspace schema, asynchronous AI processing, RAG instead of fine-tuning, per-user vector isolation, and a pragmatic monolith-plus-one-microservice architecture. If I were productionizing it, I would focus next on signed/chunked uploads, job queues, rate limiting, private video access, and stronger integration tests.

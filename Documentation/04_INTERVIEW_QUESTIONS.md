# Echo — Interview Preparation Q&A

Questions ordered to follow the actual build sequence — from project setup through to the final adaptive RAG system. Each question is the kind an interviewer would realistically ask about a project like this; each answer is the depth expected from someone who actually built it.

---

## Section 1 — Project Setup & Tooling

**Q: Why did you choose Next.js with the App Router over Pages Router or a separate frontend/backend split?**
A: App Router gives nested layouts (so the dashboard sidebar doesn't have to be re-implemented per page), Server Components (data fetching directly in components without a separate API call for every page load), and a single deployable unit instead of managing CORS and two separate deployments for a frontend and a backend.

**Q: What's the difference between a Server Component and a Client Component, and how did you decide which to use where?**
A: Server Components run only on the server and ship no JavaScript to the browser; Client Components (`"use client"`) run in the browser and are required for state, effects, and browser APIs. I defaulted to Server Components everywhere — the video library page queries Prisma directly in the component body — and only opted into Client Components where genuinely needed: the recording UI (needs `MediaRecorder`), the canvas (needs direct DOM/mouse access), chat interfaces (need local message state).

**Q: You hit a Next.js 16 issue where `middleware.ts` stopped working. What happened and how did you fix it?**
A: Next.js 16 renamed the middleware file convention to `proxy.ts`. The functionality (Clerk's `clerkMiddleware` wrapping route protection) was identical — it was purely a file rename, but it broke route protection silently until I noticed the deprecation warning in the terminal output and renamed the file.

**Q: Why use shadcn/ui instead of a packaged component library like Material UI or Chakra?**
A: shadcn's CLI copies component source code directly into the project rather than installing it as an opaque dependency. That meant I could directly edit Button/Card/Dialog internals — for example, customizing Clerk's auth UI to match the app's dark theme required passing custom CSS variables into Clerk's `appearance` prop, which only worked cleanly because I had full visibility into how the surrounding components were styled.

**Q: How did you architect the color/theme system?**
A: CSS custom properties (`--primary`, `--background`, etc.) defined as HSL values in `:root` (light) and `.dark` blocks, then mapped into Tailwind's `@theme inline` block so `bg-primary` resolves to `hsl(var(--primary))`. Dark mode isn't just an inverted light palette — the primary color is *lighter* in dark mode (58% lightness vs 40%) because the same exact color reads as too dark against a near-black background otherwise.

---

## Section 2 — Database & Data Modeling

**Q: Walk me through your database schema and why you modeled multi-tenancy the way you did.**
A: Ten Prisma models on Postgres. The core multi-tenancy decision is `Membership` as a separate join table between `User` and `Workspace`, rather than a direct relation — this lets the same user belong to multiple workspaces with a *different role in each one* (owner of workspace A, regular member of workspace B), which a direct many-to-many relation alone couldn't express, since role data has to live somewhere.

**Q: Why Prisma over writing raw SQL or using a query builder?**
A: Type safety — the generated client gives compile-time errors for typos in field names or wrong types, instead of discovering a broken query at runtime. Migrations are also tracked and versioned automatically, so I never had to write or remember manual SQL migration files.

**Q: You mentioned Prisma 7 changed how database URLs work. Explain that.**
A: Prisma 7 removed the `url` field from the `datasource` block in `schema.prisma` — connection info now lives in a separate `prisma.config.ts` for the CLI/migrations, and at runtime you explicitly construct a driver adapter (`PrismaPg`) with the connection string and pass it into `PrismaClient`. It's more verbose but more explicit — connection pool settings like `max: 1` are now visible application code, not hidden Prisma internals.

**Q: Why `max: 1` on your connection pool?**
A: Neon's free tier caps total simultaneous connections. In development, Next.js's hot-reload would otherwise spawn a brand-new connection pool on every file save without a singleton pattern guarding the `PrismaClient` instance, quickly exhausting that limit. Caching one client on `globalThis` plus capping the pool size at 1 connection kept usage well within the free tier.

**Q: How do you handle cascading deletes vs. preserving data when a parent record is removed?**
A: Deliberately different per relation. Deleting a `Workspace` cascades and deletes all its videos — a workspace's videos have no meaning without it. Deleting a `Folder`, though, uses `onDelete: SetNull` on its videos — the videos survive and just become uncategorized, because a video shouldn't be destroyed just because someone deleted the folder organizing it.

**Q: What's a composite unique constraint and where did you use one?**
A: A uniqueness rule spanning multiple columns together. `Membership` has `@@unique([userId, workspaceId])` — it prevents a user from having two separate membership rows in the *same* workspace, while still allowing that same user to have many memberships across *different* workspaces.

---

## Section 3 — Authentication & Webhooks

**Q: Why Clerk instead of building auth yourself or using NextAuth?**
A: Clerk handles password storage, session management, OAuth providers, and pre-built UI components, none of which I wanted to own the security surface area for. The free tier (50,000 monthly active users) was far beyond what this project needed.

**Q: How does a Clerk user become a row in your own database?**
A: A webhook — `/api/webhooks/clerk` — that Clerk calls on `user.created`, `user.updated`, and `user.deleted`. The handler verifies the request's signature using the `svix` library before trusting the payload, then `upsert`s a `User` row keyed on Clerk's user ID.

**Q: Why `upsert` instead of `create`?**
A: `user.updated` can fire many times over a user's account lifetime (changing their name, avatar, etc.) — `create` would throw on the second event since the user already exists. `upsert` correctly handles both "never seen this user, create them" and "already exists, just refresh their data" in one call.

**Q: What's webhook signature verification and why does it matter?**
A: Webhooks are just public URLs — without cryptographic verification, anyone who discovers the endpoint could POST a fake "user created" payload and fabricate database rows. `svix` (for Clerk) and Stripe's own `constructEvent` method verify a signature included in the request headers against a shared secret, proving the request genuinely came from the claimed sender.

**Q: You mentioned a race condition between signup and the webhook. What was it and how did you solve it?**
A: A brand-new user could hit an authenticated API route (like uploading their first video) before the webhook had finished creating their `User` row — especially likely during local dev where the webhook traveled through an ngrok tunnel with extra latency. Every route needing the internal user record does a `findUnique` first, and falls back to creating the user inline (using Clerk's `currentUser()` for the profile data) if it's missing — so the very first request after signup never fails due to this timing gap.

**Q: What issue did you run into testing webhooks locally, and what's the permanent fix?**
A: Free ngrok URLs regenerate on every restart, so Clerk/Stripe kept trying to deliver webhooks to a now-dead URL until I manually updated the registered endpoint. The permanent fix is ngrok's free reserved static domain — one URL that survives restarts, registered once in each provider's dashboard.

---

## Section 4 — File Storage & The Recording Pipeline

**Q: Walk me through exactly what happens, technically, when a user clicks "stop recording."**
A: The `MediaRecorder`'s `onstop` handler fires, assembling all the chunks collected during recording (gathered every second via `recorder.start(1000)`) into a single `Blob`. That blob is converted to a base64 data URL via `FileReader.readAsDataURL`. The base64 string is POSTed as JSON to an API route, which decodes it back to a `Buffer`, uploads it to Supabase Storage, creates a `Video` row, and returns the new video's ID — at which point the client redirects to that video's player page and fires a non-blocking transcription request in the background.

**Q: Why base64-encode the video instead of uploading it directly as binary?**
A: I originally planned a presigned-URL approach with Cloudflare R2, where the browser uploads binary data directly to storage. R2 required a credit card even on its free tier, so I switched to Supabase Storage, which doesn't — but that meant routing the upload through my own Next.js API route rather than directly to storage. JSON request bodies can't contain raw binary, so base64 encoding was the simplest way to get the video data into that request.

**Q: Why `MediaRecorder.start(1000)` instead of just calling `.start()`?**
A: Passing a timeslice makes the recorder emit a `dataavailable` event with a chunk of encoded video every second, rather than producing nothing until the entire recording finishes. This means if the browser tab crashed mid-recording, whatever chunks had already fired wouldn't be lost — though in the current implementation those chunks are still buffered in memory rather than streamed out progressively, which would be the next iteration (using the Socket.io server already scaffolded for that purpose).

**Q: How does the AI transcription work without blocking the user?**
A: After upload succeeds, the transcription request is fired with `fetch(...).catch(...)` — explicitly not awaited. The user is redirected to the video page immediately, which shows a "Generating transcript..." state and polls the video's API endpoint every 3 seconds until the transcript field is populated, then displays it without requiring a manual refresh.

**Q: Why polling instead of WebSockets for the transcript status?**
A: Transcription typically completes in 10-30 seconds. A WebSocket connection adds real infrastructure complexity (a persistent connection, a separate stateful server since serverless functions can't hold long-lived connections) for a problem that a `setInterval` checking every 3 seconds solves adequately at this scale. I'd reach for WebSockets if the latency requirement were sub-second or the polling frequency needed were high enough to matter for cost/load.

---

## Section 5 — Payments

**Q: How does your Stripe integration avoid ever handling raw credit card data?**
A: Stripe Checkout is fully hosted — the upgrade button creates a Checkout Session server-side and redirects the browser to Stripe's own domain to collect payment details. My server only ever receives a session ID and, later, a webhook event; it never touches a card number, which keeps the application entirely out of PCI compliance scope.

**Q: Walk me through what happens after someone completes checkout.**
A: Stripe sends a `checkout.session.completed` webhook to `/api/webhooks/stripe`. After signature verification, the handler retrieves the full subscription object from Stripe's API, then `upsert`s a `Subscription` row in my own database (keyed on `workspaceId`) and flips the `Workspace.plan` field to `PRO` — so the rest of the app can check plan status with a simple database read rather than calling Stripe's API on every page load.

**Q: Why upsert instead of create for the subscription record?**
A: Stripe retries webhook delivery on timeout, meaning the same event can legitimately arrive twice. `upsert` keyed on workspace ID makes a duplicate delivery a no-op (it just re-writes the same state) instead of throwing a unique-constraint error on the second attempt.

**Q: How did you handle a breaking change in Stripe's API?**
A: Mid-project, `subscription.current_period_end` stopped being available directly on the typed `Subscription` object after an API version bump — the SDK's TypeScript types had moved on, but the field was still actually present in the runtime payload. I wrote a small helper that reads the value off the raw object via a type cast (`subscription as unknown as Record<string, unknown>`) rather than depending on the SDK's exact compile-time shape, which is a reasonable defensive pattern for any third-party API that versions frequently.

---

## Section 6 — Multi-Tenancy & Workspaces

**Q: How does switching workspaces actually update what data is shown?**
A: A React Context (`WorkspaceProvider`) holds the active workspace ID, persisted to `localStorage` so it survives a page refresh. Switching workspaces calls `router.refresh()`, which forces every Server Component on the current page to re-run its data fetching — so a video library query scoped by `workspaceId` re-executes against the newly selected workspace automatically.

**Q: How do workspace invites work end to end?**
A: An admin enters an email; the server creates an `Invite` row with a random token (`cuid()`) and a 7-day expiry, and returns a shareable link (`/invite/[token]`). That page checks the invite exists, isn't already accepted, and hasn't expired, then — if the visitor is signed in — presents an "Accept" button wired to a Server Action that creates the `Membership` row directly and marks the invite as accepted.

**Q: You mentioned a bug where accepted invites didn't show up. What was wrong?**
A: The original implementation had the Server Action call `fetch()` against my own API route to accept the invite — but server-side `fetch` calls don't automatically carry the browser's authentication cookies, so the API route's `auth()` check silently failed. The fix was writing directly to the database inside the Server Action itself, removing the unnecessary HTTP round-trip (and the cookie-forwarding problem with it) entirely.

**Q: How do you prevent a regular member from removing other members or renaming the workspace?**
A: Every mutating workspace route checks the requesting user's `Membership.role` before proceeding — `if (!membership || membership.role === "MEMBER") return 403`. Only `OWNER` and `ADMIN` roles pass that check.

---

## Section 7 — Canvas & Workflow Builder

**Q: Why Fabric.js instead of building directly on the Canvas API?**
A: Raw Canvas is just pixels — it has no concept of selectable, draggable "objects." Fabric.js layers an object model (rectangles, ellipses, text, groups) on top, giving free selection handles, drag-to-move, and resize behavior. Implementing hit-testing and transform handles myself would have been its own multi-week project.

**Q: You ran into a "canvas already initialized" error. What caused it and how did you fix it?**
A: React 18's Strict Mode intentionally runs effects twice in development to surface cleanup bugs. Fabric.js sets an internal flag on the DOM canvas element when initialized, and that flag survives Strict Mode's mount→unmount→remount cycle, so the second initialization attempt threw. The fix was a ref-based guard (`initializingRef`) that prevents a second `new Canvas()` call on the same element, only resetting on a genuine unmount.

**Q: How does panning work without moving every object on the canvas individually?**
A: Fabric exposes a `viewportTransform` matrix on the canvas — panning just updates its translation components (`vpt[4]`, `vpt[5]`) directly, which re-projects the entire view without touching any individual object's actual coordinates. This is both more efficient and conceptually correct — "panning" is moving the *camera*, not the scene.

**Q: Why React Flow for the workflow builder instead of building drag-and-drop yourself?**
A: React Flow handles node positioning, edge routing/rendering, drag-and-drop from an external palette, zoom/pan, and a minimap out of the box — all of which are non-trivial interaction problems. Building a custom graph editor from scratch wasn't justified for what's explicitly a "basic, visual-only" workflow builder rather than a full execution engine.

**Q: Is the workflow builder's "Run" button actually executing anything?**
A: No — that's an explicit scope boundary I called out. It's a simulated execution log (sequential delays with status messages) demonstrating what a real execution engine's UX would look like, not a functioning integration with Slack/email/etc. Building real execution would mean a job queue, webhook receivers per trigger type, and OAuth flows per integrated service — a substantial separate project.

---

## Section 8 — PDF → Knowledge Graph

**Q: How do you extract a structured knowledge graph from an arbitrary PDF?**
A: Client-side text extraction via `pdfjs-dist` (capped at the first 15 pages to bound cost/latency), then that raw text is sent to Groq's Llama 3.3 70B with a system prompt instructing it to return *only* a JSON object matching a specific schema — a list of nodes (each with an id, label, type, and description) and a list of edges (source, target, relationship label).

**Q: LLMs are unreliable about strictly following output formats. How did you handle that?**
A: A few layers of defense: the prompt explicitly says "no markdown, no explanation, just the JSON object," the parsing code strips markdown code fences (` ```json `) before calling `JSON.parse`, the parse itself is wrapped in a try/catch returning a clear error rather than crashing, and after parsing, any edge whose `source` or `target` doesn't match an actual extracted node ID is filtered out — so a partially malformed response degrades gracefully rather than rendering a broken graph.

**Q: Why D3.js instead of an off-the-shelf graph visualization library?**
A: I needed a force-directed layout (nodes auto-arranging based on their connections, not fixed positions), draggable nodes that re-heat the simulation, click-to-inspect detail panels, and a custom dark-mode-matched SVG aesthetic with colored node types and a legend. D3 is a toolkit for building exactly this kind of fully custom visualization, rather than a pre-styled chart component that would have fought me on every one of those requirements.

**Q: Explain how the force simulation actually positions the nodes.**
A: It's a physics simulation: every node repels every other node (`forceManyBody`, like same-charge particles), connected nodes are pulled toward each other along their edges (`forceLink`, like springs), a `forceCenter` keeps the whole graph roughly centered in the viewport, and `forceCollide` prevents nodes from overlapping. The simulation runs many small iterations (the "tick" loop) until it settles into a low-energy, visually balanced layout — there's no manual position-setting anywhere.

---

## Section 9 — AI: The Critical Distinction (RAG vs. Training)

**Q: You named your AI feature "echo-nemo-1.0." Did you train a custom LLM?**
A: No — and I want to be precise about that distinction, because it's the most important technical decision in this whole project. Training a model from scratch requires datacenter-scale compute and a massive curated dataset, costing millions of dollars realistically. What I built instead is a RAG (Retrieval-Augmented Generation) system — the underlying language model's weights are completely untouched; it's Groq's pre-trained Llama 3.3 70B doing the actual text generation. What's custom is the retrieval and adaptation layer wrapped around it: per-user document ingestion, a vector database, feedback-based re-ranking, and query expansion. "echo-nemo-1.0" is the product name for that system, not a literal claim of a newly trained foundation model.

**Q: Why is RAG the right approach here instead of fine-tuning?**
A: Fine-tuning bakes knowledge into a model's weights via additional training — it requires GPU compute, a prepared dataset, and critically, has to be *re-run* every time the underlying information changes. RAG instead retrieves relevant information at query time and hands it to the model as context. For a product where every user uploads their own, constantly-changing set of documents, RAG means a newly uploaded PDF is queryable the instant it's ingested — no retraining cycle, ever. Fine-tuning would also be solving a different problem; it's better suited to changing a model's *style or behavior*, not injecting facts from a specific, evolving document set.

**Q: Explain what an embedding is and why it's central to RAG.**
A: An embedding is a numerical vector representing a piece of text's *meaning* — texts with similar meaning produce vectors that are mathematically close together, even if they share few or no exact words. RAG depends on this because it lets you find "relevant" content by semantic similarity rather than exact keyword matching — a question phrased completely differently from the source document's wording can still retrieve the right passage.

**Q: What specific embedding model did you use, and why that one?**
A: `sentence-transformers/all-MiniLM-L6-v2` — chosen because it's small (~80MB), runs fast on CPU with no GPU required, is completely free with no API key, and produces good-enough quality embeddings for this scale. It runs directly inside the Python microservice, not as an external API call.

**Q: Walk me through the full RAG pipeline, step by step.**
A: Ingestion: a document is converted to clean text/Markdown. Chunking: that text is split into overlapping 512-word chunks (the overlap prevents a sentence from being meaninglessly split across a chunk boundary). Embedding: each chunk is converted to a vector via the embedding model. Storage: vectors plus the original chunk text and metadata are stored in Chroma, in a collection scoped to that specific user. At query time: the user's question is embedded with the *same* model, Chroma returns the most cosine-similar chunks, those chunks are inserted into a prompt alongside the question and a system prompt instructing the model to answer only from that context, and the LLM generates a grounded response.

**Q: How do you prevent the model from hallucinating an answer when the documents don't actually contain it?**
A: Entirely through prompt instructions — the system prompt explicitly says: "If the context doesn't contain enough information, say exactly: 'I don't have enough information in your documents to answer that.'" Combined with a low temperature (0.1) for more deterministic, less creative output. This isn't a hard technical guarantee (an LLM can still occasionally ignore instructions), but it's the standard, practical mitigation used in real RAG systems.

**Q: How is one user's data kept separate from another's in the vector database?**
A: Chroma collections are created per-user — `get_or_create_collection(name=f"user_{user_id}")`. This isn't a filter applied at query time that could be forgotten or misapplied in some code path; it's structural isolation. A query against User A's collection is *physically incapable* of returning User B's vectors, because they live in an entirely separate collection.

---

## Section 10 — Adaptive RAG & Agent Connections

**Q: You describe the system as "adaptive." What's actually adapting, and how?**
A: Two mechanisms, neither of which involves retraining any model. First, feedback-weighted re-ranking: every thumbs up/down on an answer updates a per-source score in Postgres (`ChunkScore` table) — positive feedback increases a source's score, negative decreases it. On future queries, those scores are fetched and passed to the retrieval step as a boost, so sources with a track record of producing good answers for that specific user get a small ranking advantage. Second, query expansion: follow-up questions get enriched with relevant terms pulled from recent conversation history before being embedded, improving retrieval recall on context-dependent questions like "how does that compare?"

**Q: Is this "adaptive" mechanism actually machine learning?**
A: No, and I'd be overstating it to call it that. It's a deterministic re-ranking heuristic — a weighted sum of cosine similarity plus a feedback-derived boost. It's simple, fully explainable (you could trace exactly why a chunk ranked where it did), and fast. It achieves a *similar practical effect* to a learned ranking model — getting better at surfacing the right content over time, per user — without any of the complexity or cost of actually training a ranking model.

**Q: What is "bring your own key" / agent connection, and why did you build it?**
A: Users can connect their own API key for Claude, GPT-4, Gemini, or Mistral. The exact same retrieval pipeline runs — same chunking, same vector search, same per-user knowledge base — but the final answer-generation step uses the user's chosen model instead of the default Groq Llama. This separates two genuinely independent concerns: "what context does the model see" (retrieval, which I control and built) from "which model reasons over that context" (generation, which the user can choose) — and it means a user who wants Claude's reasoning quality doesn't need me to pay for that API usage; it runs on their own account.

**Q: How do you securely store a user's third-party API key?**
A: AES-256-GCM symmetric encryption, using a server-only secret (`ENCRYPTION_SECRET`, never exposed to the client) that never enters the database. The encrypted value bundles the random initialization vector, an authentication tag (which detects tampering), and the ciphertext into one stored string. The database only ever holds that ciphertext plus a 4-character display hint (`...xK9p`) — never the usable, plaintext key, even to the legitimate owner viewing their own connected agents in the UI.

**Q: Do you validate a key before storing it?**
A: Yes — a live, minimal API call to the actual provider (e.g., an 8-token test completion to Claude, or fetching OpenAI's models list) confirms the key is genuinely valid before it's encrypted and saved. An invalid or revoked key is rejected immediately with a clear error, rather than being silently stored and only discovered broken the first time someone tries to use it in chat.

---

## Section 11 — Security & Architecture Decisions (General)

**Q: What's your overall philosophy on the architectural decisions in this project?**
A: Choosing the simplest mechanism that genuinely solves the problem, and being able to justify that choice. Polling instead of WebSockets where a few seconds of latency is fine. RAG instead of fine-tuning where retrieval alone solves the grounding problem. A hand-rolled module-level singleton instead of a state management library where exactly two pages needed to share one value. Every one of those is a deliberate trade-off, not a default — the skill is recognizing which tool actually fits the constraint in front of you, not reaching for the most sophisticated option available.

**Q: How did you handle a leaked credential during development?**
A: Twice during this build, a real secret (a database password, a Supabase service role key) was accidentally shared in plaintext during debugging. In both cases, the correct response — and what I did — was immediately rotating the credential (generating a new one, invalidating the old one) rather than just deleting the message it appeared in, because you can't be certain a leaked value wasn't already seen or copied elsewhere the moment it was exposed.

**Q: Why is the Chroma RAG service a separate deployment instead of part of the main Next.js app?**
A: A genuine technical constraint, not a stylistic choice — Chroma and `sentence-transformers` require a Python runtime, which a Next.js/Node.js application cannot provide. Rather than forcing a polyglot runtime into one deployment, it's a fully separate FastAPI service deployed independently to Render, communicating with the Next.js app purely over HTTP. The rest of the app stays a single Next.js monolith; this is the one deliberate exception, made only because the alternative (no Python-based embedding/vector-search capability at all) wasn't viable.

**Q: What would you do differently, or what's the most likely next step if you continued this project?**
A: Wire the workflow builder to real execution — actual webhook listeners per trigger type and real API calls per action (starting with email, since that's the lowest-integration-complexity action). I'd also move the recording upload from base64-in-JSON to true chunked/streaming upload via the already-scaffolded Socket.io server, which would remove the current practical limit on recording length imposed by holding the entire video in memory as a single Blob before upload.

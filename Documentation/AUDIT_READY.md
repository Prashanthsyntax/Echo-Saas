# AuditReady — AI Compliance Copilot

Memory-powered SOC 2 compliance agent embedded inside SentraCode.

## What it does

- Maps SentraCode security findings to SOC 2 / ISO 27001 controls automatically
- Writes every finding, remediation, and agent interaction to ChromaDB vector memory
- Retrieves relevant past audit history before every response — gets smarter over time
- Detects recurring control failures and flags systemic issues
- Proactively notifies you (via Pusher WebSocket) when a new scan breaks a control
- Exports a live Memory Timeline panel so the memory layer is visible in real time

## Free-tier infrastructure

| Service       | Usage                           | Free limit          |
|---|---|---|
| Groq          | Llama 3.3 70B reasoning         | 30 req/min, 1k/day  |
| ChromaDB      | Vector memory (self-hosted)     | Unlimited           |
| Neon          | PostgreSQL (audit schema)       | 500MB free          |
| Vercel        | Next.js frontend                | Unlimited bandwidth |
| Render        | Python scanner + Chroma service | 750h/month free     |
| Pusher        | Real-time gap alerts            | 200k msg/day free   |

## Demo arc

**Interaction 1** — fresh workspace:
> "Are we ready for SOC 2?" → generic advice, 0 memories recalled

**Interaction 10** — after scans + audit history:
> "Which controls are at risk?" → cites specific past findings by name, Memory Timeline shows 6 recalled memories

**Interaction 20** — proactive alert fires automatically:
> "⚠ New SQL injection in search.py breaks CC6.6 — same CWE appeared in auth/login.py in November. This is a recurring pattern."

## SOC 2 Control Mapping

CWE codes from SentraCode scans map automatically to SOC 2 Trust Service Criteria:

- CWE-89, 79, 78, 918 → CC6.6 (Security threats from outside)
- CWE-798, 522, 613   → CC6.3 (Credential management)
- CWE-306, 287, 347   → CC6.1 (Logical access)
- CWE-942, 319        → CC6.7 (Data transmission)
- CWE-502, 611        → CC8.1 (Change management)

## IEEE Research Angle

Novel contribution: first system combining real-time SAST scanning with
compliance control mapping and persistent vector memory for audit readiness,
running entirely on free-tier infrastructure with zero mandatory spend.

Title: "AuditReady: A Memory-Augmented AI Agent for Continuous SOC 2
Compliance Monitoring Using Free-Tier Infrastructure"
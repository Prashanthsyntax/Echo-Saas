# SentraCode — AI-Powered Application Security Platform

## Complete Technical Documentation

> **Classification:** Internal · MOSAIC Platform · ARK Groups  
> **Version:** 2.0.0 · Built on Next.js 16, Python FastAPI, Groq Llama 3.3 70B  
> **Target Conferences:** IEEE ICDE · IEEE Big Data · IEEE S&P

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [What Makes SentraCode Unique](#2-what-makes-sentracode-unique)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema](#5-database-schema)
6. [Scanner Microservice](#6-scanner-microservice)
7. [Multi-Agent AI Engine](#7-multi-agent-ai-engine)
8. [Fix + Verify Pipeline](#8-fix--verify-pipeline)
9. [CLI Tool](#9-cli-tool)
10. [Dashboard & Visualizations](#10-dashboard--visualizations)
11. [Security Posture Radar](#11-security-posture-radar)
12. [API Reference](#12-api-reference)
13. [Architecture Diagram Prompts](#13-architecture-diagram-prompts)
14. [Research Contributions](#14-research-contributions)
15. [End-to-End Workflow](#15-end-to-end-workflow)

---

## 1. Project Overview

SentraCode is a **terminal-first, AI-powered Application Security (AppSec) and Continuous Security Code Review platform** embedded inside the MOSAIC SaaS ecosystem. It combines:

- A **Python FastAPI scanner microservice** running multi-layer static analysis
- A **5-agent AI reasoning engine** powered by Groq Llama 3.3 70B
- A **Next.js 16 dashboard** with interactive visualizations
- A **Node.js CLI** (`sentra`) for developer-local scanning
- A **Fix + Verify pipeline** that generates patches and creates real GitHub PRs

### Core Philosophy

> *Not just another code scanner — an integrated AI Security Engineering platform focused on repository-level reasoning, attack-path intelligence, automated remediation, verification, and continuous security monitoring.*

### The Complete Workflow

```bash
Discover → Scan → Correlate → Reason → Prioritize → Explain → Fix → Verify → Track
```

---

## 2. What Makes SentraCode Unique

### 2.1 Repository-Level Reasoning (not file-level)

Most security tools scan files in isolation. SentraCode's AI agents analyze the **entire repository context**, correlating findings across files to:

- Identify which vulnerabilities are reachable from public entry points
- Trace data flow from user input (source) to dangerous operation (sink) across multiple files
- Build multi-step attack chains that chain individual weaknesses into full compromises

### 2.2 Five-Stage AI Agent Pipeline

A sequential pipeline of 5 specialized Groq Llama agents — each one refines the previous agent's output:

| Stage | Agent | What it does |
| --- | --- | --- |
| 1 | **VulnDetect** | Removes false positives, merges duplicates, assigns confidence scores |
| 2 | **CodeFlow** | Traces data flow source → sink across files |
| 3 | **AttackPath** | Builds multi-step attack chains (SQLi → data exfil → RCE) |
| 4 | **RiskScorer** | Scores by exploitability × business impact (beyond CVSS) |
| 5 | **Explainer** | Plain-English explanation + numbered exploit steps + code diff |

### 2.3 Five-Layer Scanning

Unlike tools that only do SAST, SentraCode runs **five parallel layers**:

```bash
SAST → Secrets Detection → SCA (dependency CVEs) → API Security → Supply Chain
```

### 2.4 Fix + Verify Pipeline

First platform to combine:

1. AI-generated complete file fix (not just a diff)
2. Real GitHub branch + PR creation
3. Automatic re-scan to verify the fix resolved the vulnerability without regressions

### 2.5 OWASP Radar Visualization

A real-time radar chart mapping findings to 6 OWASP Top 10 categories with:

- Live score computation from actual scan results
- Grade (A → F) per category
- Safe threshold comparison
- Export to HTML security report

### 2.6 Developer CLI

`sentra scan` works locally, offline, and in CI/CD — no browser required.

### 2.7 OSV.dev Integration

SCA checks every dependency against the Open Source Vulnerability database (OSV.dev) in real time — no stale CVE snapshots.

---

## 3. System Architecture

### 3.1 High-Level Architecture

```bash
┌─────────────────────────────────────────────────────────────────┐
│                        MOSAIC Platform                           │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │  Next.js 16  │   │   SentraCode │   │   Chroma RAG       │  │
│  │  Dashboard   │◄──│   Dashboard  │   │   Microservice     │  │
│  │  (Vercel)    │   │   Pages      │   │   (Render)         │  │
│  └──────┬───────┘   └──────┬───────┘   └────────────────────┘  │
│         │                  │                                      │
│  ┌──────▼───────────────────▼──────────────────────────────────┐│
│  │              Next.js API Routes (/api/sentra/*)              ││
│  │  repos · scan · findings · fix · verify · attack-paths       ││
│  │  attack-paths/graph · report · cli/auth · settings           ││
│  └──────────────────────────┬───────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTP
        ┌─────────────────────▼──────────────────────┐
        │         Python FastAPI Scanner Service       │
        │              (Port 8001 / Render)            │
        │                                              │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
        │  │   SAST   │  │ Secrets  │  │   SCA    │  │
        │  │ Scanner  │  │ Scanner  │  │ (OSV.dev)│  │
        │  └──────────┘  └──────────┘  └──────────┘  │
        │  ┌──────────┐  ┌──────────┐                 │
        │  │   API    │  │ Supply   │                 │
        │  │ Security │  │  Chain   │                 │
        │  └──────────┘  └──────────┘                 │
        │                                              │
        │  ┌──────────────────────────────────────┐   │
        │  │        5-Agent AI Pipeline           │   │
        │  │  VulnDetect → CodeFlow → AttackPath  │   │
        │  │       → RiskScorer → Explainer       │   │
        │  └──────────────────┬───────────────────┘   │
        └─────────────────────┼───────────────────────┘
                              │ Groq API
                    ┌─────────▼──────────┐
                    │  Groq Llama 3.3 70B │
                    │  (Inference Engine) │
                    └────────────────────┘
```

### 3.2 Scan Pipeline Architecture

```bash
GitHub Repo
    │
    ▼
fetchRepoTree()          ← GitHub API: get all file paths
    │
    ▼
fetchFileContent()       ← GitHub API: fetch up to 40 code files in parallel batches
    │
    ▼
POST /scan               ← Python scanner microservice
    │
    ├── SAST Scanner     ← 15 rules, regex pattern matching, CWE tagging
    ├── Secrets Scanner  ← 17 patterns, Shannon entropy scoring
    ├── SCA Scanner      ← parse manifests → OSV.dev API → CVE lookup
    ├── API Security     ← 5 checks (JWT, CORS, CSRF, validation, rate limit)
    └── Supply Chain     ← typosquatting detection, unpinned deps
    │
    ▼
POST /ai/reason          ← 5-agent AI pipeline
    │
    ├── Agent 1: VulnDetect   (false positive removal, deduplication)
    ├── Agent 2: CodeFlow     (data flow tracing source → sink)
    ├── Agent 3: AttackPath   (multi-step chain building)
    ├── Agent 4: RiskScorer   (contextual risk × business impact)
    └── Agent 5: Explainer    (plain English + exploit steps + diffs)
    │
    ▼
PostgreSQL (Neon)
    │
    ├── SentraFinding         (SAST + API security findings)
    ├── SentraSecretFinding   (secrets and credentials)
    ├── SentraSCAFinding      (vulnerable dependencies)
    ├── SentraAttackPath      (AI-generated attack chains)
    └── SentraAgentRun        (agent timing + token logs)
```

### 3.3 Fix + Verify Pipeline Architecture

```bash
User clicks "Fix + Create PR"
    │
    ▼
fetchFileContent()               ← get original file from GitHub
    │
    ▼
POST /ai/fix                     ← Fix Agent (Groq Llama)
    │   Input: finding + full file content
    │   Output: complete fixed file + patch diff + explanation
    │
    ▼
POST /ai/verify                  ← Verify Agent
    │   Step 1: re-run SAST/Secrets/API scanners on fixed file
    │   Step 2: compare findings before vs after
    │   Step 3: AI confirms resolution + checks regressions
    │   Output: RESOLVED | PARTIAL | UNRESOLVED | REGRESSION
    │
    ▼
createBranch()                   ← GitHub API: create sentra/fix-{id} branch
    │
    ▼
commitFile()                     ← GitHub API: PUT fixed content to branch
    │
    ▼
createPullRequest()              ← GitHub API: PR with full diff + verification result
    │
    ▼
DB: SentraFixVerification        ← status, prUrl, prNumber, verificationNotes
```

### 3.4 CLI Architecture

```bash
Developer Machine
    │
    sentra init          ← authenticate to MOSAIC workspace
    sentra scan          ← local: reads files directly
    sentra findings      ← calls /api/sentra/findings
    sentra explain <id>  ← calls /ai/explain-single
    sentra fix <id>      ← calls /api/sentra/fix (triggers full pipeline)
    sentra verify <id>   ← polls SentraFixVerification table
    sentra attack-paths  ← calls /api/sentra/attack-paths
    sentra history       ← calls /api/sentra/repos/{id}/commits
    │
    ▼
config (~/.config/sentra-cli/config.json)
    ├── apiUrl:      https://your-mosaic.vercel.app
    ├── apiKey:      sentra_xxxxxxxxxxxxxxxxxxxx
    ├── workspaceId: clxxxxxxxxxxxxx
    └── email:       user@example.com
```

---

## 4. Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | Next.js 16 (App Router, Turbopack) | Dashboard, API routes |
| **UI** | shadcn/ui + Tailwind CSS v4 | Component library |
| **Auth** | Clerk | Authentication + workspace RBAC |
| **Database** | Prisma 7 + Neon PostgreSQL | All persistent data |
| **Scanner service** | Python 3.11 + FastAPI + Uvicorn | Multi-layer static analysis |
| **AI inference** | Groq (Llama 3.3 70B Versatile) | All 5 agents + fix + verify |
| **CVE database** | OSV.dev API | Real-time SCA vulnerability lookup |
| **Visualization** | Chart.js (radar), D3.js (force graph) | Attack graph, OWASP radar |
| **CLI** | Node.js + TypeScript + Commander.js | Developer terminal tool |
| **GitHub integration** | GitHub REST API v3 | Repo info, files, commits, PRs |
| **Storage** | Supabase Storage | Video/file uploads (MOSAIC-wide) |
| **Deployment** | Vercel (Next.js) + Render (Python) | Free-tier production |

---

## 5. Database Schema

### Core Models

```prisma
model SentraRepo {
  id            String      @id @default(cuid())
  githubUrl     String
  owner         String
  repoName      String
  fullName      String      // "owner/repo"
  description   String?
  isPrivate     Boolean
  defaultBranch String
  language      String?
  languages     Json?       // { "TypeScript": 60000, "Python": 40000 }
  riskScore     String?     // "A+", "B", "C", "D", "F"
  scanStatus    ScanStatus  // PENDING | SCANNING | COMPLETED | FAILED
  lastScanAt    DateTime?
  workspaceId   String
}

model SentraScan {
  id            String     @id @default(cuid())
  status        ScanStatus
  triggeredBy   String     // "manual" | "push" | "nightly" | "cli"
  filesScanned  Int
  findingsCount Int
  duration      Int?       // seconds
  repoId        String
}

model SentraFinding {
  id          String          @id @default(cuid())
  severity    FindingSeverity // CRITICAL | WARNING | INFO
  title       String
  description String
  filePath    String
  lineNumber  Int?
  cwe         String?         // "CWE-89", "CWE-79" etc
  rule        String?
  snippet     String?
  diffBefore  String?
  diffAfter   String?
  fix         String?
  status      FindingStatus   // OPEN | IN_REVIEW | FIXED | IGNORED
  repoId      String
  scanId      String
  fix         SentraFixVerification?
}

model SentraSecretFinding {
  id          String
  secretType  String  // "API_KEY" | "TOKEN" | "PRIVATE_KEY" | "CONNECTION_STRING"
  filePath    String
  lineNumber  Int?
  entropy     Float?
  snippet     String? // redacted — first/last 4 chars only
  severity    FindingSeverity
  status      FindingStatus
}

model SentraSCAFinding {
  id              String
  packageName     String
  packageVersion  String
  ecosystem       String  // "npm" | "pypi" | "maven" | "go"
  vulnerabilityId String? // "CVE-2024-XXXX" or "GHSA-xxx"
  severity        FindingSeverity
  fixedVersion    String?
  manifestFile    String
  isDirect        Boolean
}

model SentraAttackPath {
  id             String
  title          String
  description    String
  severity       AttackPathSeverity // CRITICAL | HIGH | MEDIUM | LOW
  steps          Json               // [{stepNumber, file, line, action, description}]
  affectedFiles  Json               // string[]
  cvssScore      Float?
  exploitability String?
  businessImpact String?
  remediation    String?
  repoId         String
  scanId         String
}

model SentraFixVerification {
  id                 String
  status             FixStatus // PENDING | GENERATED | PR_CREATED | VERIFIED | FAILED
  originalCode       String?
  fixedCode          String?
  patchDiff          String?
  prUrl              String?
  prNumber           Int?
  branchName         String?
  verificationStatus String?  // "RESOLVED" | "UNRESOLVED" | "REGRESSION" | "PARTIAL"
  verificationNotes  String?
  reScanFindingCount Int
  findingId          String   @unique
}

model SentraAgentRun {
  id           String
  agentType    String   // "VulnDetect" | "CodeFlow" | "AttackPath" | "RiskScorer" | "Explainer"
  inputTokens  Int
  outputTokens Int
  durationMs   Int
  findingsIn   Int
  findingsOut  Int
  scanId       String
}

model SentraCommit {
  id           String
  sha          String
  message      String
  authorName   String
  authorEmail  String
  additions    Int
  deletions    Int
  filesChanged Int
  committedAt  DateTime
  repoId       String
}

model SentraSettings {
  scanOnPush      Boolean
  nightlyScan     Boolean
  autoFixLowRisk  Boolean
  emailAlerts     Boolean
  slackAlerts     Boolean
  alertEmail      String?
  slackWebhookUrl String?
  githubToken     String?  // encrypted AES-256-GCM
  workspaceId     String   @unique
}
```

---

## 6. Scanner Microservice

### Location: `sentra-scanner/` (Python FastAPI, port 8001)

### File Structure

```bash
sentra-scanner/
├── main.py                  ← FastAPI app, /scan, /ai/reason, /ai/fix, /ai/verify
├── requirements.txt
├── scanners/
│   ├── sast.py              ← 15 SAST rules, regex pattern matching
│   ├── secrets.py           ← 17 secret patterns, Shannon entropy
│   ├── sca.py               ← manifest parsing + OSV.dev API
│   ├── api_security.py      ← 5 API security checks
│   └── supply_chain.py      ← typosquatting + unpinned deps
├── agents/
│   ├── orchestrator.py      ← sequences all 5 agents
│   ├── vuln_detect.py       ← Agent 1
│   ├── code_flow.py         ← Agent 2
│   ├── attack_path.py       ← Agent 3
│   ├── risk_scorer.py       ← Agent 4
│   ├── explainer.py         ← Agent 5
│   ├── fix_agent.py         ← generates complete file fix
│   └── verify_agent.py      ← confirms fix + regression check
├── utils/
│   ├── file_utils.py        ← extension detection, entropy, redaction
│   └── ast_parser.py
└── rules/
    ├── sast_rules.json      ← 15 SAST rules with CWE + OWASP mapping
    ├── secret_patterns.json ← 17 secret patterns with entropy thresholds
    └── owasp_rules.json     ← per-category OWASP A01–A09 checks
```

### SAST Rules Implemented (15 rules)

| Rule ID | Title | CWE | OWASP | Severity |
| --- | --- | --- | --- | --- |
| sql-injection-string-concat | SQL Injection via string concatenation | CWE-89 | A03:2021 | CRITICAL |
| xss-innerhtml | XSS via innerHTML | CWE-79 | A03:2021 | CRITICAL |
| command-injection | Command Injection | CWE-78 | A03:2021 | CRITICAL |
| path-traversal | Path Traversal | CWE-22 | A01:2021 | CRITICAL |
| insecure-deserialization | Insecure Deserialization (pickle, yaml.load) | CWE-502 | A08:2021 | CRITICAL |
| hardcoded-password | Hardcoded Password | CWE-798 | A07:2021 | CRITICAL |
| jwt-none-algorithm | JWT None Algorithm | CWE-347 | A02:2021 | CRITICAL |
| ssrf | Server-Side Request Forgery | CWE-918 | A10:2021 | CRITICAL |
| xxe | XML External Entity | CWE-611 | A05:2021 | CRITICAL |
| nosql-injection | NoSQL Injection | CWE-943 | A03:2021 | CRITICAL |
| weak-crypto | Weak Cryptographic Algorithm (MD5, SHA1) | CWE-327 | A02:2021 | WARNING |
| cors-wildcard | Permissive CORS Policy | CWE-942 | A05:2021 | WARNING |
| missing-auth-check | Missing Authentication on Route | CWE-306 | A01:2021 | WARNING |
| open-redirect | Open Redirect | CWE-601 | A01:2021 | WARNING |
| rate-limit-missing | Missing Rate Limiting on Auth | CWE-770 | A04:2021 | WARNING |

### Secret Patterns Implemented (17 patterns)

AWS Access Key · AWS Secret Key · GitHub PAT · GitHub OAuth · OpenAI API Key ·
Anthropic API Key · Stripe Secret · Stripe Test · Google API Key · JWT Secret ·
Database Connection String · Private Key (RSA/EC/OPENSSH) · Slack Webhook ·
SendGrid API Key · Twilio API Key · Generic Secret Assignment (entropy-scored) ·
Generic API Key / Token

### SCA — Dependencies Checked

| Ecosystem | Manifest File | Parsed By |
| --- | --- | --- |
| npm | package.json | JSON parse → dependencies + devDependencies |
| PyPI | requirements.txt | Regex line parser |
| Go | go.mod | Module directive parser |
| Maven | pom.xml | (structured) |
| Gems | Gemfile | Line parser |

All packages checked against **OSV.dev API** (`/v1/query`) in real time.

### Shannon Entropy Formula (Secrets Detection)

```bash
H(X) = -Σ p(x) · log₂(p(x))

Where p(x) = frequency of character x in the string

Thresholds:
  Generic secrets:  > 3.8 bits
  API keys:         > 3.5 bits
  Tokens/JWTs:      > 3.5 bits
  Connection strings:> 3.0 bits
  Private keys:     any (pattern match only)
```

---

## 7. Multi-Agent AI Engine

### Agent Pipeline Diagram

```bash
Raw Scanner Findings (SAST + Secrets + SCA + API + Supply Chain)
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Agent 1: VulnDetect                                   │
│  Input:  raw findings + file summaries                 │
│  Output: deduplicated, confidence-scored findings      │
│  Action: removes false positives (test files, mocks),  │
│          merges same-CWE findings per file,            │
│          assigns HIGH/MEDIUM/LOW confidence            │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│  Agent 2: CodeFlow                                     │
│  Input:  enriched findings + file contents (30 lines) │
│  Output: findings with dataFlow field                  │
│  Action: traces user input from source to sink,        │
│          identifies missing sanitisation steps,        │
│          flags multi-file data flows                   │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│  Agent 3: AttackPath                                   │
│  Input:  all CRITICAL/WARNING findings                 │
│  Output: up to 5 attack path objects                   │
│  Action: chains multiple vulns into realistic attacks, │
│          calculates CVSS scores, identifies entry      │
│          points, specifies business impact             │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│  Agent 4: RiskScorer                                   │
│  Input:  findings + repo visibility (public/private)  │
│  Output: findings with riskScore (0-10), priority,    │
│          exploitComplexity, attackSurface, P1/P2/P3   │
│  Action: contextual scoring beyond CVSS:              │
│          considers internet exposure, auth flow,       │
│          data classification, remediation effort       │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│  Agent 5: Explainer                                    │
│  Input:  top 10 findings by risk score                 │
│  Output: findings with whatItIs, whyItMatters,        │
│          howToExploit (numbered steps),                │
│          attackExample, diffBefore, diffAfter,         │
│          fixExplanation, resources                     │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
        Final enriched findings + attack paths
        Sorted by riskScore descending
        Persisted to PostgreSQL
```

### Agent System Prompts Summary

**VulnDetect system prompt:** "You are a senior application security engineer. Remove false positives, merge duplicates, assign confidence scores."

**CodeFlow system prompt:** "You are an expert in data-flow analysis and taint tracking. Trace untrusted user data from entry point to dangerous sink."

**AttackPath system prompt:** "You are a red-team security researcher. Chain multiple vulnerabilities into realistic attack scenarios an adversary would execute."

**RiskScorer system prompt:** "You are a security risk analyst. Score findings contextually — consider internet exposure, auth flows, data classification, blast radius."

**Explainer system prompt:** "You are a security educator. Make complex vulnerabilities understandable to developers. Write clear numbered exploit steps and concrete code diffs."

### Agent Performance Characteristics

| Agent | Input cap | LLM calls | Typical duration | Max tokens out |
| --- | --- | --- | --- | --- |
| VulnDetect | 30 findings | 1 | 8-15s | 3,000 |
| CodeFlow | 8 critical findings | 1 | 10-18s | 3,000 |
| AttackPath | 20 findings | 1 | 12-20s | 3,000 |
| RiskScorer | 15 findings | 1 | 10-16s | 3,000 |
| Explainer | 10 findings | 1 | 15-25s | 4,000 |
| **Total** | | **5** | **55-95s** | **16,000** |

---

## 8. Fix + Verify Pipeline

### Fix Agent

- **Input:** finding object + full original file content (up to 300 lines)
- **Output:** `fixedContent` (complete corrected file), `patchDiff`, `explanation`, `confidence`, `breakingChangeRisk`
- **Prompt strategy:** Send only 200 lines around the vulnerable line as context window + full file truncated to 300 lines. Request entire file back to avoid partial rewrites.
- **Temperature:** 0.05 (near-deterministic for code generation)

### Verify Agent — Two-Stage Verification

**Stage 1: Static re-scan**

```python
# Re-run the same scanners on the fixed file
scanner_findings = []
scanner_findings.extend(scan_file_sast(file_path, fixed_content))
scanner_findings.extend(scan_file_secrets(file_path, fixed_content))
scanner_findings.extend(scan_file_api_security(file_path, fixed_content, lang))

# Compare: did the original rule still fire?
still_present = any(f.ruleId == original_rule for f in scanner_findings)

# What's new vs before?
truly_new = [f for f in new_findings if f.ruleId not in original_finding_ids]
```

**Stage 2: AI semantic verification**

- Sends original + fixed code to Groq Llama
- Checks if fix is semantically correct (not just pattern-match)
- Verifies functionality is preserved
- Returns `RESOLVED | UNRESOLVED | REGRESSION | PARTIAL`

### GitHub PR Creation (3-step)

```bash
1. createBranch()      → POST /repos/{owner}/{repo}/git/refs
                         Creates: "sentra/fix-{findingId-8chars}-{timestamp}"

2. commitFile()        → PUT /repos/{owner}/{repo}/contents/{path}
                         Gets current file SHA, encodes fixed content as base64,
                         commits with message: "fix(security): {title} [SentraCode AI Fix]"

3. createPullRequest() → POST /repos/{owner}/{repo}/pulls
                         Title: "[SentraCode] Fix: {vulnerability title}"
                         Body:  full markdown with finding, patch diff,
                                verification status, SentraCode branding
```

---

## 9. CLI Tool

### Installation

```bash
npm install -g @mosaic/sentra
sentra init
```

### Authentication Flow

```bash
1. User generates CLI token in SentraCode → Settings → "Generate CLI token"
2. Token format: sentra_{48 hex chars}
3. Token stored in AgentKey table as provider: "cli:{workspaceId}"
4. CLI stores token in ~/.config/sentra-cli/config.json
5. Every API call sends: x-sentra-apikey: {token} header
6. API validates token → returns userId + workspaceId
```

### Commands Reference

| Command | Description | Flags |
| --- | --- | --- |
| `sentra init` | Authenticate CLI to MOSAIC workspace | — |
| `sentra status` | Show current auth + workspace | — |
| `sentra scan` | Scan current directory | `--dir`, `--repo`, `--layers`, `--output` |
| `sentra findings` | List security findings | `--severity`, `--status`, `--repo`, `--id`, `--detail` |
| `sentra explain <id>` | AI explanation for one finding | — |
| `sentra fix <id>` | Generate AI fix | `--pr`, `--dry-run` |
| `sentra verify <id>` | Check fix verification status | — |
| `sentra history [repo]` | Commit security timeline | — |
| `sentra attack-paths` | Show AI attack chains | — |

### Local Scan vs Remote Scan

**Local scan** (`sentra scan` in a directory):

- Reads files directly from disk using `collectFiles()`
- Sends to Python scanner microservice at `SENTRA_SCANNER_URL`
- No GitHub token required
- Results printed to terminal (not stored in DB unless `--repo` flag used)

**Remote scan** (`sentra scan --repo https://github.com/...`):

- Connects repo via `/api/sentra/repos`
- Triggers full pipeline via `/api/sentra/scan`
- Results stored in DB and visible in dashboard
- Live progress polling every 4 seconds

---

## 10. Dashboard & Visualizations

### SentraCode Sidebar Navigation

```bash
Monitor
  ├── Overview           → health snapshot, quick scan launcher, SSE progress panel
  ├── Repositories       → connect repos, scan now, real-time status polling
  └── Commit activity    → D3 bar chart, contributor breakdown, language donut

Security
  ├── Vulnerabilities    → filterable table, expand with AI diff, fix + PR buttons
  ├── Pull requests      → live PRs, run AI review, verdict display
  └── Security posture   → OWASP radar chart + category breakdown table

Workspace
  └── Settings           → GitHub token, scan schedule, notifications, CLI token
```

### Real-Time Scan Progress (SSE)

```bash
Client                              Server
  │                                   │
  ├── POST /api/sentra/scan ─────────►│ creates SentraScan + starts runFullScan()
  │◄── { scanId }                     │
  │                                   │
  ├── GET /api/sentra/scan/{id}/status│
  │   (EventSource / SSE)             │
  │◄── data: { status, filesScanned, │ polls DB every 2s
  │            findingsCount,         │ streams progress events
  │            criticals, warnings }  │
  │                                   │
  │◄── data: { status: "COMPLETED" } │ stream closes
```

### Fix + Verify UI Flow

```bash
Expand finding row
  → Click "Generate AI fix"
     → POST /api/sentra/fix → { fixId, status: "PENDING" }
     → Poll GET /api/sentra/fix?findingId={id} every 3s
        → status: PENDING  → "Generating fix…" spinner
        → status: GENERATED → "Verifying fix…" spinner
        → status: VERIFIED  → patch diff + "RESOLVED" green badge
        → status: PR_CREATED→ patch diff + GitHub PR link + "PR created" blue badge
        → status: FAILED    → red error message
```

---

## 11. Security Posture Radar

### OWASP Category to CWE Mapping

```typescript
const CWE_MAP = {
  injection:        ["CWE-89","CWE-78","CWE-943","CWE-611"],
  brokenAuth:       ["CWE-306","CWE-287","CWE-798","CWE-613","CWE-522","CWE-352"],
  cryptography:     ["CWE-327","CWE-326","CWE-347","CWE-916"],
  misconfiguration: ["CWE-942","CWE-770","CWE-16","CWE-601","CWE-20"],
  exposedData:      ["CWE-200","CWE-598","CWE-918","CWE-22"],
  vulnerableDeps:   [], // SCA category — matched by f.category === "SCA"
};
```

### Score Formula

```bash
score(category) = max(0, round(100 - (findingCount / totalFindings) * 100))

Grade thresholds:
  A   ≥ 85   — Safe
  B+  ≥ 70   — Good
  B   ≥ 55   — Acceptable
  C   ≥ 40   — Warning
  D   ≥ 25   — High risk
  F   < 25   — Critical

Overall score = average of all 6 category scores
```

### Radar Chart Implementation

- **Library:** Chart.js 4.4 with radar type
- **6 axes:** Injection, Broken Auth, Cryptography, Misconfiguration, Exposed Data, Vulnerable Deps
- **Dataset 1 (dashed):** safe threshold at 80 across all axes
- **Dataset 2 (pink):** real-time scores from actual findings
- **Tooltips:** category name + score + severity label (Safe/Warning/High/Critical)
- **Score cards:** 6 cards below radar showing grade letter (A-F) + score/100 + finding count

---

## 12. API Reference

### Base URL: `/api/sentra`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/repos?workspaceId=` | List connected repos with finding counts |
| POST | `/repos` | Connect a GitHub repository |
| DELETE | `/repos/{repoId}` | Disconnect a repository |
| GET | `/repos/{repoId}` | Single repo with findings + commits |
| GET | `/repos/{repoId}/stats` | Contributor stats, daily activity, streak |
| GET | `/repos/{repoId}/commits` | Commit history (refresh=true fetches from GitHub) |
| POST | `/scan` | Trigger full scan (returns scanId immediately) |
| GET | `/scan/{scanId}/status` | SSE stream for real-time scan progress |
| GET | `/findings?workspaceId=&severity=&status=` | List findings with filters |
| PATCH | `/findings` | Update finding status |
| POST | `/fix` | Trigger fix generation + optional PR creation |
| GET | `/fix?findingId=` | Poll fix status |
| GET | `/attack-paths?workspaceId=` | List AI attack chains |
| GET | `/attack-paths/graph?workspaceId=` | Graph nodes + edges for D3 |
| GET | `/pr-review?workspaceId=` | List open PRs |
| POST | `/pr-review` | Run AI review on a specific PR |
| GET | `/settings?workspaceId=` | Get workspace scan settings |
| PATCH | `/settings` | Update settings |
| POST | `/cli/auth` | Generate CLI token |
| GET | `/cli/auth` | Validate CLI token |
| GET | `/report?workspaceId=&format=html | json` | Download security report |

### Scanner Service API (port 8001)

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Service health check |
| POST | `/scan` | Run all scan layers on file list |
| POST | `/scan/file` | Scan a single file |
| POST | `/scan/manifest` | Parse + check a dependency manifest |
| POST | `/ai/reason` | Run 5-agent pipeline on raw findings |
| POST | `/ai/fix` | Generate complete file fix |
| POST | `/ai/verify` | Verify fix resolves vulnerability |
| POST | `/ai/explain-single` | Explain one finding (used by CLI) |

---

## 13. Architecture Diagram Prompts

*Use these prompts in ChatGPT or Midjourney to generate professional architecture images.*

---

### Prompt 1: High-Level System Overview Diagram

```bash
Create a professional software architecture diagram with a dark background (#0a0a0a).
Title: "SentraCode — AI Application Security Platform"

Show three horizontal tiers:

TIER 1 — "Developer Layer" (top):
- Browser icon labeled "MOSAIC Dashboard (Next.js 16)" with violet (#7C3AED) border
- Terminal icon labeled "sentra CLI (Node.js + TypeScript)" with violet border
- Connect both with arrows pointing down labeled "HTTPS + CLI Token"

TIER 2 — "Application Layer" (middle):
- Large rectangle labeled "Next.js API Routes (/api/sentra/*)"
- Inside it show 6 small boxes: repos | scan | findings | fix | attack-paths | report
- Border: violet (#7C3AED), background: dark navy

TIER 3 — "Infrastructure Layer" (bottom):
Three boxes side by side:
- Box 1 (blue border): "Python FastAPI\nScanner Microservice\nPort 8001 (Render)"
- Box 2 (green border): "Groq API\nLlama 3.3 70B\n5-Agent Pipeline"
- Box 3 (purple border): "Neon PostgreSQL\nPrisma 7\n14 models"

Connect Tier 2 → Tier 3 with labeled arrows:
- "POST /scan (file contents)"
- "POST /ai/reason (findings)"
- "SQL via Prisma"

Top-right corner: GitHub API logo labeled "GitHub REST API v3"
Arrow from Application Layer → GitHub API: "fetchRepo, fetchFiles, createPR"

Color scheme: dark background, violet primary (#7C3AED), clean modern SaaS style
Style: Figma/Notion-style flat diagram, no gradients except on arrows
```

---

### Prompt 2: Five-Layer Scanner Architecture

```bash
Create a detailed flow diagram on a dark (#0d0d0d) background.
Title: "SentraCode Multi-Layer Scanner Pipeline"

Show a GitHub repository icon on the left labeled "GitHub Repository"

Five parallel horizontal lanes flowing left to right, each with its own color:

Lane 1 (Red #EF4444): "SAST Scanner"
- Steps: "15 regex rules" → "CWE tagging" → "OWASP mapping" → "Finding objects"

Lane 2 (Orange #F97316): "Secrets Detection"
- Steps: "17 patterns" → "Shannon entropy H(x)" → "False positive filter" → "Redacted findings"

Lane 3 (Blue #3B82F6): "SCA — Dependencies"
- Steps: "Parse manifests" → "Extract packages" → "OSV.dev API query" → "CVE findings"

Lane 4 (Yellow #EAB308): "API Security"
- Steps: "5 checks" → "JWT/CORS/CSRF/Rate limit" → "Endpoint findings"

Lane 5 (Purple #8B5CF6): "Supply Chain"
- Steps: "Typosquat detection" → "Unpinned deps" → "Risk findings"

All 5 lanes merge into a funnel shape labeled "Aggregated findings"

Then a large box below labeled "5-Agent AI Reasoning Engine" containing:
VulnDetect → CodeFlow → AttackPath → RiskScorer → Explainer
(shown as a sequential pipeline with connecting arrows)

Output at the bottom: "Enriched findings + Attack paths → PostgreSQL"

Style: dark background, each lane has distinct left-border color, clean boxes with rounded corners, professional SaaS diagram look
```

---

### Prompt 3: Multi-Agent AI Pipeline Diagram

```bash
Create a sequential agent pipeline diagram on dark background (#0a0a0a).
Title: "SentraCode Multi-Agent AI Reasoning Engine"
Subtitle: "Powered by Groq Llama 3.3 70B Versatile"

Show 5 large rectangular agent cards in a horizontal sequence connected by thick arrows:

Card 1 — "Agent 1: VulnDetect" (border: #6366F1)
- Icon: shield with checkmark
- Inputs: "Raw findings (up to 30)" + "File summaries"
- Process: "Remove false positives\nMerge duplicates\nAssign confidence scores"
- Output: "Verified findings with HIGH/MEDIUM/LOW confidence"

→ Arrow labeled "verified findings"

Card 2 — "Agent 2: CodeFlow" (border: #3B82F6)
- Icon: flow chart arrows
- Inputs: "Enriched findings" + "File contents (30 lines each)"
- Process: "Source → Sink tracing\nData flow analysis\nSanitisation check"
- Output: "Findings + dataFlow field"

→ Arrow labeled "findings + flow data"

Card 3 — "Agent 3: AttackPath" (border: #EF4444)
- Icon: attack chain links
- Inputs: "All CRITICAL/WARNING findings"
- Process: "Chain multiple vulns\nBuild attack scenarios\nCVSS scoring"
- Output: "Up to 5 attack path objects"

→ Arrow labeled "findings + attack paths"

Card 4 — "Agent 4: RiskScorer" (border: #F59E0B)
- Icon: gauge/meter
- Inputs: "Findings" + "Repo visibility"
- Process: "Contextual scoring\nBusiness impact\nExploit complexity"
- Output: "Risk score 0-10 per finding + P1/P2/P3"

→ Arrow labeled "risk-scored findings"

Card 5 — "Agent 5: Explainer" (border: #10B981)
- Icon: document with magnifier
- Inputs: "Top 10 by risk score"
- Process: "Plain English explanation\nNumbered exploit steps\nCode diffs"
- Output: "Final enriched findings"

At the bottom: a cylinder labeled "PostgreSQL" with arrows from both "attack paths" and "final findings"

Total timing banner at the top: "Full pipeline: 55–95 seconds · 5 Groq API calls · ~16,000 tokens output"

Style: professional Figma-style, rounded cards, monospace code font for inputs/outputs
```

---

### Prompt 4: Fix + Verify Pipeline Diagram

```bash
Create a vertical flow diagram on dark background (#0d0d0d).
Title: "SentraCode AI Fix + Verify Pipeline"

Show these nodes connected vertically with arrows:

Node 1 (red border): "Security Finding (OPEN)"
- CWE-89 SQL Injection · auth/login.py:42

↓ "fetchFileContent()"

Node 2 (blue border): "Original File Content"
- "Full 250-line Python file"

↓ "POST /ai/fix"

Node 3 (violet border, larger): "Fix Agent (Groq Llama 3.3 70B)"
- Left side: "Input: finding metadata + vulnerable code context (200 lines)"
- Center: brain/AI icon
- Right side: "Output: complete fixed file + patch diff + confidence level"
- Temperature badge: "T=0.05 (near-deterministic)"

↓ "POST /ai/verify"

Node 4 (yellow border, larger): "Verify Agent — Two-Stage"
- Stage 1 box: "Static Re-scan: SAST + Secrets + API Security on fixed file"
- Stage 2 box: "AI Semantic Check: did fix work? any regressions?"
- Output badge options (show all 4):
  ✓ RESOLVED (green)  ⚠ PARTIAL (amber)  ✗ UNRESOLVED (red)  ⚠ REGRESSION (orange)

↓ "If RESOLVED → createBranch() → commitFile() → createPullRequest()"

Node 5 (green border): "GitHub Pull Request"
- Branch: "sentra/fix-abc12345-1234567890"
- Title: "[SentraCode] Fix: SQL Injection via string concatenation"
- Shows mini PR body with patch diff

↓

Node 6 (teal border): "DB: SentraFixVerification"
- "status: PR_CREATED"
- "prUrl: github.com/..."
- "verificationStatus: RESOLVED"
- "reScanFindingCount: 0"

Style: dark background, clean vertical flow, color-coded stages, badges and small code snippets
```

---

### Prompt 5: OWASP Radar Chart Architecture

```bash
Create an infographic explaining the SentraCode OWASP Security Radar.

Left half: A large radar/spider chart with 6 axes:
- Injection (OWASP A03)
- Broken Auth (OWASP A07)
- Cryptography (OWASP A02)
- Misconfiguration (OWASP A05)
- Exposed Data (OWASP A02)
- Vulnerable Deps (OWASP A06)

Show two overlapping polygons:
- Dashed gray hexagon at 80% (labeled "Safe threshold")
- Solid pink (#e87ba4) irregular polygon (labeled "Your security posture")

Each axis vertex has a small circle dot in pink.

Right half: Show the scoring formula:
"score(category) = max(0, 100 - (findings / total) * 100)"

Below that show 6 horizontal bar rows (one per category) with:
- Category name + OWASP code
- Colored progress bar (green >80, yellow 55-80, orange 40-55, red <40)
- Grade letter (A, B+, B, C, D, F) in large bold
- Finding count

Bottom: Grade table
A ≥ 85 · B+ ≥ 70 · B ≥ 55 · C ≥ 40 · D ≥ 25 · F < 25

Style: dark background (#0a0a0a), pink radar, professional dashboard aesthetic
```

---

### Prompt 6: CLI Architecture Diagram

```bash
Create a developer workflow diagram on dark background.
Title: "sentra CLI — Local Security Scanning"

Left side: Show a laptop/terminal icon with 8 CLI commands listed:
sentra init
sentra scan [--dir / --repo]
sentra findings [--severity CRITICAL]
sentra explain <id>
sentra fix <id> [--pr]
sentra verify <id>
sentra attack-paths
sentra history

Center: Show two separate flow paths branching from "sentra scan":

Path A — "Local scan (no GitHub token needed)":
Terminal → File collector (reads .py .js .ts .go files) →
POST /scan (Python scanner at localhost:8001) →
Results printed to terminal table

Path B — "Remote scan (GitHub URL)":
Terminal → POST /api/sentra/repos (connect repo) →
POST /api/sentra/scan (trigger pipeline) →
SSE polling every 4s →
Table printed when complete

Bottom: Config box
~/.config/sentra-cli/config.json
{
  apiUrl:      "https://your-app.vercel.app",
  apiKey:      "sentra_48hexchars",
  workspaceId: "clxxxxxxxxxxx",
  email:       "user@example.com"
}

Right side: Token generation flow
MOSAIC Dashboard → SentraCode Settings →
"Generate CLI token" button →
POST /api/sentra/cli/auth →
Returns: sentra_{48 hex chars} →
Store in Conf → Use in x-sentra-apikey header

Style: dark terminal aesthetic, green monospace text for CLI commands, clean boxes
```

---

### Prompt 7: Complete End-to-End Data Flow

```bash
Create a comprehensive end-to-end data flow diagram for SentraCode.
Title: "SentraCode — Complete Data Flow"

Show 6 vertical swim lanes:

Lane 1 "Developer": 
- Pushes code to GitHub
- Opens dashboard
- Clicks "Scan now"

Lane 2 "Next.js API":
- Receives POST /api/sentra/scan
- Calls fetchRepoTree()
- Calls fetchFileContent() in batches of 5
- Starts runFullScan() background task

Lane 3 "Python Scanner":
- Receives POST /scan with file contents
- Runs 5 layers in parallel
- Returns findings JSON

Lane 4 "AI Agents (Groq)":
- VulnDetect (8-15s)
- CodeFlow (10-18s)
- AttackPath (12-20s)
- RiskScorer (10-16s)
- Explainer (15-25s)

Lane 5 "PostgreSQL":
- SentraFinding rows inserted
- SentraAttackPath rows inserted
- SentraAgentRun timing logged
- SentraScan status: COMPLETED

Lane 6 "Dashboard":
- SSE stream shows progress
- Vulnerabilities page updates
- Security radar recomputes
- Attack paths visible

Show timing markers at right:
- T+0s: Scan triggered
- T+30s: Files fetched
- T+60s: Scanner complete
- T+120s: AI pipeline complete
- T+125s: Dashboard updates

Style: professional swimlane diagram, dark background, colored lane headers
```

---

## 14. Research Contributions

### Novel Contributions (IEEE-publishable)

#### Contribution 1: Multi-Layer Parallel Security Analysis

*No existing tool combines SAST + Secrets + SCA + API Security + Supply Chain in a single unified scan pipeline with correlated findings.*

#### Contribution 2: Sequential Multi-Agent AI Security Reasoning

*First system to apply a 5-agent sequential pipeline (VulnDetect → CodeFlow → AttackPath → RiskScorer → Explainer) where each agent refines the previous agent's output for security analysis.*

#### Contribution 3: Repository-Level Attack Path Construction

*Existing tools flag vulnerabilities in isolation. SentraCode's AttackPath agent chains multiple vulnerabilities across files into complete attack scenarios with CVSS scoring — without human input.*

#### Contribution 4: Automated Fix Generation + Verification Loop

*First platform combining AI-generated complete file patches → static re-scan verification → semantic AI confirmation → automatic GitHub PR creation in a single automated pipeline.*

#### Contribution 5: OWASP-Mapped Real-Time Security Radar

*Formal mapping of scanner findings to OWASP Top 10 categories via CWE taxonomy, with a live radar chart score computed from actual findings using the formula:*

```bash
score(c) = max(0, round(100 - (|F_c| / |F_total|) × 100))
```

*where F_c is the set of findings in OWASP category c.*

### Suggested Paper Title

> **SentraCode: A Multi-Agent AI Framework for Automated Repository-Level Security Analysis, Attack Path Construction, and Verified Remediation**

### Target Venues

- IEEE Symposium on Security and Privacy (S&P)
- IEEE International Conference on Software Engineering (ICSE)
- IEEE Big Data Conference
- USENIX Security Symposium

---

## 15. End-to-End Workflow

### Complete walkthrough from zero to secured codebase

```bash
Step 1 — SETUP
  • Open MOSAIC dashboard → SentraCode → Settings
  • Add GitHub Personal Access Token (repo scope)
  • Generate CLI token → copy it
  • Run: sentra init → paste dashboard URL + token

Step 2 — CONNECT
  • Go to Repositories → "Add repository"
  • Paste: https://github.com/your-org/your-repo
  • Dashboard fetches repo metadata from GitHub API
  • Repo appears in list with "Pending" scan status

Step 3 — SCAN
  • Click "Scan now" on the repo
  • Scan progress panel opens with SSE real-time updates
  • Watch: Files collected → SAST → Secrets → SCA → API Security → Supply Chain
  • AI agents run: VulnDetect → CodeFlow → AttackPath → RiskScorer → Explainer
  • Total time: 60-120 seconds depending on repo size

Step 4 — REVIEW
  • Vulnerabilities page: filterable table of all findings
  • Each finding expandable: description, how to exploit, AI code diff
  • Security posture page: OWASP radar shows weakest categories
  • Attack paths section: multi-step chains with CVSS scores

Step 5 — FIX
  • Click "Fix + Create PR" on any critical finding
  • Fix agent generates complete corrected file
  • Verify agent confirms vulnerability resolved
  • GitHub PR created automatically
  • PR link appears in dashboard and CLI

Step 6 — VERIFY
  • Run: sentra verify <finding-id>
  • Or check PR in GitHub — full verification report in PR description
  • Re-scan after merging to confirm finding count drops

Step 7 — REPORT
  • Security posture page → "Export HTML report"
  • Full report includes: executive summary, OWASP breakdown,
    all findings with diffs, attack chains, vulnerable deps, secrets

Step 8 — MONITOR
  • Commit activity page tracks security posture over time
  • Settings → enable "Scan on every push" for continuous monitoring
  • CLI integration: add `sentra scan` to CI/CD pipeline
```

---

## Environment Variables

```bash
# Next.js (.env.local)
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
GROQ_API_KEY="gsk_..."
ENCRYPTION_SECRET="32-char-minimum-secret-key-here"
SENTRA_SCANNER_URL="http://localhost:8001"
APP_URL="http://localhost:3000"
GITHUB_TOKEN=""  # optional — users provide their own in settings

# Python scanner (sentra-scanner/.env)
GROQ_API_KEY="gsk_..."
```

---

## Deployment

### Next.js → Vercel

```bash
vercel deploy --prod
# Set all env vars in Vercel dashboard
```

### Python Scanner → Render

```yaml
# render.yaml
services:
  - type: web
    name: sentra-scanner
    runtime: python
    rootDir: sentra-scanner
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GROQ_API_KEY
        sync: false
```

Update `SENTRA_SCANNER_URL` in Vercel to the Render service URL.

---

*Generated by MOSAIC Platform · SentraCode v2.0.0 · ARK Groups*  
*Documentation version: September 2026*

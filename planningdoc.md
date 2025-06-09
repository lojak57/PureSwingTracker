# Pure – MVP Planning Document (v0.2)

*Prepared for Cursor implementation hand-off*

---

## 1. Executive Summary
Pure is a mobile-first golf‐swing improvement platform. Users record **three video angles** for each swing (down-the-line, face-on, overhead). The app classifies the swing into one of five **club categories** (Woods, Irons, Wedges, Chipping, Putting) and returns AI-generated feedback plus drill recommendations via a conversational UI.

**MVP Objective:** deliver accurate swing analysis, personalized drill suggestions, and basic progress tracking for paying beta users (target: exec golfers in Trent/Kevin network) within 6–8 weeks.

---

## 2. Functional Requirements
1. **User Auth & Profile**
   - Email/OAuth login  
   - Handicap & swing goals fields  
2. **Swing Capture Workflow**
   - Category picker → 3-angle capture enforcement → upload  
   - Retry & discard flows  
3. **AI Processing**
   - Pose extraction (server-side)  
   - Flaw detection JSON (see §6)  
   - GPT-driven narrative feedback  
4. **Chatbot Delivery**
   - Persona-based chat (Coach Sarah default)  
   - Feedback + 1–3 tailored drills  
5. **Drill Library & Tracker**
   - CRUD drills table  
   - Add-to-practice list  
   - Completion checkbox + notes  
6. **History / Progress**
   - Swing timeline  
   - Basic stats: flaws frequency, drill adherence  
7. **Admin Dashboard (internal)**
   - User list, swing list, AI logs, drill CMS  

---

## 3. Non-Functional Requirements
- Sub-5 s chat response latency (average)  
- ≤500 MB per swing session storage (3 clips, compressed)  
- GDPR-like data export/delete compliance  
- 99.5 % API uptime (Cloudflare monitor)  

---

## 4. Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | SvelteKit + Tailwind | Consistent with TrueForm stack |
| **Mobile wrapper** | Capacitor (optional) | Ship to iOS/Android PWA quickly |
| **Auth** | Supabase Auth | Fast, social login ready |
| **Storage** | Cloudflare R2 (S3-compatible) | Cheap, global, can self-host later |
| **DB** | Postgres (Supabase) | JSONB for AI output |
| **Backend Runtime** | Supabase Edge Functions (TypeScript) **plus** Dedicated Node service on VPS for heavy AI | Cheap scalar for light tasks; own box for pose inference |
| **AI** | • **Pose**: MediaPipe BlazePose via Python container  <br/>• **LLM**: OpenAI GPT-4o (text)  <br/>• Future-proof to local model swap |
| **Queues** | Supabase Realtime / or Upstash Redis | Async processing |
| **CI/CD** | GitHub → Vercel (FE) / Fly.io (Node) / Supabase CLI | Zero-downtime deploys |

---

## 5. Data Model (ERD-style summary)
```sql
users
  id PK
  email
  name
  handicap
  goals jsonb

swings
  id PK
  user_id FK→users
  category ENUM('wood','iron','wedge','chip','putt')
  created_at
  video_urls jsonb  -- { down_line, face_on, overhead }
  ai_pose jsonb      -- raw keypoints
  ai_flaws jsonb     -- structured flaws (see §6)
  ai_summary text    -- GPT narrative

drills
  id PK
  title
  description
  tags text[]
  video demo_url

practice_logs
  id PK
  user_id FK
  drill_id FK
  completed_at
  notes text
```

---

## 6. AI Output Contract
```json
{
  "club_category": "iron",
  "primary_flaws": [
    { "code": "over_the_top", "severity": 3 },
    { "code": "early_extension", "severity": 2 }
  ],
  "recommendations": ["split_hand_takeaway", "slow_motion_transition"],
  "swing_score": 72
}
```
Flaw codes & drill IDs look-up tables maintained in DB.

---

## 7. API Endpoints (REST-ish)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/swing/presign` | ✅ | returns 3 pre-signed PUT URLs |
| POST | `/v1/swing/submit` | ✅ | body: metadata + URLs → enqueue processing |
| GET | `/v1/swing/{id}` | ✅ | returns analysis & drill recs |
| GET | `/v1/drills` | ✅ | list catalog |
| POST | `/v1/practice` | ✅ | log drill completion |
| GET | `/v1/chat/{swing_id}` | ✅ | stream GPT feedback |
| GET | `/admin/logs` | 🔒 | dev use |

Processing queue listener triggers pose → flaw detection → GPT summary → DB update.

---

## 8. Prompt Engineering (v0)
System prompt (GPT-4o):

```text
You are Coach Sarah, a friendly scratch golfer and instructor.
Given JSON {flaws, category, user_history_snip}, craft a 3-paragraph feedback:
 1. Empathy & highlight strength
 2. Explain top flaw(s) and why they matter, with simple physics
 3. Recommend drills by ID; 1 sentence each; upbeat tone.
Return JSON with `narrative` string.
```

---

## 9. DevOps / Deployment
FE → Vercel preview & prod envs.

Supabase dev → prod projects (with seed script).

VPS (Hetzner) running Docker Compose:
- pose-service (Python FastAPI + CUDA)
- redis
- log shipper (Vector → Loki)

CI: GitHub Actions
Lint/Test → deploy Supabase migrations → redeploy FE/BE → notify Slack.

---

## 10. Testing Strategy
- **Unit:** jest (backend utils)
- **Integration:** Postman collection with mock S3
- **E2E:** Playwright simulating multi-angle upload
- **Beta:** 3 exec golfers + 2 local amateurs

---

## 11. Milestones & Rough Hours (Owner-Operator Mode)
| Week | Deliverable | Est. Hrs |
|------|-------------|----------|
| 1 | Repo init, auth, DB schema, presigned uploads | 10 |
| 2 | Pose docker, swing process, store outputs | 12 |
| 3 | GPT prompt tuning, chat UI, drill CMS | 14 |
| 4 | Practice log, history view, polish | 10 |
| 5 | Beta test & bug fix | 8 |
| **Total** | | **~54 hrs** |

---

## 12. Open Questions
- Any licensing issues with swing drill content videos?
- GPU requirements for pose inference volume?
- Preferred caching layer for chat context (Redis vs DB)?
- Legal wording for liability (golf injuries)?

---

## 13. Environment & Secrets
ENV files managed per environment (.env.dev, .env.prod) and injected via Supabase CLI & GitHub Actions secrets.

Keys required: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY, POSE_SERVICE_URL, REDIS_URL, R2_ACCESS_KEY, R2_SECRET_KEY, JWT_SECRET.

Rotated every 90 days via GitHub Action.

---

## 14. Observability & Monitoring
| Layer | Tool | Alert Threshold |
|-------|------|----------------|
| FE | Vercel Analytics | 500 ms TTFB median |
| API | Uptime Kuma → Slack | >1 error per minute (5 min window) |
| Pose Service | Prometheus → Grafana | GPU util >90 % for 15 min |
| Logs | Loki + Grafana | Error rate spike 3× normal |

---

## 15. Security & Compliance
- JWT for all auth—10 min access, 7 day refresh.
- RBAC: roles user, admin enforced via Postgres policies.
- CORS locked to app domains.
- Rate limit: 60 requests/min IP via Edge Function middleware.
- Data retention: raw videos auto-purged after 90 days unless user opts to save.
- PII review complete—no biometrics stored beyond keypoints.

---

## 16. API Error Conventions
```json
{
  "error": {
    "code": "UPLOAD_TOO_LARGE",
    "message": "Max individual file size is 200 MB."
  }
}
```
All 4XX/5XX codes enumerated in /docs/errors.md (to be generated).

---

## 17. Cost & Scaling Estimates (MVP)
| Resource | Monthly (est.) |
|----------|---------------|
| Cloudflare R2 (500 GB) | $7.50 |
| Supabase Pro | $25 |
| Hetzner GPU Box (1× A4000) | $160 |
| OpenAI (1 k swings/mo) | $80 |
| Misc (Redis, monitoring) | $20 |
| **Total** | **≈ $293/mo** |

---

## 18. Expansion Hooks
- Multi-angle auto-sync using Apple Vision Pro spatial video in v2.
- Coach portal for manual feedback overlay (revenue share model).
- Leaderboard + social once swing-score stable.

---

## 19. Codebase Governance & Contribution Guidelines
*"We build like we'll be called back." Every line of code must remain understandable, testable, and reversible.*

### 19.1 Branching & PR Flow
| Name | Rule |
|------|------|
| `main` | **Always deploy-ready.** No direct commits. |
| `feat/<scope>` | Feature branches; squash-merge via PR. |
| `hotfix/<ticket>` | Critical prod patches; tag release on merge. |
| `doc/<topic>` | Docs-only changes. |

**PR Template**  
1. *Goal* (one sentence)  
2. *Ticket / ADR link*  
3. *Checklist:* `pnpm test`, `pnpm lint`, Lighthouse ≥ 90, DB migration run  
4. *Screenshots / Postman run*  
5. *AI prompt used (if any)* <!-- keeps agent lineage -->

> **CI blocks merge** if tests <95 % pass, coverage <80 %, or ESLint errors.

---

### 19.2 Folder & File Size Limits
| Path | Max LOC | Notes |
|------|---------|-------|
| `src/routes/+page.svelte` | 200 | Must import sectional components. |
| `src/components/ui/*` | 150 | UI primitives only—no business logic. |
| `src/services/*` | 300 | 1 service ≈ 1 domain (auth, swing, drill). |
| `pose-service` | 400 | Python only: pose extraction. |

> Files exceeding limit fail `pnpm lint:boundaries`.

---

### 19.3 Style & Static Rules
- **Formatter:** Prettier (opinionated)  
- **Lint:** ESLint + `plugin:security/recommended`  
- **Type Safety:** `strictNullChecks` ON, no `any` in `/src`  
- **Import Order:** enforced via `eslint-plugin-import`  
- **Secrets:** `.env.*` files in Git-ignored `infra/env/` only

---

### 19.4 ADR (Architecture Decision Record) Policy
*One ADR per decision that changes architecture or third-party selection.*

Filename: `docs/adr/ADR-<###>-<slug>.md`  
Sections: Context | Decision | Status | Consequences.

**No code merged** until ADR is reviewed and merged with PR.

---

### 19.5 AI-Generated Code Guidelines
1. **Prompt Traceability** – paste the prompt (or summary) in PR description.  
2. **Chunk Size** – AI scaffolds ≤200 LOC per PR.  
3. **Human In Loop** – every AI PR requires a manual review sign-off (no auto-merge).  
4. **Security Scan** – run `pnpm audit` and `eslint-security` before requesting review.  
5. **No Schema Drift** – AI must call `npm run db:check` (fails CI if migration drift).  
6. **Agent Boundaries** – AI can *only* write inside `/services/` and `/components/` unless ADR says otherwise.

---

### 19.6 Testing & Coverage
| Layer | Framework | Minimum |
|-------|-----------|---------|
| Unit (JS/TS) | Vitest | 80 % lines |
| Component | @testing-library/svelte | Critical UI states |
| Integration | Postman/Newman | All public endpoints |
| E2E | Playwright | Upload → feedback → drill flow |

Coverage report gates merges (`pnpm coverage`).

---

### 19.7 Semantic Versioning & Releases
- **`v0.x.y`** while pre-revenue.  
- Merge into `main` with `chore(release): v0.x.y` commit auto-tags and triggers:  
  1. Vercel prod deploy  
  2. Supabase migration  
  3. Docker image push for pose-service  
  4. Slack "🚀 Deployed" notification

---

### 19.8 Dependency & Security Hygiene
- Weekly **Dependabot** run; no more than 1 major bump per week.  
- **Snyk** scan in CI; fails build on high-severity vuln.  
- Quarterly license audit (`pnpm licenses list`)—no GPL transitive deps.

---

### 19.9 Observability SLA
| Metric | Target | Alert |
|--------|--------|-------|
| API p95 latency | <400 ms | Slack `#alerts` if >3 min |
| Pose job success | >98 % | PagerDuty if <95 % |
| Front-end error rate | <0.5 % sessions | LogRocket alert |

---

### 19.10 "One-Touch Rollback" Policy
Every deploy auto-tags Docker images & database migrations.  
`npm run rollback --to <tag>` restores previous stable state in ≤5 minutes.

---

*Follow these rules, and Pure stays tight, predictable, and senior-dev approved—even when AI agents are cranking out code at 3 AM.*

---

## 20. Additional Codebase Safeguards
*The last 5% that lets you scale people safely while the product scales revenue.*

| # | Guideline | Why It Matters |
|---|-----------|----------------|
| 20.1 | **Conventional Commits** (`feat:`, `fix:`, `chore:`) enforced by commit-lint hook | Machine-parsable history → automated changelogs & semantic-release accuracy |
| 20.2 | **Dependabot + Renovate split**: Dependabot for security, Renovate for regular bumps (grouped PRs, scheduled weekly) | Prevents "update storm" PR clutter while patching CVEs fast |
| 20.3 | **Monorepo module boundaries** enforced via `eslint-plugin-boundaries` | No cross-layer imports (e.g., UI can't import from pose-service) |
| 20.4 | **DangerJS PR bot**: fails build if TODO/FIXME left, missing tests, or no ADR link | Automates reviewer nagging |
| 20.5 | **Markdown lint & spell-check** on docs folder | Keeps README / ADRs readable and typo-free |
| 20.6 | **DORA metrics dashboard** (deploy freq, MTTR) via GitHub Insights + Uptime Kuma | Tracks engineering health over time |
| 20.7 | **Code-owners file**: routes PRs to domain experts (e.g., `/pose-service/**` → `@backend-ai`) | Ensures the right eyeballs on niche areas |
| 20.8 | **C4 architecture diagram** committed as `/docs/architecture.drawio` | Quick mental model for any new hire |
| 20.9 | **Stale-branch bot**: auto-closes PRs >30 days idle | Prevents half-done AI branches rotting |
| 20.10 | **Monthly "tech-debt triage"** label + sprint | Keeps refactor work officially budgeted |
| 20.11 | **Pinned "Definition of Done"** checklist in each GitHub issue template | Aligns humans & agents on exit criteria |
| 20.12 | **SAST** (static app-sec test) via GitHub Advanced Security or SonarCloud | Catch secret leaks / insecure code in CI |

### 20.1 Implementation Quick-hits

```bash
# Conventional commits & commitlint
pnpm add -D @commitlint/{config-conventional,cli} husky
echo "module.exports = {extends:['@commitlint/config-conventional']};" > commitlint.config.cjs
npx husky add .husky/commit-msg 'npx --no-install commitlint --edit "$1"'

# DangerJS (JS version)
pnpm add -D danger @types/danger
# .github/workflows/danger.yml → run danger ci
```

### 20.2 CODEOWNERS File Example

```gitignore
# Code ownership routing
/pose-service/*     @backend-ai
/src/components/*   @frontend-lead @design
/src/services/*     @backend-lead
/docs/*             @product
/src/routes/admin/* @platform-lead
*.sql               @database-lead
package*.json       @platform-lead
```

### 20.3 Benefits of Full Implementation

✅ **Every PR runs through the same gauntlet**  
✅ **AI agents can scaffold but can't color outside the lines**  
✅ **New human devs learn the codebase shape in < 30 minutes**  
✅ **Grown-up investors see production maturity**  

> *This is the last 5% most indie projects skip—the 5% that lets you scale people safely while the product scales revenue.*

---

*End of v0.2 – ready for Cursor scaffolding.* 
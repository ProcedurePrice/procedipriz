# Afere

**Afere** is a high-performance medical billing calculator built exclusively for neurosurgeons. It solves the operational friction of reconciling the SBN (*Sociedade Brasileira de Neurocirurgia*) specialty catalog with the CBHPM (*Classificação Brasileira Hierarquizada de Procedimentos Médicos*) valuation table — producing a precise, real-time fee breakdown for the entire surgical team in seconds.

The entire system is built under **Spec-Driven Design (SDD)**: the OpenAPI contract (`openapi.yaml`) is the single source of truth and precedes every implementation decision.

---

## Features

- **Privacy-first landing screen** — a minimalist search interface that exposes no financial data, safe to open in front of patients or staff
- **Real-time composition** — select an SBN procedure, pick which CBHPM codes were performed, toggle the access route and anesthesia; fees recalculate in under 150 ms
- **Multi-procedure support** — compose multiple SBN procedures in one bill; CBHPM 4.1/4.2 discount rules applied automatically
- **CBHPM-mandated auxiliaries** — auxiliary count is locked to the value specified in the CBHPM 2022 manual when the selected codes define it; free selection otherwise
- **Save & retrieve calculations** — persist a completed valuation by URL-safe public ID; retrieve it later without authentication
- **Delete saved calculations** — remove a saved calculation with a confirmation guard
- **Shareable report** — copy a pre-filled URL that reconstructs the exact calculation state for any recipient

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22+ · `net/http` · `oapi-codegen` · `sqlc` |
| Database | PostgreSQL (Neon serverless) |
| Frontend | Next.js 16 (App Router) · Turbopack · Tailwind CSS · shadcn/ui |
| Dev environment | Docker Dev Containers |
| CI | GitHub Actions |

---

## Project Structure

```text
afere/
├── .claude/                     # Project-level Claude Code skills
├── .devcontainer/               # Dev Container definition
├── .github/workflows/           # CI pipelines
├── backend/
│   ├── cmd/api/main.go          # Entry point
│   ├── db/migrations/           # SQL migrations (001–007)
│   ├── internal/
│   │   ├── config/              # Env config
│   │   ├── generated/           # oapi-codegen output
│   │   ├── handlers/            # HTTP handlers + tests
│   │   ├── models/              # Domain types
│   │   ├── repository/          # Interface + File + Postgres implementations
│   │   └── service/             # Pure calculation engine
│   └── go.mod
├── data/
│   ├── raw_pdfs/                # Source PDFs (SBN MCPN + CBHPM 2022)
│   ├── generate_catalog.py      # Two-phase ETL → procedures.json
│   └── generate_seed.py         # procedures.json → 003_seed_procedures.sql
├── docs/                        # Architecture, domain model, flows
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   └── components/              # UI primitives (shadcn/ui + custom)
├── CLAUDE.md                    # AI agent instructions
├── openapi.yaml                 # API contract (source of truth)
└── PRD.md                       # Product requirements
```

---

## Business Rules

### CBHPM 4.1 / 4.2 — Multi-procedure discount

When multiple codes are billed in the same surgical act:

| Scenario | Rate applied to additional procedures |
|---|---|
| Same access route (CBHPM 4.1) | 50% |
| Different access routes (CBHPM 4.2) | 70% |

The principal procedure (highest porte value) is always billed at 100%.

### CBHPM 5.1 / 5.2 — Auxiliary surgeon fees

Auxiliary fees are computed on the lead surgeon's total fee, not on `total_base`:

| Position | Percentage |
|---|---|
| 1st auxiliary | 60% |
| 2nd auxiliary | 40% |
| 3rd auxiliary | 30% |
| 4th auxiliary | 30% |

The number of auxiliaries is determined by the highest `num_auxiliaries` value among the selected codes (CBHPM 5.2). When the manual mandates a value, the UI locks the selector automatically.

### Anesthesiologist

Optional fixed fee of **R$ 1,200.00** when the anesthesia toggle is enabled.

See [Domain Model](docs/domain-model.md) for the complete valuation specification.

---

## Running Locally

### Prerequisites

Open the repo root in VS Code and accept **"Reopen in Container"** to load the pre-configured Dev Container (Go, Node.js, psql, pdfplumber included).

### Backend

```bash
cd backend
go run cmd/api/main.go
```

Set `DATABASE_URL` in `backend/.env` to connect to Neon. Without it the server falls back to the embedded `procedures.json` catalog (suitable for development).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Next.js dev server runs on `http://localhost:3000` with Turbopack.

### Database

Apply migrations in order against your Neon database:

```bash
psql "$DATABASE_URL" -f backend/db/migrations/001_schema.sql
psql "$DATABASE_URL" -f backend/db/migrations/002_seed_portes.sql
psql "$DATABASE_URL" -f backend/db/migrations/003_seed_procedures.sql
# ... through 007
```

Migration 003 is generated from `procedures.json` via `data/generate_seed.py`. Re-run the script after updating the procedure catalog.

### ETL (procedure catalog)

```bash
# Requires: pdfplumber (pip install pdfplumber)
# Optional: poppler-utils (pdftotext) for full SBN PDF re-parse
python3 data/generate_catalog.py   # → backend/internal/repository/procedures.json
python3 data/generate_seed.py      # → backend/db/migrations/003_seed_procedures.sql
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/procedures/search?q=` | Search SBN procedures (≥2 chars) |
| `GET` | `/api/procedures/{id}` | Procedure detail with CBHPM codes |
| `POST` | `/api/calculate` | Compute fee breakdown |
| `POST` | `/api/calculations` | Save a completed calculation |
| `GET` | `/api/calculations` | List saved calculations |
| `GET` | `/api/calculations/{public_id}` | Retrieve a saved calculation |
| `DELETE` | `/api/calculations/{public_id}` | Delete a saved calculation |
| `GET` | `/health` | Health check |

Full schema: [`openapi.yaml`](openapi.yaml)

---

## Conventions

### Language split

| Context | Language |
|---|---|
| Code, variables, comments, commits, API fields | English |
| UI labels, error messages, medical terminology | Portuguese (PT-BR) |

### Branching

| Branch | Purpose |
|---|---|
| `main` | Production — stable, audited |
| `staging` | Pre-production homologation |
| `feature-<name>` | Short-lived feature branches → PR into `staging` |

---

## Documentation

- [Architecture](docs/architecture.md)
- [Domain Model](docs/domain-model.md)
- [Search Flow](docs/search-flow.md)
- [Calculation Flow](docs/calculation-flow.md)
- [Deployment](docs/deployment.md)
- [Roadmap](docs/roadmap.md)

---

*2026 · LabF5 · Todos os direitos reservados*

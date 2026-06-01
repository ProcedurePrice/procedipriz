# ProcediPriz

**ProcediPriz** is a high-performance engineering solution strictly designed to solve one of the biggest operational bottlenecks in the medical billing routine of neurosurgeons: the agile, precise, and deterministic reconciliation of fees. The platform cross-references the specialty catalog of the SBN (Sociedade Brasileira de Neurocirurgia) with the guidelines and valuation tables of the CBHPM (Classificação Brasileira Hierarquizada de Procedimentos Médicos) catalog.

The entire application was architected under the **Spec-Driven Design (SDD)** philosophy, where API contracts and static models precede implementation, mitigating errors, eliminating the risk of medical billing rejections, and ensuring absolute mathematical compliance.

## 🚀 Technologies & Architecture

The ecosystem adopts a **Monorepo** approach, unifying the presentation and computation layers for maximum cohesion and maintainability:

* **Backend:** Developed in Go (Golang 1.22+), exclusively using the native `net/http` library for routing and request handling. Static typing and contract security are guaranteed by `oapi-codegen` and `sqlc` (compiling raw SQL queries into idiomatic, strictly type-safe Go code).

* **Frontend:** Built with Next.js 16 (App Router), designed with a radical focus on UX and response speed. It uses the **Turbopack** engine (`next dev --turbo`) to ensure instantaneous local build times, styled via Tailwind CSS and highly accessible primitive components from shadcn/ui.

* **Database:** PostgreSQL managed and scaled in a serverless manner through the **Neon** infrastructure.

* **Development Environment:** Docker Dev Containers, surgically isolating all necessary tools (Go, Node.js, and CLI ecosystem tools).

* **Quality & CI/CD:** Continuous integration via GitHub Actions for automated execution of unit tests.

## 🗂️ Project Structure (3-Level Topology)

The monorepo topology is structured up to the third level of depth to ensure a strict segregation of responsibilities:

```text
procedi-priz/
├── .devcontainer/
│   ├── devcontainer.json
│   └── Dockerfile
├── .github/
│   └── workflows/
├── backend/
│   ├── cmd/
│   ├── db/
│   ├── internal/
│   └── go.mod
├── frontend/
│   ├── app/
│   ├── components/
│   └── package.json
├── data/
│   └── raw_pdfs/
├── CLAUDE.md
└── openapi.yaml
```

## 🧠 Business & Domain Rules

The calculations performed by the API's business layer translate the general medical billing rules with surgical precision:

* **Cirurgião Principal:** 100% of the monetary value of the selected procedure's *porte*.

* **1º Auxiliar:** 30% of the value assigned to the *Cirurgião Principal*.

* **2º, 3º e 4º Auxiliares:** 20% of the *Cirurgião Principal*'s value (for each individual professional).

* **Anestesiologista:** Adds 100% of the anesthesia *porte* value if the *Necessidade de Anestesia* flag is checked.

### Linguistic Conventions

* **Infrastructure & Engineering:** All source code, contract documentation, variables, database tables, and Git commit messages MUST be written strictly in **English**.

* **Domain & Experience:** All UI labels (e.g., *Buscar Procedimento*, *Porte do Procedimento*), visual error handling, surgical terms, and medical procedures extracted from the official manuals MUST be kept entirely in **Portuguese (PT-BR)**.

## 🛠️ Execution Instructions

### 1. Initializing the Environment

Open the monorepo root in your editor. Confirm the prompt to **"Reopen in Container"** to load the isolated and pre-configured Dev Container ecosystem.

### 2. Seeding the Database (ETL)

The extraction of raw data from the PDFs and the initial population of the PostgreSQL (Neon) database are already handled by an external utility script. The Go backend assumes immutably that the tables are already populated.

### 3. Running the Backend Server (Go)

```bash
cd backend
go run cmd/api/main.go
```

### 4. Running the Frontend (Next.js 16 with Turbopack)

```bash
cd frontend
npm install
npm run dev
```

## 🌿 Branching Strategy & Version Control

* **`main`:** Absolute source of truth. Stores only code in a stable, audited production state.

* **`staging`:** Homologation and pre-production branch. Acts as a production mirror for executing integrated tests.

* **`feature-<name>`:** Ephemeral branches for developing new capabilities or local refactoring. MUST be merged via Pull Request into `staging`.

---
*UI Footer Requirement: The bottom of the application must contain the text "Made by LabF5". No other mentions of the development studio should exist in the UI or codebase.*

# Claude Code Agent Instructions

## System Context

You are an expert Principal Software Engineer and UI/UX Specialist working on ProcediPriz, a high-performance medical billing calculator for neurosurgeons.

This file provides exhaustive architectural constraints, CLI commands, and behavioral guidelines. You must strictly adhere to these rules without exception. Before writing any business logic, always read `PRD.md` to ensure mathematical and functional compliance.

---

# 🏗️ Architecture & Monorepo Topology

This is a strict Monorepo using a 3-tier topology:

- `backend/`: Go 1.22+ API.
- `frontend/`: Next.js 16 (App Router) + Turbopack.
- `data/`: Raw ETL scripts and PDF manuals.

## Core Stack & Code Generation

### Backend Routing

- Pure `net/http` standard library.
- No external frameworks (such as Gin or Echo).

### Backend DB

- PostgreSQL via Neon.
- Database interaction is strictly managed by `sqlc`.

### Backend OpenAPI

- Spec-Driven Design.
- `oapi-codegen` is used to generate Go structs and boilerplate from `openapi.yaml`.

### Frontend UI

- Tailwind CSS.
- shadcn/ui.

---

# 🧠 AI Behavioral Directives & Linguistic Conventions

## Language Split

### Infrastructure / Code

All of the following MUST be written in English:

- Code
- Variables
- Functions
- Comments
- Commit messages
- Pull Requests

### UI / Domain

All of the following MUST be written in Portuguese (PT-BR):

- User-facing text
- Error messages
- Medical terminology

## Refactoring & Generation

- Never alter the OpenAPI specification (`openapi.yaml`) without explicit user consent.
- Always prioritize immutability and functional programming concepts in Go.
- For frontend tasks, utilize Server Components by default unless interactivity is explicitly required (`"use client"`).

---

# 🎨 UI/UX Generation Protocol (`ui-ux-pro-max-skill`)

When the user requests frontend UI creation or modification, you MUST leverage the predefined skill/prompting framework: `ui-ux-pro-max-skill`.

## Execution Rule for UI Tasks

1. Acknowledge the requirement.
2. Formulate the design mentally based on the `ui-ux-pro-max-skill` parameters:
   - Accessibility-first
   - shadcn/ui primitives
   - Perfect dark/light mode contrast
   - Minimalist spacing
3. Execute the code generation prioritizing a:
   - Clinical aesthetic
   - Clean interface
   - High-performance experience

---

# 🛠️ CLI Commands Cheat Sheet

You are authorized to use the following commands to interact with the environment.

## Go Backend

### Run backend

```bash
cd backend && go run cmd/api/main.go
```

### Generate SQL queries

```bash
cd backend && sqlc generate
```

### Run tests

```bash
cd backend && go test ./... -v
```

## Next.js Frontend

### Run frontend

```bash
cd frontend && npm run dev
```

### Add shadcn component

```bash
cd frontend && npx shadcn@latest add <component>
```

---

# 🔒 Security & Privacy Rules

- Never log real medical procedures or prices to the console.
- Ensure the frontend respects the **Privacy-First** landing page requirement defined in the `PRD.md`.
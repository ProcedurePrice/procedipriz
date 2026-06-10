# Domain Model — Afere

## Business Context

Afere is a medical billing calculator for neurosurgeons in Brazil. Physicians bill insurance companies using the **CBHPM** table (Classificação Brasileira Hierarquizada de Procedimentos Médicos). The **SBN** (Sociedade Brasileira de Neurocirurgia) groups related CBHPM codes into named surgical packages for practical use.

One SBN surgical package maps to **one or more** CBHPM billable codes. Each code carries an intrinsic **porte** (complexity class) that determines its monetary value. The physician selects which codes were actually performed and declares whether the procedures shared the same access route — this drives the multi-procedure discount rule.

---

## Domain Concepts

| Concept | Description |
|---|---|
| **SBN Procedure** | A named surgical package published by the SBN. Has a code and a human-readable name. |
| **CBHPM Code** | A billable line item from the national procedure table. Has a code, description, and an intrinsic porte. |
| **Porte** | A complexity class (e.g. `7A`, `8B`) with a fixed BRL value defined by CBHPM 2025/2026 (Faixa Original). Read-only — the physician cannot change a code's porte. |
| **AccessRouteType** | `same` (CBHPM 4.1) or `different` (CBHPM 4.2). Drives the multi-procedure discount rate. |
| **Composition** | The physician's selection of which CBHPM codes to include in a bill. |
| **Valuation** | The monetary breakdown of a composition applying CBHPM 4.1/4.2 and 5.1 rules. |

---

## CBHPM Code Selectability

Per the SBN Manual de Codificação (MCPN), item 6:

> "A recomendação é que não haja desmembramento na relação de códigos cirúrgicos, salvo naquelas situações em que há um (*) enfatizando a ressalva no próprio rodapé da cirurgia."

All codes in an SBN procedure list are included by default. Only codes marked with `(*)` in the SBN manual are conditionally applicable. The UI currently allows free deselection; this should be improved in a future release to distinguish mandatory from optional codes.

---

## Valuation Engine

### Step 1 — Resolve porte values

For each selected CBHPM code, look up `PorteValues[code.porte]` (CBHPM 2025/2026, Faixa Original).

### Step 2 — Identify the principal procedure

The principal procedure is the code with the highest monetary porte value.

### Step 3 — Apply multi-procedure discount (CBHPM 4.1 / 4.2)

**Single procedure**: surgeon fee = 100% of its porte value (no discount).

**Same access route (CBHPM item 4.1)**:
```
surgeon_fee = principal_value + 0.50 × Σ(all other selected porte values)
```

**Different access routes (CBHPM item 4.2)**:
```
surgeon_fee = principal_value + 0.70 × Σ(all other selected porte values)
```

`total_base` (sum of all values before discounting) is preserved in the response for reference.

### Step 4 — Auxiliary surgeon fees (CBHPM 5.1 applied to surgeon total per 5.2)

Auxiliary fees are computed on the **surgeon_fee** (not on total_base), per CBHPM item 5.2.

| Position | Percentage |
|----------|-----------|
| 1st auxiliary | **60%** |
| 2nd auxiliary | **40%** |
| 3rd auxiliary | **30%** |
| 4th auxiliary | **30%** |

### Step 5 — Anesthesiologist

Optional fixed fee of R$ 1,200.00 when `requires_anesthesia = true`.

### Step 6 — Final total

```
final_total = surgeon_fee + Σ(auxiliary_fees) + anesthesiologist_fee
```

---

## Database Schema

```
sbn_procedures
  id          UUID PK (gen_random_uuid())
  code        TEXT UNIQUE NOT NULL         -- e.g. "1.1"
  name        TEXT NOT NULL                -- e.g. "CONSULTA GERAL - CRÂNIO"
  description TEXT
  created_at  TIMESTAMPTZ DEFAULT now()

cbhpm_codes
  id              UUID PK (gen_random_uuid())
  code            TEXT UNIQUE NOT NULL         -- e.g. "1.01.01.01-2"
  description     TEXT NOT NULL
  num_auxiliaries INT NOT NULL DEFAULT 0
  created_at      TIMESTAMPTZ DEFAULT now()

portes
  code        TEXT PK                      -- e.g. "7A"
  value_brl   NUMERIC(10,2) NOT NULL       -- e.g. 858.03

sbn_cbhpm_mappings
  id                UUID PK
  sbn_procedure_id  UUID FK → sbn_procedures.id
  cbhpm_code_id     UUID FK → cbhpm_codes.id
  porte_code        TEXT FK → portes.code
  sort_order        INT DEFAULT 0
  UNIQUE (sbn_procedure_id, cbhpm_code_id)
```

---

## API Flows

### Search flow

```
GET /api/procedures/search?q=cranio
  → [{ id, name }]           ← SBNProcedureResult[]
```

### Detail flow

```
GET /api/procedures/{id}
  → { id, name, cbhpm_codes: [{ code, description, porte, num_auxiliaries }] }
```

### Calculation flow

```
POST /api/calculate
  body: {
    selected_codes:    [{ cbhpm_code, description, porte }],
    auxiliaries_count: int,          -- 0–4
    requires_anesthesia: bool,
    access_route_type: "same" | "different"
  }
  → {
    code_breakdown:          [{ cbhpm_code, description, porte, base_value, is_principal }],
    access_route_type:       "same" | "different",
    surgeon_breakdown:       { principal_value, additional_gross, discount_rate,
                               additional_discounted, surgeon_total },
    lead_surgeon_fee:        number,
    individual_auxiliary_fees: [{ position, percentage, fee }],
    auxiliaries_fee:         number,
    anesthesiologist_fee:    number,
    final_total:             number,
    total_base:              number
  }
```

---

## Frontend Flow

```
Search box
  │  (user types ≥2 chars → debounced GET /api/procedures/search)
  ▼
Dropdown → user selects SBN procedure
  │  (GET /api/procedures/{id})
  ▼
CBHPM code list (all pre-checked, porte shown read-only)
  │  (user checks/unchecks codes that were performed)
  ▼
Access route selection (Mesma via / Vias diferentes)
  │
Auxiliary count selector (0–4 toggle buttons)
  │
Anesthesia toggle
  │  (debounced 150ms → POST /api/calculate)
  ▼
Right panel:
  ├── Per-code breakdown (principal badge on highest-value code)
  ├── Rule applied (4.1 or 4.2 label)
  ├── Surgeon calculation (principal + additional discounted)
  ├── Auxiliary calculation (per-position with CBHPM 5.1 percentages)
  └── Total da Equipe (surgeon + aux + anesthesia)
  │
  ▼
Share button → copies URL:
  /share?sbn={id}&codes={code1},{code2}&a={n}&an={0|1}&route={same|different}
```

---

## Backend Architecture

```
cmd/api/main.go
  └── config.Load()                        reads DATABASE_URL, PORT
  └── repository.NewPostgresRepository()  (if DATABASE_URL set)
      or repository.NewFileRepository()   (fallback: embedded JSON)
  └── handlers.RegisterRoutes(mux, repo)

internal/
  config/         env config
  models/         domain types (AccessRouteType, SurgeonBreakdown, AuxiliaryFee, …)
  repository/     interface + file-based + postgres implementations
  service/        calculator.go — pure functions, no I/O; calculator_test.go
  handlers/       HTTP handlers (search, procedure, calculate, health)
  generated/      openapi.gen.go — hand-maintained to match openapi.yaml v3.0.0
```

---

## Future Expansion

- **Payer-specific faixa**: CBHPM 2025/2026 defines Faixas I, II, III with different monetary multipliers. Add a `faixa` selector per payer.
- **(*)-optional codes**: Mark SBN catalog codes as optional vs mandatory and enforce this in the UI.
- **Emergency surcharge**: CBHPM item 2.1 adds 30% for procedures performed at night / weekends / holidays.
- **Pediatric surcharges**: CBHPM items 4.6–4.8 add 30–100% for young patients.
- **Multi-session bills**: Allow composing multiple SBN procedures in one calculation (each with its own access route).
- **Payer-specific porte overrides**: Add `payer_porte_overrides` table for negotiated portes.

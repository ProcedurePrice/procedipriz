# Valuation Rules — Domain Validation Report

**Date**: 2026-06-10  
**Scope**: All pricing assumptions driving `service/calculator.go`, `domain-model.md`, `PRD.md`, and `openapi.yaml`.  
**Sources examined**:
- `data/raw_pdfs/CBHPM-2022_versao-agosto-2023.pdf` — Instruções Gerais, items 1–7 (canonical rule text)
- `data/raw_pdfs/COMUNICADO-CBHPM-2025_2026.pdf` — Updated porte monetary values (oct/2025–sep/2026)
- `data/raw_pdfs/cbac6c_d991322923c24d01b46e1fdd39af6e73.pdf` — SBN Manual de Diretrizes de Codificação dos Procedimentos em Neurocirurgia (MCPN, rev. 2018)
- `PRD.md`, `docs/domain-model.md`, `openapi.yaml`, `backend/internal/service/calculator.go`

---

## Confirmed Rules

Rules explicitly and unambiguously supported by the source documents.

### R1 — Same-access-route multi-procedure rule (50%)

> **CBHPM 2022, item 4.1**  
> "Quando previamente planejada, ou quando se verificar, durante o ato cirúrgico, a indicação de atuar em vários órgãos ou regiões ou em múltiplas estruturas articulares **a partir da mesma via de acesso**, a quantificação do porte da cirurgia será a que corresponder, por aquela via, ao **procedimento de maior porte, acrescido de 50% do previsto para cada um dos demais atos médicos praticados**, desde que não haja um código específico para o conjunto."

Formula confirmed:
```
Surgeon value (same route) = max(porte value) + 50% × Σ(all other porte values)
```

### R2 — Different-access-route multi-procedure rule (70%)

> **CBHPM 2022, item 4.2**  
> "Quando ocorrer mais de uma intervenção por **diferentes vias de acesso**, deve ser adicionado ao porte da cirurgia considerada principal o equivalente a **70% do porte de cada um dos demais atos praticados**."

Formula confirmed:
```
Surgeon value (different route) = principal porte value + 70% × Σ(all other porte values)
```

> **CBHPM 2022, item 4.3** additionally clarifies:  
> Bilateral surgeries follow the same rule: 70% if different incisions, 50% if same incision.

### R3 — Porte is an intrinsic property of each CBHPM code

> **CBHPM 2022, item 1.2**  
> "Os portes representados ao lado de cada procedimento não expressam valores monetários, apenas estabelecem a comparação entre os diversos atos médicos no que diz respeito à sua complexidade técnica, tempo de execução, atenção requerida e grau de treinamento necessário para a capacitação do profissional que o realiza."

The porte code (e.g., `7A`) is an inherent complexity classification, not a price chosen by the physician.

### R4 — Auxiliary fees are calculated on the TOTAL surgeon valuation

> **CBHPM 2022, item 5.2**  
> "Quando uma equipe, num mesmo ato cirúrgico, realizar mais de um procedimento, o número de auxiliares será igual ao previsto para o procedimento de maior porte, e **a valoração do porte para os serviços desses auxiliares será calculada sobre a totalidade dos serviços realizados pelo cirurgião.**"

Auxiliary fees apply to the full final surgeon value (after applying R1 or R2 discounts), not to individual procedure codes in isolation.

### R5 — CBHPM 2025/2026 porte monetary values are correctly seeded

The `COMUNICADO-CBHPM-2025_2026.pdf` (Faixa Original, INPC 5.10%) matches the values in `service/calculator.go` exactly, for example:

| Porte | CBHPM document | `PorteValues` map |
|-------|---------------|-------------------|
| 1A    | R$ 26.74      | 26.74             |
| 7A    | R$ 858.03     | 858.03            |
| 14C   | R$ 6.922.36   | 6922.36           |

### R6 — Emergency surcharge is 30%

> **CBHPM 2022, item 2.1**  
> Urgent/emergency procedures have a 30% surcharge on their portes in specific time windows (19h–7h, weekends, holidays).

The SBN manual confirms this in every surgical chapter ("Cirurgias realizadas em caráter de emergência/urgência terão acréscimo de 30% no valor final conforme previsto na CBHPM").

---

## Uncertain Rules

Rules that appear likely based on context but are not explicitly stated in the available documents.

### U1 — Porte override for payer-specific contracts

The `domain-model.md` states: "Per-code porte may need overriding (e.g., a payer-specific contract changes the porte for code X)."

The `COMUNICADO-CBHPM-2025_2026.pdf` defines **four pricing faixas** (Faixa Original, I, II, III) with substantially different monetary amounts for the same porte code. This is evidence that the monetary value can vary by negotiation, but it is not clear whether this means the porte code itself changes or only the conversion multiplier.

**Interpretation**: the porte code (e.g., `8A`) remains fixed; what can change is which faixa (price band) is applied. The system should model this as a "faixa multiplier", not as a "porte override."

### U2 — Number of allowed auxiliaries per CBHPM code

The SBN MCPN procedure tables and `openapi.yaml` include a `num_auxiliaries` field per CBHPM code. The documents list specific staffing for each surgical procedure (e.g., 1, 2, or 3 auxiliaries). This field is data-driven and correct in intent, but the CBHPM itself (item 5.2) only states that "the number of auxiliaries equals that required by the highest-porte procedure." The exact mapping is therefore a domain convention in the SBN manual, not explicit in the CBHPM text.

---

## Contradicted Rules

Rules currently assumed or implemented by the project that **directly conflict** with the source documents.

---

### ❌ C1 — CRITICAL: Auxiliary surgeon percentages are wrong

**Current project assumption** (PRD.md §3.2, domain-model.md §Calculation Rules, calculator.go):

| Position | Current % |
|----------|-----------|
| 1st auxiliary | 30% |
| 2nd auxiliary | 20% |
| 3rd auxiliary | 20% |
| 4th auxiliary | 20% |

**CBHPM 2022, item 5.1** (verbatim):

> "A valoração dos serviços prestados pelos médicos auxiliares dos atos cirúrgicos corresponderá ao percentual de **60% da valoração do porte ao ato praticado pelo cirurgião para o primeiro auxiliar, 40% para o segundo auxiliar, 30% para o terceiro e, quando o caso exigir, também para o quarto auxiliar.**"

**CBHPM-mandated values**:

| Position | CBHPM % |
|----------|---------|
| 1st auxiliary | **60%** |
| 2nd auxiliary | **40%** |
| 3rd auxiliary | **30%** |
| 4th auxiliary | **30%** |

The gap is large: the current implementation charges the 1st auxiliary at half the legally referenced rate (30% vs 60%) and the 2nd at half as well (20% vs 40%).

**Evidence of alternative formulas searched and not found**: The repository was searched in full for any document supporting 30/20/20/20, 70/20/20, or any other formula. No supporting document was found. The SBN MCPN explicitly defers all valuation rules to the CBHPM ("O conteúdo deste Manual é derivado da própria tabela CBHPM… sem, entretanto, ultrapassar ou modificar o conteúdo") and introduces no neurosurgery-specific exceptions to item 5.1.

---

### ❌ C2 — CRITICAL: Multi-procedure discounting (4.1/4.2) is not implemented

**Current implementation** (`calculator.go`):

```go
// total_base = Σ porte values for ALL selected codes (no discounting)
for _, c := range codes {
    totalBase += PorteValues[c.Porte]
}
leadSurgeonFee = totalBase  // 100% of simple sum
```

**CBHPM requirement**: When multiple procedures are performed in the same surgical session, the surgeon fee is NOT the simple sum of all porte values. It is:
- **Same access route (4.1)**: `max(porte) + 50% × Σ(rest)` 
- **Different access routes (4.2)**: `principal_porte + 70% × Σ(rest)`

The current engine ignores the 50%/70% reductions entirely. This means every multi-code calculation currently **overestimates** the surgeon fee.

This is structurally significant: the openapi spec's `CalculateRequest` has no `access_route` field, so the frontend cannot currently communicate whether procedures share an access route. The calculation model itself needs to be redesigned.

---

### ❌ C3 — MODERATE: SBN code lists are not freely optional by default

**Current project assumption** (domain-model.md):  
"Physicians may uncheck codes that aren't applicable for a specific patient or payer."

**SBN MCPN, Instruções Gerais, item 6**:  
> "A solicitação das cirurgias pode ser feita pelo nome da cirurgia propriamente dita, capitulada em destaque em cada lista de códigos agregados, **subentendendo-se assim que cada código da lista está incluso**; ou pela relação de códigos relacionada àquela cirurgia solicitada. **A recomendação é que não haja desmembramento na relação de códigos cirúrgicos, salvo naquelas situações em que há um (\*) enfatizando a ressalva no próprio rodapé da cirurgia.**"

This means:
- All codes in an SBN procedure list are **included by default** when the procedure is requested.
- Disaggregation (unchecking individual codes) is only appropriate for codes explicitly marked with `(*)` in the SBN manual.
- Example from SBN procedure 2.1: `3.07.15.25-3 - Punção Liquórica*` — footnote: "* Nos casos necessário para o diagnóstico de HSA."

The current UI design exposes all codes as freely checkable/uncheckable. This is only appropriate for (*)-marked codes.

**Practical nuance**: Item 7 of the same instructions requires that "all surgical steps performed be described in the surgical report." This implies that if a step was not performed, it should not be billed — which is a partial justification for deselection. However, the recommendation is that if the step was not performed, the correct action is to note it in the report, not simply uncheck the code from the billing request.

---

## Open Questions

Questions that require confirmation from a practicing neurosurgeon, the SBN CPHM (Comissão Permanente de Honorários Médicos), or an official SBN communication before implementation.

### OQ1 — Why does PRD.md use 30/20/20/20 instead of the CBHPM's 60/40/30/30?

This is the most important open question. The PRD was authored with explicit 30%/20% values. Possible explanations:
- The physician may be using a payer-negotiated rate that is lower than the CBHPM reference.
- Some health insurers contractually pay reduced auxiliary rates and the PRD was written to match real-world reimbursements rather than the CBHPM reference.
- It may be an authoring error in the PRD.

**Resolution required**: Confirm with the neurosurgeon user which percentage schedule reflects their actual billing practice and whether this tool should implement the CBHPM reference rates, their insurer's rates, or be configurable.

### OQ2 — Is the current tool intended for CBHPM reference billing or for payer-specific billing?

The CBHPM explicitly states its values are "referencial mínimo" and that actual values must be negotiated. If the tool is for reference billing (CBHPM table), use 60/40/30/30. If for a specific insurer contract, the percentages may differ and should be configurable per payer.

### OQ3 — Should the 50%/70% multi-procedure discount apply at the CBHPM-code level or at the SBN-procedure level?

Within one SBN procedure package, all CBHPM codes are considered part of a single surgical act. The CBHPM 4.1/4.2 rules refer to operating on "various organs or regions via the same/different access." It is unclear whether:
- (a) All codes within one SBN procedure are always same-access and total 100% (no discount needed within a package), or
- (b) Some codes within a package are performed through different accesses (e.g., a craniotomy code plus a separate spinal code), each triggering different discount rules.

**Resolution required**: Ask a neurosurgeon whether the SBN codes within a single SBN package are always same-access, or whether multi-access scenarios can occur within a single package.

### OQ4 — What is the correct model for (*)-marked optional codes?

Some SBN procedure codes are marked with `(*)` to indicate they are situationally applicable. The system should visually differentiate mandatory codes from optional codes. Should the UI:
- (a) Lock mandatory codes and only allow deselection of (*)-marked codes?
- (b) Allow full deselection with a prominent warning for non-(*) codes?
- (c) Something else?

### OQ5 — Should the emergency/urgency 30% surcharge be included in the tool?

CBHPM item 2.1 specifies a 30% surcharge for procedures performed at night, weekends, or holidays. The SBN manual repeats this for all surgical chapters. The current system has no UI for this. Is it in scope?

### OQ6 — Faixa (price band) selection

The CBHPM 2025/2026 defines four pricing tiers (Original, I, II, III) with substantially different values for the same porte code. The system currently uses Faixa Original. Should the system support faixa selection per payer?

---

## Final Recommendation

**The proposed valuation engine cannot be safely implemented as currently specified.** Two critical contradictions must be resolved before coding begins:

### Blocking issues (must be resolved before any implementation)

1. **[C1] Auxiliary percentages**: The project implements 30/20/20/20 but the CBHPM specifies 60/40/30/30. Implementing the wrong rates will produce incorrect bills. The practitioner must confirm which set of rates applies to their billing context. **Do not implement any assistant calculation until this is confirmed.**

2. **[C2] Multi-procedure discounting**: The current calculator sums all codes at 100% and ignores CBHPM 4.1 and 4.2. The `CalculateRequest` API has no `access_route` field. The entire calculation model and API must be redesigned to accept route information and apply discounts correctly before the assistant-fee calculation can even be correct (because assistant fees depend on the final, discounted surgeon value per CBHPM 5.2).

### Non-blocking issues (can be addressed incrementally)

3. **[C3] Code selectability**: The UI treating all codes as freely deselectable contradicts SBN intent. The procedures.json / database model should track which codes are `(*)` optional so the UI can enforce the SBN recommendation. This affects UX, not the core calculation.

4. **[OQ5] Emergency surcharge**: Not implemented. Low risk to defer if no emergency billing use case is in scope.

5. **[U1] Faixa selection**: The tool currently defaults to Faixa Original. This is appropriate as a starting point; adding faixa selection can come later.

### Recommended validation sequence

```
1. Confirm auxiliary percentages with the user → unblocks C1
2. Confirm multi-procedure model (same vs different access route) → unblocks C2
3. Redesign CalculateRequest to include access_route_type enum (same | different)
4. Update calculator.go with confirmed percentages and 4.1/4.2 discounting
5. Mark (*)-optional codes in the data catalog → addresses C3
6. Add porte faixa selection if desired → addresses U1
```

Only after steps 1 and 2 are confirmed should any changes to `calculator.go` or `openapi.yaml` be made.

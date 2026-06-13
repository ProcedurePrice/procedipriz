// Package service contains the deterministic valuation engine for Afere.
package service

import "afere/backend/internal/models"

// anesthesiaFee is the fixed anesthesiologist fee in BRL, per the CBHPM table.
const anesthesiaFee = 1200.00

// auxPercentages maps auxiliary position (1-based) to the CBHPM 5.1 percentage.
// CBHPM 2022, item 5.1: 60% for 1st, 40% for 2nd, 30% for 3rd and 4th auxiliary.
var auxPercentages = [5]float64{0, 0.60, 0.40, 0.30, 0.30}

// PorteValues maps each porte code to its monetary value in BRL (CBHPM 2025/2026, Faixa Original).
var PorteValues = map[string]float64{
	"1A":  26.74,
	"1B":  53.48,
	"1C":  80.24,
	"2A":  107.00,
	"2B":  141.05,
	"2C":  166.92,
	"3A":  228.07,
	"3B":  291.50,
	"3C":  333.81,
	"4A":  397.28,
	"4B":  434.89,
	"4C":  491.33,
	"5A":  528.93,
	"5B":  571.23,
	"5C":  606.50,
	"6A":  660.57,
	"6B":  726.40,
	"6C":  794.57,
	"7A":  858.03,
	"7B":  949.71,
	"7C":  1123.65,
	"8A":  1212.99,
	"8B":  1271.77,
	"8C":  1349.35,
	"9A":  1433.97,
	"9B":  1567.97,
	"9C":  1727.81,
	"10A": 1854.75,
	"10B": 2009.91,
	"10C": 2230.89,
	"11A": 2360.17,
	"11B": 2588.21,
	"11C": 2839.74,
	"12A": 2943.18,
	"12B": 3164.15,
	"12C": 3876.43,
	"13A": 4266.66,
	"13B": 4680.39,
	"13C": 5176.41,
	"14A": 5768.81,
	"14B": 6276.59,
	"14C": 6922.36,
}

// Adjustment codes — valid values for the adjustments parameter.
const (
	AdjCodeEmergencySpecialHours         = "emergency_special_hours"
	AdjCodePediatricLowWeightOrPremature = "pediatric_low_weight_or_premature"
	AdjCodePediatricNeonateOrInfant      = "pediatric_neonate_or_infant"
	AdjCodePediatricChildUnder12         = "pediatric_child_under_12"
)

type adjMeta struct {
	label      string
	percentage float64
	source     string
}

// AdjustmentCatalog maps each valid adjustment code to its display metadata and percentage.
// Percentages are additive — two adjustments of 30% each sum to 60%, not 69% (1.3×1.3).
// Source: CBHPM 2022 Instruções Gerais.
var AdjustmentCatalog = map[string]adjMeta{
	AdjCodeEmergencySpecialHours: {
		label:      "Urgência/emergência em horário especial",
		percentage: 30.0,
		source:     "CBHPM 2022, Instruções Gerais, item 2",
	},
	AdjCodePediatricLowWeightOrPremature: {
		label:      "Criança < 2.500 g ou prematura < 37 semanas",
		percentage: 100.0,
		source:     "CBHPM 2022, Instruções Gerais, item 3",
	},
	AdjCodePediatricNeonateOrInfant: {
		label:      "Neonato/lactente — 0 a 24 meses",
		percentage: 50.0,
		source:     "CBHPM 2022, Instruções Gerais, item 3",
	},
	AdjCodePediatricChildUnder12: {
		label:      "Pediátrico — 24 meses completos a 12 anos incompletos",
		percentage: 30.0,
		source:     "CBHPM 2022, Instruções Gerais, item 3",
	},
}

// Calculate applies the validated CBHPM billing rules to a physician-assembled composition.
//
// Surgeon valuation (CBHPM 2022):
//   - Single procedure: 100% of its porte value.
//   - Same access route (item 4.1): principal porte + 50% × Σ(additional portes).
//   - Different access routes (item 4.2): principal porte + 70% × Σ(additional portes).
//
// Auxiliary valuation (CBHPM 2022, item 5.1, applied to the full surgeon total per item 5.2):
//   - 1st auxiliary: 60% of surgeon total.
//   - 2nd auxiliary: 40% of surgeon total.
//   - 3rd auxiliary: 30% of surgeon total.
//   - 4th auxiliary: 30% of surgeon total.
//
// CBHPM adjustments (Instruções Gerais):
//   - adjustments holds selected codes from AdjustmentCatalog.
//   - Percentages are summed additively; the total is applied as a single multiplier.
//   - Example: emergency (+30%) + pediatric child (+30%) = multiplier 1.60.
//   - Applies to surgeon, auxiliary, and anesthesiologist fees.
//   - surgeon_breakdown.surgeon_total always reflects the base CBHPM value (pre-adjustment)
//     for auditability.
//   - Unknown codes are silently skipped (protects against stale share URLs).
func Calculate(
	codes []models.SelectedCode,
	auxiliariesCount int,
	requiresAnesthesia bool,
	accessRoute models.AccessRouteType,
	adjustments []string,
) models.CalculationResult {
	// ── Step 1: resolve porte values and find the principal (highest value) ─────

	type entry struct {
		code  models.SelectedCode
		value float64
	}

	entries := make([]entry, len(codes))
	totalBase := 0.0
	principalIdx := 0

	for i, c := range codes {
		val := PorteValues[c.Porte]
		entries[i] = entry{code: c, value: val}
		totalBase += val
		if val > entries[principalIdx].value {
			principalIdx = i
		}
	}

	// ── Step 2: compute surgeon fee per CBHPM 4.1 / 4.2 ─────────────────────

	principalValue := entries[principalIdx].value

	additionalGross := 0.0
	for i, e := range entries {
		if i != principalIdx {
			additionalGross += e.value
		}
	}

	discountRate := discountRateFor(accessRoute, len(codes))
	additionalDiscounted := additionalGross * discountRate
	surgeonTotal := principalValue + additionalDiscounted

	surgeonBreakdown := models.SurgeonBreakdown{
		PrincipalValue:       principalValue,
		AdditionalGross:      additionalGross,
		DiscountRate:         discountRate,
		AdditionalDiscounted: additionalDiscounted,
		SurgeonTotal:         surgeonTotal,
	}

	// ── Step 3: build per-code breakdown ─────────────────────────────────────

	breakdown := make([]models.CodeBreakdown, len(entries))
	for i, e := range entries {
		breakdown[i] = models.CodeBreakdown{
			CBHPMCode:   e.code.CBHPMCode,
			Description: e.code.Description,
			Porte:       e.code.Porte,
			BaseValue:   e.value,
			IsPrincipal: i == principalIdx,
		}
	}

	// ── Step 4: auxiliary fees per CBHPM 5.1 applied to surgeon total (5.2) ──
	// Base aux fees are always computed from the pre-adjustment surgeon total.

	individualAuxFees := make([]models.AuxiliaryFee, 0, auxiliariesCount)
	auxTotal := 0.0

	for pos := 1; pos <= auxiliariesCount; pos++ {
		pct := auxPercentages[pos]
		fee := surgeonTotal * pct
		individualAuxFees = append(individualAuxFees, models.AuxiliaryFee{
			Position:   pos,
			Percentage: pct * 100,
			Fee:        fee,
		})
		auxTotal += fee
	}

	// ── Step 5: anesthesiologist ──────────────────────────────────────────────

	anesth := 0.0
	if requiresAnesthesia {
		anesth = anesthesiaFee
	}

	// ── Step 6: resolve CBHPM adjustments (additive percentage model) ────────
	// Percentages are summed first, then applied as a single multiplier so that
	// emergency(30%) + pediatric(30%) = ×1.60, not ×1.30×1.30.

	applied := make([]models.AppliedAdjustment, 0, len(adjustments))
	totalAdjPct := 0.0
	for _, code := range adjustments {
		meta, ok := AdjustmentCatalog[code]
		if !ok {
			continue // silently skip unknown/stale codes
		}
		applied = append(applied, models.AppliedAdjustment{
			Code:       code,
			Label:      meta.label,
			Percentage: meta.percentage,
			Source:     meta.source,
		})
		totalAdjPct += meta.percentage
	}

	multiplier := 1.0 + totalAdjPct/100.0

	// Base values (before any adjustment).
	baseSurgeon := surgeonTotal
	baseAux := auxTotal
	baseAnesth := anesth
	baseTeam := baseSurgeon + baseAux + baseAnesth

	adjValue := baseTeam * (totalAdjPct / 100.0)

	// Scale individual auxiliary fees when adjustments apply.
	finalAuxFees := individualAuxFees
	if totalAdjPct > 0 {
		scaled := make([]models.AuxiliaryFee, len(individualAuxFees))
		for i, af := range individualAuxFees {
			scaled[i] = models.AuxiliaryFee{
				Position:   af.Position,
				Percentage: af.Percentage,
				Fee:        af.Fee * multiplier,
			}
		}
		finalAuxFees = scaled
	}

	finalSurgeon := baseSurgeon * multiplier
	finalAux := baseAux * multiplier
	finalAnesth := baseAnesth * multiplier

	return models.CalculationResult{
		CodeBreakdown:             breakdown,
		AccessRouteType:           accessRoute,
		SurgeonBreakdown:          surgeonBreakdown,
		TotalBase:                 totalBase,
		BaseSurgeonValue:          baseSurgeon,
		BaseAuxiliaresTotalValue:  baseAux,
		BaseAnesthesiologistValue: baseAnesth,
		BaseTeamTotalValue:        baseTeam,
		SelectedAdjustments:       applied,
		TotalAdjustmentPercentage: totalAdjPct,
		AdjustmentValue:           adjValue,
		LeadSurgeonFee:            finalSurgeon,
		IndividualAuxFees:         finalAuxFees,
		AuxiliariesFee:            finalAux,
		AnesthesiologistFee:       finalAnesth,
		FinalTotal:                finalSurgeon + finalAux + finalAnesth,
	}
}

// discountRateFor returns the multiplier applied to additional procedures.
// With a single selected code there are no additional procedures, so the rate is 1.0
// (the full value is captured as the principal).
// CBHPM 4.1: same route → 0.50; CBHPM 4.2: different routes → 0.70.
func discountRateFor(route models.AccessRouteType, codeCount int) float64 {
	if codeCount <= 1 {
		return 1.0
	}
	if route == models.AccessRouteDifferent {
		return 0.70
	}
	return 0.50
}

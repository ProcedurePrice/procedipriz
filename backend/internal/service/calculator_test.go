package service_test

import (
	"math"
	"testing"

	"afere/backend/internal/models"
	"afere/backend/internal/service"
)

// round2 rounds to 2 decimal places for monetary comparisons.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// ── Single-procedure tests ────────────────────────────────────────────────────

// TestSingleProcedureNoAux verifies that a single CBHPM code with no auxiliaries
// produces surgeon_fee = porte_value, auxiliaries_fee = 0.
// Example: porte 7A = R$ 858.03 (CBHPM 2025/2026, Faixa Original).
func TestSingleProcedureNoAux(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "3.14.01.17-1", Description: "Microcirurgia vascular intracraniana", Porte: "14A"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	if result.LeadSurgeonFee != service.PorteValues["14A"] {
		t.Errorf("surgeon fee: got %.2f, want %.2f", result.LeadSurgeonFee, service.PorteValues["14A"])
	}
	if result.AuxiliariesFee != 0 {
		t.Errorf("aux fee: got %.2f, want 0", result.AuxiliariesFee)
	}
	if result.FinalTotal != result.LeadSurgeonFee {
		t.Errorf("final total: got %.2f, want %.2f", result.FinalTotal, result.LeadSurgeonFee)
	}
	if !result.CodeBreakdown[0].IsPrincipal {
		t.Error("single code must be flagged as principal")
	}
	if result.SurgeonBreakdown.AdditionalGross != 0 {
		t.Errorf("no additional codes: AdditionalGross should be 0, got %.2f", result.SurgeonBreakdown.AdditionalGross)
	}
}

// ── Same-route tests (CBHPM 4.1 — 50% on secondary codes) ───────────────────

// TestSameRouteTwoCodes validates CBHPM 4.1 with two codes.
// Principal: 14A = R$ 5,768.81
// Secondary: 11B = R$ 2,588.21
// Surgeon total = 5768.81 + 50% × 2588.21 = 5768.81 + 1294.105 = 7062.915
func TestSameRouteTwoCodes(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14A"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "11B"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	wantPrincipal := service.PorteValues["14A"] // 5768.81
	wantAdditional := service.PorteValues["11B"] // 2588.21
	wantSurgeonTotal := wantPrincipal + 0.50*wantAdditional

	if round2(result.LeadSurgeonFee) != round2(wantSurgeonTotal) {
		t.Errorf("surgeon fee: got %.4f, want %.4f", result.LeadSurgeonFee, wantSurgeonTotal)
	}
	if result.SurgeonBreakdown.DiscountRate != 0.50 {
		t.Errorf("discount rate: got %.2f, want 0.50", result.SurgeonBreakdown.DiscountRate)
	}
	if round2(result.SurgeonBreakdown.PrincipalValue) != round2(wantPrincipal) {
		t.Errorf("principal value: got %.2f, want %.2f", result.SurgeonBreakdown.PrincipalValue, wantPrincipal)
	}
	if round2(result.SurgeonBreakdown.AdditionalGross) != round2(wantAdditional) {
		t.Errorf("additional gross: got %.2f, want %.2f", result.SurgeonBreakdown.AdditionalGross, wantAdditional)
	}

	// Verify principal flag is on the higher-value code (14A)
	for _, cb := range result.CodeBreakdown {
		if cb.CBHPMCode == "A" && !cb.IsPrincipal {
			t.Error("code A (14A) must be flagged as principal")
		}
		if cb.CBHPMCode == "B" && cb.IsPrincipal {
			t.Error("code B (11B) must not be flagged as principal")
		}
	}
}

// TestSameRouteThreeCodes validates CBHPM 4.1 with three codes.
// Principal: 14C = R$ 6,922.36
// Secondary 1: 11B = R$ 2,588.21
// Secondary 2: 7A  = R$ 858.03
// Surgeon total = 6922.36 + 50% × (2588.21 + 858.03)
//
//	= 6922.36 + 50% × 3446.24
//	= 6922.36 + 1723.12 = 8645.48
func TestSameRouteThreeCodes(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14C"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "11B"},
		{CBHPMCode: "C", Description: "Proc C", Porte: "7A"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	p := service.PorteValues["14C"]
	s1 := service.PorteValues["11B"]
	s2 := service.PorteValues["7A"]
	want := p + 0.50*(s1+s2)

	if round2(result.LeadSurgeonFee) != round2(want) {
		t.Errorf("surgeon fee: got %.4f, want %.4f", result.LeadSurgeonFee, want)
	}
}

// ── Different-route tests (CBHPM 4.2 — 70% on secondary codes) ──────────────

// TestDifferentRouteTwoCodes validates CBHPM 4.2 with two codes.
// Principal: 14A = R$ 5,768.81
// Secondary: 11B = R$ 2,588.21
// Surgeon total = 5768.81 + 70% × 2588.21 = 5768.81 + 1811.747 = 7580.557
func TestDifferentRouteTwoCodes(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14A"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "11B"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteDifferent, nil)

	wantPrincipal := service.PorteValues["14A"]
	wantAdditional := service.PorteValues["11B"]
	wantSurgeonTotal := wantPrincipal + 0.70*wantAdditional

	if round2(result.LeadSurgeonFee) != round2(wantSurgeonTotal) {
		t.Errorf("surgeon fee: got %.4f, want %.4f", result.LeadSurgeonFee, wantSurgeonTotal)
	}
	if result.SurgeonBreakdown.DiscountRate != 0.70 {
		t.Errorf("discount rate: got %.2f, want 0.70", result.SurgeonBreakdown.DiscountRate)
	}
}

// TestDifferentRouteThreeCodes validates CBHPM 4.2 with three codes.
func TestDifferentRouteThreeCodes(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14C"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "11B"},
		{CBHPMCode: "C", Description: "Proc C", Porte: "7A"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteDifferent, nil)

	p := service.PorteValues["14C"]
	s1 := service.PorteValues["11B"]
	s2 := service.PorteValues["7A"]
	want := p + 0.70*(s1+s2)

	if round2(result.LeadSurgeonFee) != round2(want) {
		t.Errorf("surgeon fee: got %.4f, want %.4f", result.LeadSurgeonFee, want)
	}
}

// TestPrincipalSelectionPicksMaxValue verifies the engine always selects the
// highest-value code as the principal, regardless of input order.
func TestPrincipalSelectionPicksMaxValue(t *testing.T) {
	// Put the highest porte last
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Low", Porte: "2B"},
		{CBHPMCode: "B", Description: "High", Porte: "14C"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	for _, cb := range result.CodeBreakdown {
		if cb.CBHPMCode == "B" && !cb.IsPrincipal {
			t.Error("14C must be the principal (highest value)")
		}
		if cb.CBHPMCode == "A" && cb.IsPrincipal {
			t.Error("2B must not be the principal")
		}
	}
	if result.SurgeonBreakdown.PrincipalValue != service.PorteValues["14C"] {
		t.Errorf("principal value mismatch")
	}
}

// ── Auxiliary fee tests (CBHPM 5.1 – 60/40/30/30) ────────────────────────────

// TestAuxiliaryFeesSingleAux verifies 1st auxiliary = 60% of surgeon total.
func TestAuxiliaryFeesSingleAux(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc", Porte: "7A"},
	}
	result := service.Calculate(codes, 1, false, models.AccessRouteSame, nil)

	surgeonFee := service.PorteValues["7A"]
	want1stAux := surgeonFee * 0.60

	if len(result.IndividualAuxFees) != 1 {
		t.Fatalf("expected 1 aux fee entry, got %d", len(result.IndividualAuxFees))
	}
	if round2(result.IndividualAuxFees[0].Fee) != round2(want1stAux) {
		t.Errorf("1st aux fee: got %.2f, want %.2f", result.IndividualAuxFees[0].Fee, want1stAux)
	}
	if result.IndividualAuxFees[0].Percentage != 60.0 {
		t.Errorf("1st aux percentage: got %.1f, want 60.0", result.IndividualAuxFees[0].Percentage)
	}
	if result.IndividualAuxFees[0].Position != 1 {
		t.Errorf("1st aux position: got %d, want 1", result.IndividualAuxFees[0].Position)
	}
}

// TestAuxiliaryFeesFourAux verifies the full 60/40/30/30 schedule.
func TestAuxiliaryFeesFourAux(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc", Porte: "7A"},
	}
	result := service.Calculate(codes, 4, false, models.AccessRouteSame, nil)

	base := service.PorteValues["7A"]
	wantPcts := []float64{60.0, 40.0, 30.0, 30.0}
	wantFees := []float64{base * 0.60, base * 0.40, base * 0.30, base * 0.30}

	if len(result.IndividualAuxFees) != 4 {
		t.Fatalf("expected 4 aux fee entries, got %d", len(result.IndividualAuxFees))
	}
	for i, af := range result.IndividualAuxFees {
		if af.Position != i+1 {
			t.Errorf("aux[%d] position: got %d, want %d", i, af.Position, i+1)
		}
		if af.Percentage != wantPcts[i] {
			t.Errorf("aux[%d] percentage: got %.1f, want %.1f", i, af.Percentage, wantPcts[i])
		}
		if round2(af.Fee) != round2(wantFees[i]) {
			t.Errorf("aux[%d] fee: got %.2f, want %.2f", i, af.Fee, wantFees[i])
		}
	}
}

// TestAuxiliaryFeesAppliedToSurgeonTotal verifies CBHPM 5.2:
// aux fees are calculated on the discounted surgeon total, not on total_base.
func TestAuxiliaryFeesAppliedToSurgeonTotal(t *testing.T) {
	// Two codes, same route: surgeon total = 14A + 50%×7A, not 14A+7A
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "High", Porte: "14A"},
		{CBHPMCode: "B", Description: "Low", Porte: "7A"},
	}
	result := service.Calculate(codes, 1, false, models.AccessRouteSame, nil)

	surgeonTotal := service.PorteValues["14A"] + 0.50*service.PorteValues["7A"]
	want1stAux := surgeonTotal * 0.60

	if round2(result.IndividualAuxFees[0].Fee) != round2(want1stAux) {
		t.Errorf(
			"1st aux fee should be %.2f (60%% of surgeon total %.2f), got %.2f",
			want1stAux, surgeonTotal, result.IndividualAuxFees[0].Fee,
		)
	}
}

// ── Anesthesia test ───────────────────────────────────────────────────────────

// TestAnesthesiaFee verifies the fixed anesthesiologist fee is correctly added.
func TestAnesthesiaFee(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc", Porte: "7A"},
	}
	withAnesth := service.Calculate(codes, 0, true, models.AccessRouteSame, nil)
	without := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	diff := withAnesth.FinalTotal - without.FinalTotal
	if round2(diff) != 1200.00 {
		t.Errorf("anesthesia delta: got %.2f, want 1200.00", diff)
	}
	if withAnesth.AnesthesiologistFee != 1200.00 {
		t.Errorf("AnesthesiologistFee: got %.2f, want 1200.00", withAnesth.AnesthesiologistFee)
	}
	if without.AnesthesiologistFee != 0 {
		t.Errorf("AnesthesiologistFee without flag: got %.2f, want 0", without.AnesthesiologistFee)
	}
}

// ── Total consistency tests ───────────────────────────────────────────────────

// TestFinalTotalConsistency verifies final_total = surgeon + aux + anesthesia.
func TestFinalTotalConsistency(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14A"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "11B"},
	}
	result := service.Calculate(codes, 3, true, models.AccessRouteDifferent, nil)

	want := result.LeadSurgeonFee + result.AuxiliariesFee + result.AnesthesiologistFee
	if round2(result.FinalTotal) != round2(want) {
		t.Errorf("final_total mismatch: got %.4f, want %.4f", result.FinalTotal, want)
	}
}

// TestAuxiliariesFeeIsSum verifies auxiliaries_fee equals sum of individual fees.
func TestAuxiliariesFeeIsSum(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc", Porte: "7A"},
	}
	result := service.Calculate(codes, 4, false, models.AccessRouteSame, nil)

	sum := 0.0
	for _, af := range result.IndividualAuxFees {
		sum += af.Fee
	}
	if round2(result.AuxiliariesFee) != round2(sum) {
		t.Errorf("auxiliaries_fee: got %.4f, want sum %.4f", result.AuxiliariesFee, sum)
	}
}

// TestTotalBaseIsSimpleSum verifies total_base is always the raw sum (no discounting).
func TestTotalBaseIsSimpleSum(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14A"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "7A"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	want := service.PorteValues["14A"] + service.PorteValues["7A"]
	if round2(result.TotalBase) != round2(want) {
		t.Errorf("TotalBase: got %.2f, want %.2f", result.TotalBase, want)
	}
}

// TestSameVsDifferentRouteProducesHigherFeeForDifferent verifies that different-route
// access always produces a higher or equal surgeon fee than same-route for identical codes.
func TestSameVsDifferentRouteProducesHigherFeeForDifferent(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc A", Porte: "14A"},
		{CBHPMCode: "B", Description: "Proc B", Porte: "11B"},
	}
	same := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)
	diff := service.Calculate(codes, 0, false, models.AccessRouteDifferent, nil)

	if diff.LeadSurgeonFee <= same.LeadSurgeonFee {
		t.Errorf(
			"different-route fee (%.2f) should exceed same-route fee (%.2f)",
			diff.LeadSurgeonFee, same.LeadSurgeonFee,
		)
	}
}

// TestNoAuxProducesEmptyAuxSlice verifies zero auxiliaries yields an empty slice, not nil.
func TestNoAuxProducesEmptyAuxSlice(t *testing.T) {
	codes := []models.SelectedCode{
		{CBHPMCode: "A", Description: "Proc", Porte: "7A"},
	}
	result := service.Calculate(codes, 0, false, models.AccessRouteSame, nil)

	if result.IndividualAuxFees == nil {
		t.Error("IndividualAuxFees should be an empty slice, not nil")
	}
	if len(result.IndividualAuxFees) != 0 {
		t.Errorf("expected 0 aux fees, got %d", len(result.IndividualAuxFees))
	}
	if result.AuxiliariesFee != 0 {
		t.Errorf("auxiliaries_fee should be 0, got %.2f", result.AuxiliariesFee)
	}
}

// ── CBHPM adjustment tests ────────────────────────────────────────────────────

var adjCodes = []models.SelectedCode{
	{CBHPMCode: "A", Description: "Proc", Porte: "7A"},
}

// TestNoAdjustments verifies that an empty adjustments list produces no surcharge.
func TestNoAdjustments(t *testing.T) {
	result := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)

	if len(result.SelectedAdjustments) != 0 {
		t.Errorf("expected 0 selected adjustments, got %d", len(result.SelectedAdjustments))
	}
	if result.TotalAdjustmentPercentage != 0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 0", result.TotalAdjustmentPercentage)
	}
	if result.AdjustmentValue != 0 {
		t.Errorf("AdjustmentValue: got %.2f, want 0", result.AdjustmentValue)
	}
	if result.BaseSurgeonValue != result.LeadSurgeonFee {
		t.Errorf("base and final surgeon fee should be equal without adjustments")
	}
}

// TestEmergencyAdjustmentOnly verifies +30% applied to all medical fees.
func TestEmergencyAdjustmentOnly(t *testing.T) {
	base := service.Calculate(adjCodes, 1, true, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 1, true, models.AccessRouteSame,
		[]string{service.AdjCodeEmergencySpecialHours})

	if withAdj.TotalAdjustmentPercentage != 30.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 30.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.LeadSurgeonFee) != round2(base.LeadSurgeonFee*1.30) {
		t.Errorf("surgeon fee: got %.2f, want %.2f", withAdj.LeadSurgeonFee, base.LeadSurgeonFee*1.30)
	}
	if round2(withAdj.AuxiliariesFee) != round2(base.AuxiliariesFee*1.30) {
		t.Errorf("aux fee: got %.2f, want %.2f", withAdj.AuxiliariesFee, base.AuxiliariesFee*1.30)
	}
	if round2(withAdj.AnesthesiologistFee) != round2(base.AnesthesiologistFee*1.30) {
		t.Errorf("anesth fee: got %.2f, want %.2f", withAdj.AnesthesiologistFee, base.AnesthesiologistFee*1.30)
	}
	if round2(withAdj.FinalTotal) != round2(base.FinalTotal*1.30) {
		t.Errorf("final total: got %.2f, want %.2f", withAdj.FinalTotal, base.FinalTotal*1.30)
	}
}

// TestPediatricLowWeightAdjustmentOnly verifies +100% applied to all medical fees.
func TestPediatricLowWeightAdjustmentOnly(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodePediatricLowWeightOrPremature})

	if withAdj.TotalAdjustmentPercentage != 100.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 100.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.LeadSurgeonFee) != round2(base.LeadSurgeonFee*2.0) {
		t.Errorf("surgeon fee: got %.2f, want %.2f", withAdj.LeadSurgeonFee, base.LeadSurgeonFee*2.0)
	}
}

// TestPediatricNeonateAdjustmentOnly verifies +50% applied to all medical fees.
func TestPediatricNeonateAdjustmentOnly(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodePediatricNeonateOrInfant})

	if withAdj.TotalAdjustmentPercentage != 50.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 50.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.LeadSurgeonFee) != round2(base.LeadSurgeonFee*1.50) {
		t.Errorf("surgeon fee: got %.2f, want %.2f", withAdj.LeadSurgeonFee, base.LeadSurgeonFee*1.50)
	}
}

// TestPediatricChildAdjustmentOnly verifies +30% applied to all medical fees.
func TestPediatricChildAdjustmentOnly(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodePediatricChildUnder12})

	if withAdj.TotalAdjustmentPercentage != 30.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 30.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.LeadSurgeonFee) != round2(base.LeadSurgeonFee*1.30) {
		t.Errorf("surgeon fee: got %.2f, want %.2f", withAdj.LeadSurgeonFee, base.LeadSurgeonFee*1.30)
	}
}

// TestEmergencyPlusPediatricChildAdditive verifies additive model: +30% + +30% = ×1.60 (not ×1.30×1.30).
func TestEmergencyPlusPediatricChildAdditive(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodeEmergencySpecialHours, service.AdjCodePediatricChildUnder12})

	if withAdj.TotalAdjustmentPercentage != 60.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 60.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.LeadSurgeonFee) != round2(base.LeadSurgeonFee*1.60) {
		t.Errorf("surgeon fee: got %.2f, want %.2f (must be additive ×1.60, not multiplicative ×1.69)",
			withAdj.LeadSurgeonFee, base.LeadSurgeonFee*1.60)
	}
}

// TestEmergencyPlusNeonateAdditive verifies +30% + +50% = ×1.80.
func TestEmergencyPlusNeonateAdditive(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodeEmergencySpecialHours, service.AdjCodePediatricNeonateOrInfant})

	if withAdj.TotalAdjustmentPercentage != 80.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 80.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.FinalTotal) != round2(base.FinalTotal*1.80) {
		t.Errorf("final total: got %.2f, want %.2f", withAdj.FinalTotal, base.FinalTotal*1.80)
	}
}

// TestEmergencyPlusLowWeightAdditive verifies +30% + +100% = ×2.30.
func TestEmergencyPlusLowWeightAdditive(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodeEmergencySpecialHours, service.AdjCodePediatricLowWeightOrPremature})

	if withAdj.TotalAdjustmentPercentage != 130.0 {
		t.Errorf("TotalAdjustmentPercentage: got %.1f, want 130.0", withAdj.TotalAdjustmentPercentage)
	}
	if round2(withAdj.FinalTotal) != round2(base.FinalTotal*2.30) {
		t.Errorf("final total: got %.2f, want %.2f", withAdj.FinalTotal, base.FinalTotal*2.30)
	}
}

// TestUnknownAdjustmentCodeIgnored verifies unknown codes do not cause errors or change totals.
func TestUnknownAdjustmentCodeIgnored(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withUnknown := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{"unknown_code_xyz", "another_fake_code"})

	if withUnknown.TotalAdjustmentPercentage != 0 {
		t.Errorf("unknown codes should not affect TotalAdjustmentPercentage, got %.1f", withUnknown.TotalAdjustmentPercentage)
	}
	if round2(withUnknown.FinalTotal) != round2(base.FinalTotal) {
		t.Errorf("unknown codes should not change FinalTotal: got %.2f, want %.2f",
			withUnknown.FinalTotal, base.FinalTotal)
	}
	if len(withUnknown.SelectedAdjustments) != 0 {
		t.Errorf("unknown codes should not appear in SelectedAdjustments")
	}
}

// TestAdjustmentAppliesToAuxiliaries verifies aux fees scale by the full multiplier.
func TestAdjustmentAppliesToAuxiliaries(t *testing.T) {
	base := service.Calculate(adjCodes, 2, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 2, false, models.AccessRouteSame,
		[]string{service.AdjCodePediatricNeonateOrInfant})

	for i, af := range withAdj.IndividualAuxFees {
		want := round2(base.IndividualAuxFees[i].Fee * 1.50)
		if round2(af.Fee) != want {
			t.Errorf("aux[%d] fee: got %.2f, want %.2f", i, af.Fee, want)
		}
	}
}

// TestAdjustmentAppliesToAnesthesiologist verifies anesthesiologist fee scales by the multiplier.
func TestAdjustmentAppliesToAnesthesiologist(t *testing.T) {
	base := service.Calculate(adjCodes, 0, true, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, true, models.AccessRouteSame,
		[]string{service.AdjCodePediatricLowWeightOrPremature})

	want := round2(base.AnesthesiologistFee * 2.0)
	if round2(withAdj.AnesthesiologistFee) != want {
		t.Errorf("anesthesiologist fee: got %.2f, want %.2f", withAdj.AnesthesiologistFee, want)
	}
}

// TestBaseSurgeonBreakdownUnchangedByAdjustments verifies surgeon_breakdown.surgeon_total
// is always the pre-adjustment CBHPM value, preserving the audit trail.
func TestBaseSurgeonBreakdownUnchangedByAdjustments(t *testing.T) {
	base := service.Calculate(adjCodes, 0, false, models.AccessRouteSame, nil)
	withAdj := service.Calculate(adjCodes, 0, false, models.AccessRouteSame,
		[]string{service.AdjCodeEmergencySpecialHours, service.AdjCodePediatricChildUnder12})

	if round2(withAdj.SurgeonBreakdown.SurgeonTotal) != round2(base.SurgeonBreakdown.SurgeonTotal) {
		t.Errorf("surgeon_breakdown.surgeon_total should be unchanged by adjustments: got %.2f, want %.2f",
			withAdj.SurgeonBreakdown.SurgeonTotal, base.SurgeonBreakdown.SurgeonTotal)
	}
}

// TestBaseValuesMatchFinalWhenNoAdjustments verifies base_* fields equal adjusted fields
// when no adjustments are selected.
func TestBaseValuesMatchFinalWhenNoAdjustments(t *testing.T) {
	result := service.Calculate(adjCodes, 1, true, models.AccessRouteSame, nil)

	if result.BaseSurgeonValue != result.LeadSurgeonFee {
		t.Errorf("base surgeon ≠ final surgeon without adjustments: %.2f vs %.2f",
			result.BaseSurgeonValue, result.LeadSurgeonFee)
	}
	if result.BaseAuxiliaresTotalValue != result.AuxiliariesFee {
		t.Errorf("base aux ≠ final aux without adjustments")
	}
	if result.BaseAnesthesiologistValue != result.AnesthesiologistFee {
		t.Errorf("base anesth ≠ final anesth without adjustments")
	}
	if result.BaseTeamTotalValue != result.FinalTotal {
		t.Errorf("base team ≠ final total without adjustments: %.2f vs %.2f",
			result.BaseTeamTotalValue, result.FinalTotal)
	}
}

// TestAdjustmentValueField verifies adjustment_value = base_team_total × (totalPct / 100).
func TestAdjustmentValueField(t *testing.T) {
	result := service.Calculate(adjCodes, 1, true, models.AccessRouteSame,
		[]string{service.AdjCodeEmergencySpecialHours})

	wantAdjValue := round2(result.BaseTeamTotalValue * 0.30)
	if round2(result.AdjustmentValue) != wantAdjValue {
		t.Errorf("AdjustmentValue: got %.2f, want %.2f", result.AdjustmentValue, wantAdjValue)
	}
}

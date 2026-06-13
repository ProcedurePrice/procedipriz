// Package generated contains hand-written types matching openapi.yaml v3.1.0.
// Regenerate with oapi-codegen when the generator is wired into CI.
package generated

import (
	"encoding/json"
	"time"
)

// HealthResponse is returned by GET /api/health.
type HealthResponse struct {
	Status string `json:"status"`
}

// SBNProcedureResult is one item in the search results list.
type SBNProcedureResult struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CBHPMCodeEntry is a single CBHPM code within a procedure package.
// The porte is read-only — it is defined by the SBN catalog, not editable by the physician.
type CBHPMCodeEntry struct {
	Code           string `json:"code"`
	Description    string `json:"description"`
	Porte          string `json:"porte"`
	NumAuxiliaries int    `json:"num_auxiliaries"`
}

// ProcedureDetail is returned by GET /api/procedures/:id.
type ProcedureDetail struct {
	ID         string           `json:"id"`
	Name       string           `json:"name"`
	CBHPMCodes []CBHPMCodeEntry `json:"cbhpm_codes"`
}

// AccessRouteType indicates whether multiple procedures share the same access route.
// "same" triggers CBHPM 4.1 (50% on secondary), "different" triggers CBHPM 4.2 (70% on secondary).
type AccessRouteType string

const (
	AccessRouteSame      AccessRouteType = "same"
	AccessRouteDifferent AccessRouteType = "different"
)

// SelectedCode is one physician-chosen code in a calculate request.
// The porte is fixed by the catalog; the physician can only select or deselect a code.
type SelectedCode struct {
	CBHPMCode   string `json:"cbhpm_code"`
	Description string `json:"description"`
	Porte       string `json:"porte"`
}

// CalculateRequest is the body for POST /api/calculate.
type CalculateRequest struct {
	SelectedCodes      []SelectedCode  `json:"selected_codes"`
	AuxiliariesCount   int             `json:"auxiliaries_count"`
	RequiresAnesthesia bool            `json:"requires_anesthesia"`
	AccessRouteType    AccessRouteType `json:"access_route_type"`
	// Adjustments holds selected CBHPM adjustment codes applied additively.
	// Valid codes: emergency_special_hours, pediatric_low_weight_or_premature,
	// pediatric_neonate_or_infant, pediatric_child_under_12.
	Adjustments []string `json:"adjustments,omitempty"`
}

// CodeBreakdown is the per-code contribution in the calculation result.
type CodeBreakdown struct {
	CBHPMCode   string  `json:"cbhpm_code"`
	Description string  `json:"description"`
	Porte       string  `json:"porte"`
	BaseValue   float64 `json:"base_value"`
	IsPrincipal bool    `json:"is_principal"`
}

// SurgeonBreakdown shows the step-by-step CBHPM 4.1/4.2 composition for the lead surgeon fee.
// surgeon_total is always the pre-adjustment value, preserving the CBHPM audit trail.
type SurgeonBreakdown struct {
	PrincipalValue       float64 `json:"principal_value"`
	AdditionalGross      float64 `json:"additional_gross"`
	DiscountRate         float64 `json:"discount_rate"`
	AdditionalDiscounted float64 `json:"additional_discounted"`
	SurgeonTotal         float64 `json:"surgeon_total"`
}

// AuxiliaryFee is the individual fee for one auxiliary surgeon (CBHPM 5.1).
type AuxiliaryFee struct {
	Position   int     `json:"position"`
	Percentage float64 `json:"percentage"`
	Fee        float64 `json:"fee"`
}

// AppliedAdjustment is one CBHPM percentage adjustment included in a calculation.
type AppliedAdjustment struct {
	Code       string  `json:"code"`
	Label      string  `json:"label"`
	Percentage float64 `json:"percentage"`
	Source     string  `json:"source"`
}

// CalculateResponse is returned by POST /api/calculate.
//
// Base values reflect pre-adjustment CBHPM medical remuneration.
// The final values (lead_surgeon_fee, auxiliaries_fee, anesthesiologist_fee, final_total)
// equal base values × (1 + total_adjustment_percentage/100). When adjustments is empty
// base and final values are identical.
type CalculateResponse struct {
	CodeBreakdown    []CodeBreakdown  `json:"code_breakdown"`
	AccessRouteType  AccessRouteType  `json:"access_route_type"`
	SurgeonBreakdown SurgeonBreakdown `json:"surgeon_breakdown"`
	TotalBase        float64          `json:"total_base"`

	// Base medical remuneration (pre-adjustment).
	BaseSurgeonValue          float64 `json:"base_surgeon_value"`
	BaseAuxiliaresTotalValue  float64 `json:"base_auxiliaries_total_value"`
	BaseAnesthesiologistValue float64 `json:"base_anesthesiologist_value"`
	BaseTeamTotalValue        float64 `json:"base_team_total_value"`

	// Adjustment summary.
	SelectedAdjustments       []AppliedAdjustment `json:"selected_adjustments"`
	TotalAdjustmentPercentage float64             `json:"total_adjustment_percentage"`
	AdjustmentValue           float64             `json:"adjustment_value"`

	// Final (adjusted) values.
	LeadSurgeonFee      float64        `json:"lead_surgeon_fee"`
	IndividualAuxFees   []AuxiliaryFee `json:"individual_auxiliary_fees"`
	AuxiliariesFee      float64        `json:"auxiliaries_fee"`
	AnesthesiologistFee float64        `json:"anesthesiologist_fee"`
	FinalTotal          float64        `json:"final_total"`
}

// ─── Composition types (primary persistence model) ───────────────────────────

// SaveCompositionRequest is the body for POST /api/compositions.
type SaveCompositionRequest struct {
	Name               string          `json:"name"`
	SBNProcedureID     string          `json:"sbn_procedure_id,omitempty"`
	SBNProcedureName   string          `json:"sbn_procedure_name"`
	SelectedCodes      []SelectedCode  `json:"selected_codes"`
	AccessRouteType    AccessRouteType `json:"access_route_type"`
	AuxiliariesCount   int             `json:"auxiliaries_count"`
	RequiresAnesthesia bool            `json:"requires_anesthesia"`
	Adjustments        []string        `json:"adjustments,omitempty"`
}

// UpdateCompositionRequest is the body for PUT /api/compositions/{id}.
type UpdateCompositionRequest struct {
	Name               string          `json:"name"`
	SBNProcedureID     string          `json:"sbn_procedure_id,omitempty"`
	SBNProcedureName   string          `json:"sbn_procedure_name"`
	SelectedCodes      []SelectedCode  `json:"selected_codes"`
	AccessRouteType    AccessRouteType `json:"access_route_type"`
	AuxiliariesCount   int             `json:"auxiliaries_count"`
	RequiresAnesthesia bool            `json:"requires_anesthesia"`
	Adjustments        []string        `json:"adjustments,omitempty"`
}

// SaveCompositionResponse is returned by a successful POST /api/compositions.
type SaveCompositionResponse struct {
	PublicID  string    `json:"public_id"`
	CreatedAt time.Time `json:"created_at"`
}

// CompositionItem is one entry in the GET /api/compositions list response.
type CompositionItem struct {
	PublicID           string          `json:"public_id"`
	Name               string          `json:"name"`
	SBNProcedureID     string          `json:"sbn_procedure_id,omitempty"`
	SBNProcedureName   string          `json:"sbn_procedure_name"`
	AccessRouteType    AccessRouteType `json:"access_route_type"`
	AuxiliariesCount   int             `json:"auxiliaries_count"`
	RequiresAnesthesia bool            `json:"requires_anesthesia"`
	CreatedAt          time.Time       `json:"created_at"`
}

// CompositionDetail is the full composition returned by GET /api/compositions/{id}.
type CompositionDetail struct {
	PublicID           string          `json:"public_id"`
	Name               string          `json:"name"`
	SBNProcedureID     string          `json:"sbn_procedure_id,omitempty"`
	SBNProcedureName   string          `json:"sbn_procedure_name"`
	SelectedCodes      []SelectedCode  `json:"selected_codes"`
	AccessRouteType    AccessRouteType `json:"access_route_type"`
	AuxiliariesCount   int             `json:"auxiliaries_count"`
	RequiresAnesthesia bool            `json:"requires_anesthesia"`
	Adjustments        []string        `json:"adjustments"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

// ─── Calculation persistence types (legacy snapshot) ─────────────────────────

// SaveCalculationRequest is the body for POST /api/calculations.
// calculation_result must be a completed valuation (lead_surgeon_fee > 0).
type SaveCalculationRequest struct {
	ProcedureName      string            `json:"procedure_name"`
	ProcedureSBNCode   string            `json:"procedure_sbn_code,omitempty"`
	SelectedCodes      []SelectedCode    `json:"selected_codes"`
	AuxiliariesCount   int               `json:"auxiliaries_count"`
	RequiresAnesthesia bool              `json:"requires_anesthesia"`
	AccessRouteType    AccessRouteType   `json:"access_route_type"`
	CalculationResult  CalculateResponse `json:"calculation_result"`
}

// SaveCalculationResponse is returned by a successful POST /api/calculations.
// Only the public_id is exposed; use it to construct the shareable URL (/calc/{public_id}).
type SaveCalculationResponse struct {
	PublicID  string    `json:"public_id"`
	CreatedAt time.Time `json:"created_at"`
}

// CalculationSummary is one item in the GET /api/calculations list response.
// It omits selected codes and the full breakdown JSON to keep the payload compact.
type CalculationSummary struct {
	PublicID              string          `json:"public_id"`
	ProcedureName         string          `json:"procedure_name"`
	ProcedureSBNCode      string          `json:"procedure_sbn_code,omitempty"`
	SurgeonValue          float64         `json:"surgeon_value"`
	AuxiliariesTotalValue float64         `json:"auxiliaries_total_value"`
	AnesthesiologistValue float64         `json:"anesthesiologist_value"`
	TeamTotalValue        float64         `json:"team_total_value"`
	AuxiliariesCount      int             `json:"auxiliaries_count"`
	RequiresAnesthesia    bool            `json:"requires_anesthesia"`
	AccessRouteType       AccessRouteType `json:"access_route_type"`
	CreatedAt             time.Time       `json:"created_at"`
}

// SavedCalculation is returned by GET /api/calculations/{id}.
// CalculationBreakdown is the original CalculateResponse JSON, preserved verbatim for auditing.
// The internal database primary key is never included in this response.
type SavedCalculation struct {
	PublicID              string          `json:"public_id"`
	ProcedureName         string          `json:"procedure_name"`
	ProcedureSBNCode      string          `json:"procedure_sbn_code,omitempty"`
	SelectedCBHPMCodes    []SelectedCode  `json:"selected_cbhpm_codes"`
	AccessRouteType       AccessRouteType `json:"access_route_type"`
	AuxiliariesCount      int             `json:"auxiliaries_count"`
	RequiresAnesthesia    bool            `json:"requires_anesthesia"`
	SurgeonValue          float64         `json:"surgeon_value"`
	AuxiliariesTotalValue float64         `json:"auxiliaries_total_value"`
	AnesthesiologistValue float64         `json:"anesthesiologist_value"`
	TeamTotalValue        float64         `json:"team_total_value"`
	CalculationBreakdown  json.RawMessage `json:"calculation_breakdown"`
	CreatedAt             time.Time       `json:"created_at"`
}

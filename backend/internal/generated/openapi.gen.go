// Package generated contains hand-written types matching openapi.yaml v3.0.0.
// Regenerate with oapi-codegen when the generator is wired into CI.
package generated

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

// CalculateResponse is returned by POST /api/calculate.
type CalculateResponse struct {
	CodeBreakdown         []CodeBreakdown `json:"code_breakdown"`
	AccessRouteType       AccessRouteType `json:"access_route_type"`
	SurgeonBreakdown      SurgeonBreakdown `json:"surgeon_breakdown"`
	LeadSurgeonFee        float64          `json:"lead_surgeon_fee"`
	IndividualAuxFees     []AuxiliaryFee   `json:"individual_auxiliary_fees"`
	AuxiliariesFee        float64          `json:"auxiliaries_fee"`
	AnesthesiologistFee   float64          `json:"anesthesiologist_fee"`
	FinalTotal            float64          `json:"final_total"`
	TotalBase             float64          `json:"total_base"`
}

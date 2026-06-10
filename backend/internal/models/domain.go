// Package models defines the core domain types for the Afere platform.
package models

// SBNProcedure represents a procedure package as defined in the SBN manual.
// One SBN procedure aggregates one or more CBHPM codes.
type SBNProcedure struct {
	ID   string
	Name string
}

// CBHPMCode is a single billable code from the CBHPM catalog,
// annotated with the default porte assigned by the SBN manual for this procedure package.
// The porte is an intrinsic property of the code (CBHPM 2022, item 1.2) and is not editable.
type CBHPMCode struct {
	Code           string
	Description    string
	Porte          string
	NumAuxiliaries int
}

// ProcedureWithCodes is an SBN procedure together with its associated CBHPM codes.
type ProcedureWithCodes struct {
	SBNProcedure
	Codes []CBHPMCode
}

// AccessRouteType encodes the CBHPM 4.1/4.2 access route classification.
type AccessRouteType string

const (
	// AccessRouteSame applies CBHPM 4.1: principal porte + 50% of each additional porte.
	AccessRouteSame AccessRouteType = "same"
	// AccessRouteDifferent applies CBHPM 4.2: principal porte + 70% of each additional porte.
	AccessRouteDifferent AccessRouteType = "different"
)

// SelectedCode is a CBHPM code chosen by the physician.
// The porte is taken from the catalog and cannot be changed by the physician.
type SelectedCode struct {
	CBHPMCode   string
	Description string
	Porte       string
}

// CodeBreakdown is the per-code contribution in a valuation result.
type CodeBreakdown struct {
	CBHPMCode   string
	Description string
	Porte       string
	BaseValue   float64
	IsPrincipal bool
}

// SurgeonBreakdown contains the step-by-step surgeon fee derivation per CBHPM 4.1/4.2.
type SurgeonBreakdown struct {
	PrincipalValue       float64
	AdditionalGross      float64
	DiscountRate         float64
	AdditionalDiscounted float64
	SurgeonTotal         float64
}

// AuxiliaryFee is the individual fee for one auxiliary surgeon per CBHPM 5.1.
type AuxiliaryFee struct {
	Position   int
	Percentage float64
	Fee        float64
}

// CalculationResult is the full output of the valuation engine.
type CalculationResult struct {
	CodeBreakdown       []CodeBreakdown
	AccessRouteType     AccessRouteType
	SurgeonBreakdown    SurgeonBreakdown
	LeadSurgeonFee      float64
	IndividualAuxFees   []AuxiliaryFee
	AuxiliariesFee      float64
	AnesthesiologistFee float64
	FinalTotal          float64
	TotalBase           float64
}

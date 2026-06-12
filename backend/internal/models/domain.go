// Package models defines the core domain types for the Afere platform.
package models

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"time"
)

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
	// CBHPM item 2 urgency/emergency surcharge (30% on all medical fees).
	UrgencyEmergencyApplied    bool
	UrgencyEmergencyPercentage float64 // 30.0 when applied
	UrgencyEmergencyValue      float64 // absolute value of the surcharge
}

// Calculation is a persisted valuation record.
// BreakdownJSON holds the full CalculateResponse JSON for audit purposes.
// The schema is designed for a future Calculation → User foreign key (migration 006).
type Calculation struct {
	ID                    string
	PublicID              string
	ProcedureName         string
	ProcedureSBNCode      string
	SelectedCBHPMCodes    []SelectedCode
	AccessRoute           AccessRouteType
	AuxiliariesCount      int
	RequiresAnesthesia    bool
	SurgeonValue          float64
	AuxiliariesTotalValue float64
	AnesthesiologistValue float64
	TeamTotalValue        float64
	BreakdownJSON         json.RawMessage
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

// CalculationSummary is a lightweight projection of Calculation used in list responses.
// It omits selected codes and the full breakdown JSON to keep list payloads small.
type CalculationSummary struct {
	PublicID              string
	ProcedureName         string
	ProcedureSBNCode      string
	SurgeonValue          float64
	AuxiliariesTotalValue float64
	AnesthesiologistValue float64
	TeamTotalValue        float64
	AuxiliariesCount      int
	RequiresAnesthesia    bool
	AccessRoute           AccessRouteType
	CreatedAt             time.Time
}

// PhysicianAccount maps a Clerk identity to an Afere physician record.
// The internal id is the FK used in compositions; clerk_user_id is the JWT sub.
type PhysicianAccount struct {
	ID          string
	ClerkUserID string
	Email       string
	Name        string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Composition is a reusable surgical template created by the physician.
// It captures the procedural setup — SBN procedure, selected CBHPM codes,
// access route, anesthesia, and auxiliary count — without storing any
// financial values. Values are always recalculated fresh when executed.
type Composition struct {
	ID                 string
	PublicID           string
	PhysicianID        string // internal UUID from physician_accounts; empty only in legacy rows
	Name               string
	SBNProcedureID     string
	SBNProcedureName   string
	SelectedCodes      []SelectedCode
	AccessRouteType    AccessRouteType
	AuxiliariesCount   int
	RequiresAnesthesia bool
	// UrgencyEmergency signals CBHPM item 2 — 30% surcharge on medical fees.
	UrgencyEmergency bool
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// CompositionSummary is the lightweight projection for list responses.
type CompositionSummary struct {
	PublicID           string
	Name               string
	SBNProcedureID     string
	SBNProcedureName   string
	AccessRouteType    AccessRouteType
	AuxiliariesCount   int
	RequiresAnesthesia bool
	CreatedAt          time.Time
}

// GeneratePublicID returns a UUID v4 string for use in public-facing URLs
// (e.g. /calc/7f3a9e2c-5c3d-4f35-a8db-1f6f8c3d7e11).
// The internal database primary key is separate; only public_id is ever exposed externally.
func GeneratePublicID() (string, error) {
	var uuid [16]byte
	if _, err := rand.Read(uuid[:]); err != nil {
		return "", fmt.Errorf("generate public id: %w", err)
	}
	uuid[6] = (uuid[6] & 0x0f) | 0x40 // version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // variant bits (RFC 4122)
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16]), nil
}

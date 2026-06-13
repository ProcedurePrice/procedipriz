package handlers

import (
	"encoding/json"
	"net/http"

	"afere/backend/internal/generated"
	"afere/backend/internal/models"
	"afere/backend/internal/service"
)

func calculateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req generated.CalculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}

	if len(req.SelectedCodes) == 0 {
		http.Error(w, "selected_codes must not be empty", http.StatusBadRequest)
		return
	}
	if req.AuxiliariesCount < 0 || req.AuxiliariesCount > 4 {
		http.Error(w, "auxiliaries_count must be between 0 and 4", http.StatusBadRequest)
		return
	}
	if req.AccessRouteType != generated.AccessRouteSame && req.AccessRouteType != generated.AccessRouteDifferent {
		http.Error(w, "access_route_type must be 'same' or 'different'", http.StatusBadRequest)
		return
	}

	selected := make([]models.SelectedCode, 0, len(req.SelectedCodes))
	for _, c := range req.SelectedCodes {
		if _, ok := service.PorteValues[c.Porte]; !ok {
			http.Error(w, "unknown porte: "+c.Porte, http.StatusBadRequest)
			return
		}
		selected = append(selected, models.SelectedCode{
			CBHPMCode:   c.CBHPMCode,
			Description: c.Description,
			Porte:       c.Porte,
		})
	}

	accessRoute := models.AccessRouteType(req.AccessRouteType)
	result := service.Calculate(selected, req.AuxiliariesCount, req.RequiresAnesthesia, accessRoute, req.Adjustments)

	breakdown := make([]generated.CodeBreakdown, 0, len(result.CodeBreakdown))
	for _, b := range result.CodeBreakdown {
		breakdown = append(breakdown, generated.CodeBreakdown{
			CBHPMCode:   b.CBHPMCode,
			Description: b.Description,
			Porte:       b.Porte,
			BaseValue:   b.BaseValue,
			IsPrincipal: b.IsPrincipal,
		})
	}

	auxFees := make([]generated.AuxiliaryFee, 0, len(result.IndividualAuxFees))
	for _, a := range result.IndividualAuxFees {
		auxFees = append(auxFees, generated.AuxiliaryFee{
			Position:   a.Position,
			Percentage: a.Percentage,
			Fee:        a.Fee,
		})
	}

	selectedAdj := make([]generated.AppliedAdjustment, 0, len(result.SelectedAdjustments))
	for _, a := range result.SelectedAdjustments {
		selectedAdj = append(selectedAdj, generated.AppliedAdjustment{
			Code:       a.Code,
			Label:      a.Label,
			Percentage: a.Percentage,
			Source:     a.Source,
		})
	}

	respondJSON(w, http.StatusOK, generated.CalculateResponse{
		CodeBreakdown:   breakdown,
		AccessRouteType: generated.AccessRouteType(result.AccessRouteType),
		SurgeonBreakdown: generated.SurgeonBreakdown{
			PrincipalValue:       result.SurgeonBreakdown.PrincipalValue,
			AdditionalGross:      result.SurgeonBreakdown.AdditionalGross,
			DiscountRate:         result.SurgeonBreakdown.DiscountRate,
			AdditionalDiscounted: result.SurgeonBreakdown.AdditionalDiscounted,
			SurgeonTotal:         result.SurgeonBreakdown.SurgeonTotal,
		},
		TotalBase:                 result.TotalBase,
		BaseSurgeonValue:          result.BaseSurgeonValue,
		BaseAuxiliaresTotalValue:  result.BaseAuxiliaresTotalValue,
		BaseAnesthesiologistValue: result.BaseAnesthesiologistValue,
		BaseTeamTotalValue:        result.BaseTeamTotalValue,
		SelectedAdjustments:       selectedAdj,
		TotalAdjustmentPercentage: result.TotalAdjustmentPercentage,
		AdjustmentValue:           result.AdjustmentValue,
		LeadSurgeonFee:            result.LeadSurgeonFee,
		IndividualAuxFees:         auxFees,
		AuxiliariesFee:            result.AuxiliariesFee,
		AnesthesiologistFee:       result.AnesthesiologistFee,
		FinalTotal:                result.FinalTotal,
	})
}

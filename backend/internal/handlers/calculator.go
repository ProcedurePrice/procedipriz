package handlers

import (
	"encoding/json"
	"net/http"

	"procediprize/backend/internal/generated"
)

const anesthesiaPorteValue = 1200.00

var porteValues = map[string]float64{
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

func calculatePrice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request generated.CalculateRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}

	procedure, ok := procedureByCode(request.CBHPMCode)
	if !ok {
		http.Error(w, "cbhpm code not found", http.StatusNotFound)
		return
	}
	if request.AuxiliariesCount < 0 || request.AuxiliariesCount > 4 {
		http.Error(w, "auxiliaries_count must be between 0 and 4", http.StatusBadRequest)
		return
	}

	base := porteValues[procedure.Porte]
	auxiliariesFee := auxiliaryFee(base, request.AuxiliariesCount)
	anesthesiaFee := 0.0
	if request.RequiresAnesthesia {
		anesthesiaFee = anesthesiaPorteValue
	}

	respondJSON(w, http.StatusOK, generated.CalculateResponse{
		BasePorteValue:      base,
		LeadSurgeonFee:      base,
		AuxiliariesFee:      auxiliariesFee,
		AnesthesiologistFee: anesthesiaFee,
		FinalTotal:          base + auxiliariesFee + anesthesiaFee,
	})
}

func auxiliaryFee(base float64, count int) float64 {
	if count == 0 {
		return 0
	}

	total := base * 0.30
	for i := 2; i <= count; i++ {
		total += base * 0.20
	}
	return total
}

package handlers

import (
	"embed"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"procediprize/backend/internal/generated"
)

//go:embed procedures.json
var catalogFS embed.FS

var procedures = loadProcedures()

func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/procedures/search", withCORS(searchProcedures))
	mux.HandleFunc("/api/calculate", withCORS(calculatePrice))
}

func searchProcedures(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := normalizeSearch(r.URL.Query().Get("q"))
	if len(query) < 2 {
		http.Error(w, "query must contain at least 2 characters", http.StatusBadRequest)
		return
	}

	results := make([]generated.ProcedureSearchResult, 0, len(procedures))
	for _, procedure := range procedures {
		searchable := normalizeSearch(procedure.ProcedureName + " " + procedure.CBHPMCode + " " + procedure.Description)
		if strings.Contains(searchable, query) {
			results = append(results, procedure)
		}
	}

	respondJSON(w, http.StatusOK, results)
}

func procedureByCode(code string) (generated.ProcedureSearchResult, bool) {
	for _, procedure := range procedures {
		if procedure.CBHPMCode == code {
			return procedure, true
		}
	}
	return generated.ProcedureSearchResult{}, false
}

func loadProcedures() []generated.ProcedureSearchResult {
	data, err := catalogFS.ReadFile("procedures.json")
	if err != nil {
		log.Fatalf("read embedded procedure catalog: %v", err)
	}

	var catalog []generated.ProcedureSearchResult
	if err := json.Unmarshal(data, &catalog); err != nil {
		log.Fatalf("decode embedded procedure catalog: %v", err)
	}

	return catalog
}

func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func normalizeSearch(value string) string {
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
		"Á", "a", "À", "a", "Â", "a", "Ã", "a", "Ä", "a",
		"é", "e", "ê", "e", "ë", "e", "É", "e", "Ê", "e", "Ë", "e",
		"í", "i", "î", "i", "ï", "i", "Í", "i", "Î", "i", "Ï", "i",
		"ó", "o", "ô", "o", "õ", "o", "ö", "o", "Ó", "o", "Ô", "o", "Õ", "o", "Ö", "o",
		"ú", "u", "û", "u", "ü", "u", "Ú", "u", "Û", "u", "Ü", "u",
		"ç", "c", "Ç", "c",
	)
	return strings.TrimSpace(strings.ToLower(replacer.Replace(value)))
}

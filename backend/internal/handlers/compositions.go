package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"afere/backend/internal/generated"
	"afere/backend/internal/models"
	"afere/backend/internal/repository"
)

// decodeAndValidateComposition parses and validates the fields shared by
// both save and update requests. Returns the decoded request or writes an
// error to w and returns false.
func decodeAndValidateComposition(w http.ResponseWriter, r *http.Request) (generated.SaveCompositionRequest, bool) {
	var req generated.SaveCompositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return req, false
	}
	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return req, false
	}
	if strings.TrimSpace(req.SBNProcedureName) == "" {
		http.Error(w, "sbn_procedure_name is required", http.StatusBadRequest)
		return req, false
	}
	if len(req.SelectedCodes) == 0 {
		http.Error(w, "selected_codes must not be empty", http.StatusBadRequest)
		return req, false
	}
	if req.AuxiliariesCount < 0 || req.AuxiliariesCount > 4 {
		http.Error(w, "auxiliaries_count must be between 0 and 4", http.StatusBadRequest)
		return req, false
	}
	if req.AccessRouteType != generated.AccessRouteSame && req.AccessRouteType != generated.AccessRouteDifferent {
		http.Error(w, "access_route_type must be 'same' or 'different'", http.StatusBadRequest)
		return req, false
	}
	return req, true
}

func reqToComposition(req generated.SaveCompositionRequest) models.Composition {
	codes := make([]models.SelectedCode, 0, len(req.SelectedCodes))
	for _, c := range req.SelectedCodes {
		codes = append(codes, models.SelectedCode{
			CBHPMCode:   c.CBHPMCode,
			Description: c.Description,
			Porte:       c.Porte,
		})
	}
	adjs := req.Adjustments
	if adjs == nil {
		adjs = []string{}
	}
	return models.Composition{
		Name:               req.Name,
		SBNProcedureID:     req.SBNProcedureID,
		SBNProcedureName:   req.SBNProcedureName,
		SelectedCodes:      codes,
		AccessRouteType:    models.AccessRouteType(req.AccessRouteType),
		AuxiliariesCount:   req.AuxiliariesCount,
		RequiresAnesthesia: req.RequiresAnesthesia,
		Adjustments:        adjs,
	}
}

// requirePhysician extracts the physician ID from the request context.
// If not present (auth middleware was not applied), it writes 401 and returns ("", false).
func requirePhysician(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, ok := physicianIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return "", false
	}
	return id, true
}

// makeSaveCompositionHandler handles POST /api/compositions.
func makeSaveCompositionHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		physicianID, ok := requirePhysician(w, r)
		if !ok {
			return
		}
		req, ok := decodeAndValidateComposition(w, r)
		if !ok {
			return
		}
		saved, err := repo.SaveComposition(reqToComposition(req), physicianID)
		if err != nil {
			log.Printf("save composition: %v", err)
			http.Error(w, "failed to save composition", http.StatusInternalServerError)
			return
		}
		respondJSON(w, http.StatusCreated, generated.SaveCompositionResponse{
			PublicID:  saved.PublicID,
			CreatedAt: saved.CreatedAt,
		})
	}
}

// makeListCompositionsHandler handles GET /api/compositions.
func makeListCompositionsHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		physicianID, ok := requirePhysician(w, r)
		if !ok {
			return
		}
		comps, err := repo.ListCompositions(physicianID)
		if err != nil {
			log.Printf("list compositions: %v", err)
			http.Error(w, "failed to list compositions", http.StatusInternalServerError)
			return
		}
		items := make([]generated.CompositionItem, 0, len(comps))
		for _, c := range comps {
			items = append(items, generated.CompositionItem{
				PublicID:           c.PublicID,
				Name:               c.Name,
				SBNProcedureID:     c.SBNProcedureID,
				SBNProcedureName:   c.SBNProcedureName,
				AccessRouteType:    generated.AccessRouteType(c.AccessRouteType),
				AuxiliariesCount:   c.AuxiliariesCount,
				RequiresAnesthesia: c.RequiresAnesthesia,
				CreatedAt:          c.CreatedAt,
			})
		}
		respondJSON(w, http.StatusOK, items)
	}
}

// makeGetCompositionHandler handles GET /api/compositions/{id}.
func makeGetCompositionHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		publicID := strings.TrimPrefix(r.URL.Path, "/api/compositions/")
		if strings.TrimSpace(publicID) == "" {
			http.Error(w, "missing composition id", http.StatusBadRequest)
			return
		}
		physicianID, ok := requirePhysician(w, r)
		if !ok {
			return
		}
		comp, err := repo.GetCompositionByPublicID(publicID, physicianID)
		if err != nil {
			log.Printf("get composition %q: %v", publicID, err)
			http.Error(w, "failed to retrieve composition", http.StatusInternalServerError)
			return
		}
		if comp == nil {
			http.Error(w, "composition not found", http.StatusNotFound)
			return
		}
		codes := make([]generated.SelectedCode, 0, len(comp.SelectedCodes))
		for _, c := range comp.SelectedCodes {
			codes = append(codes, generated.SelectedCode{
				CBHPMCode:   c.CBHPMCode,
				Description: c.Description,
				Porte:       c.Porte,
			})
		}
		respondJSON(w, http.StatusOK, generated.CompositionDetail{
			PublicID:           comp.PublicID,
			Name:               comp.Name,
			SBNProcedureID:     comp.SBNProcedureID,
			SBNProcedureName:   comp.SBNProcedureName,
			SelectedCodes:      codes,
			AccessRouteType:    generated.AccessRouteType(comp.AccessRouteType),
			AuxiliariesCount:   comp.AuxiliariesCount,
			RequiresAnesthesia: comp.RequiresAnesthesia,
			Adjustments:        func() []string { if comp.Adjustments == nil { return []string{} }; return comp.Adjustments }(),
			CreatedAt:          comp.CreatedAt,
			UpdatedAt:          comp.UpdatedAt,
		})
	}
}

// makeUpdateCompositionHandler handles PUT /api/compositions/{id}.
func makeUpdateCompositionHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		publicID := strings.TrimPrefix(r.URL.Path, "/api/compositions/")
		if strings.TrimSpace(publicID) == "" {
			http.Error(w, "missing composition id", http.StatusBadRequest)
			return
		}
		physicianID, ok := requirePhysician(w, r)
		if !ok {
			return
		}
		req, ok := decodeAndValidateComposition(w, r)
		if !ok {
			return
		}
		updated, err := repo.UpdateComposition(publicID, reqToComposition(req), physicianID)
		if err != nil {
			log.Printf("update composition %q: %v", publicID, err)
			http.Error(w, "failed to update composition", http.StatusInternalServerError)
			return
		}
		if updated == nil {
			http.Error(w, "composition not found", http.StatusNotFound)
			return
		}
		codes := make([]generated.SelectedCode, 0, len(updated.SelectedCodes))
		for _, c := range updated.SelectedCodes {
			codes = append(codes, generated.SelectedCode{
				CBHPMCode:   c.CBHPMCode,
				Description: c.Description,
				Porte:       c.Porte,
			})
		}
		updAdjs := updated.Adjustments
			if updAdjs == nil {
				updAdjs = []string{}
			}
			respondJSON(w, http.StatusOK, generated.CompositionDetail{
				PublicID:           updated.PublicID,
				Name:               updated.Name,
				SBNProcedureID:     updated.SBNProcedureID,
				SBNProcedureName:   updated.SBNProcedureName,
				SelectedCodes:      codes,
				AccessRouteType:    generated.AccessRouteType(updated.AccessRouteType),
				AuxiliariesCount:   updated.AuxiliariesCount,
				RequiresAnesthesia: updated.RequiresAnesthesia,
				Adjustments:        updAdjs,
				CreatedAt:          updated.CreatedAt,
				UpdatedAt:          updated.UpdatedAt,
			})
	}
}

// makeDeleteCompositionHandler handles DELETE /api/compositions/{id}.
func makeDeleteCompositionHandler(repo repository.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		publicID := strings.TrimPrefix(r.URL.Path, "/api/compositions/")
		if strings.TrimSpace(publicID) == "" {
			http.Error(w, "missing composition id", http.StatusBadRequest)
			return
		}
		physicianID, ok := requirePhysician(w, r)
		if !ok {
			return
		}
		deleted, err := repo.DeleteCompositionByPublicID(publicID, physicianID)
		if err != nil {
			log.Printf("delete composition %q: %v", publicID, err)
			http.Error(w, "failed to delete composition", http.StatusInternalServerError)
			return
		}
		if !deleted {
			http.Error(w, "composition not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// makeCompositionsCollectionHandler dispatches GET → list, POST → save on /api/compositions.
func makeCompositionsCollectionHandler(repo repository.Repository) http.Handler {
	save := makeSaveCompositionHandler(repo)
	list := makeListCompositionsHandler(repo)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			save(w, r)
		case http.MethodGet:
			list(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

// makeCompositionItemHandler dispatches GET/PUT/DELETE on /api/compositions/{id}.
func makeCompositionItemHandler(repo repository.Repository) http.Handler {
	get := makeGetCompositionHandler(repo)
	put := makeUpdateCompositionHandler(repo)
	del := makeDeleteCompositionHandler(repo)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			get(w, r)
		case http.MethodPut:
			put(w, r)
		case http.MethodDelete:
			del(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

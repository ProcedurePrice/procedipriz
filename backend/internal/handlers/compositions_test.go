package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"afere/backend/internal/generated"
	"afere/backend/internal/handlers"
	"afere/backend/internal/repository"
)

// testMux builds a mux with the test auth middleware injecting testClerkUserID.
func testMux(repo *repository.FileRepository, testClerkUserID string) *http.ServeMux {
	mux := http.NewServeMux()
	auth := handlers.MakeTestAuthMiddleware(repo, testClerkUserID)
	handlers.RegisterRoutes(mux, repo, auth)
	return mux
}

// compositionPayload builds a minimal valid save/update request body.
func compositionPayload(name string) []byte {
	req := generated.SaveCompositionRequest{
		Name:             name,
		SBNProcedureName: "CRANIOTOMIA DESCOMPRESSIVA",
		SBNProcedureID:   "test-sbn-id",
		SelectedCodes: []generated.SelectedCode{
			{CBHPMCode: "3.02.15.02-1", Description: "Craniotomia descompressiva", Porte: "9C"},
		},
		AccessRouteType:    generated.AccessRouteSame,
		AuxiliariesCount:   2,
		RequiresAnesthesia: true,
	}
	b, _ := json.Marshal(req)
	return b
}

func saveComposition(t *testing.T, mux *http.ServeMux, payload []byte) string {
	t.Helper()
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/compositions", bytes.NewReader(payload)))
	if w.Code != http.StatusCreated {
		t.Fatalf("save composition: expected 201, got %d: %s", w.Code, w.Body)
	}
	var resp generated.SaveCompositionResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode save response: %v", err)
	}
	return resp.PublicID
}

func TestSaveComposition(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := testMux(repo, "user-save-test")

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/compositions", bytes.NewReader(compositionPayload("Composição teste"))))

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body)
	}
	var resp generated.SaveCompositionResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.PublicID == "" {
		t.Error("expected non-empty public_id")
	}
}

func TestListCompositions(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := testMux(repo, "user-list-test")

	saveComposition(t, mux, compositionPayload("Alpha"))
	saveComposition(t, mux, compositionPayload("Beta"))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/compositions", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	var items []generated.CompositionItem
	if err := json.NewDecoder(w.Body).Decode(&items); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2 items, got %d", len(items))
	}
}

func TestGetComposition(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := testMux(repo, "user-get-test")

	id := saveComposition(t, mux, compositionPayload("Minha composição"))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/compositions/"+id, nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	var detail generated.CompositionDetail
	if err := json.NewDecoder(w.Body).Decode(&detail); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if detail.Name != "Minha composição" {
		t.Errorf("expected name %q, got %q", "Minha composição", detail.Name)
	}
	if len(detail.SelectedCodes) != 1 {
		t.Errorf("expected 1 selected code, got %d", len(detail.SelectedCodes))
	}
	if detail.AuxiliariesCount != 2 {
		t.Errorf("expected auxiliaries_count 2, got %d", detail.AuxiliariesCount)
	}
}

func TestUpdateComposition(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := testMux(repo, "user-update-test")

	id := saveComposition(t, mux, compositionPayload("Original"))

	updated := generated.SaveCompositionRequest{
		Name:             "Atualizada",
		SBNProcedureName: "CRANIOTOMIA DESCOMPRESSIVA",
		SBNProcedureID:   "test-sbn-id",
		SelectedCodes: []generated.SelectedCode{
			{CBHPMCode: "3.02.15.02-1", Description: "Craniotomia descompressiva", Porte: "9C"},
		},
		AccessRouteType:    generated.AccessRouteDifferent,
		AuxiliariesCount:   1,
		RequiresAnesthesia: false,
	}
	body, _ := json.Marshal(updated)

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/compositions/"+id, bytes.NewReader(body)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	var detail generated.CompositionDetail
	if err := json.NewDecoder(w.Body).Decode(&detail); err != nil {
		t.Fatalf("decode updated detail: %v", err)
	}
	if detail.Name != "Atualizada" {
		t.Errorf("expected name %q, got %q", "Atualizada", detail.Name)
	}
	if detail.AccessRouteType != generated.AccessRouteDifferent {
		t.Errorf("expected access_route_type %q, got %q", generated.AccessRouteDifferent, detail.AccessRouteType)
	}
}

func TestDeleteComposition(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := testMux(repo, "user-delete-test")

	id := saveComposition(t, mux, compositionPayload("Para apagar"))

	// Delete it.
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/compositions/"+id, nil))
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body)
	}

	// Second delete must be 404.
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodDelete, "/api/compositions/"+id, nil))
	if w2.Code != http.StatusNotFound {
		t.Errorf("expected 404 on second delete, got %d", w2.Code)
	}
}

func TestUnauthenticatedCompositionRequest(t *testing.T) {
	repo := repository.NewFileRepository()
	// Real Clerk middleware with empty config: no token → immediate 401 without any JWKS fetch.
	auth := handlers.MakeClerkAuthMiddleware(handlers.ClerkConfig{}, repo)
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo, auth)

	cases := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/compositions"},
		{http.MethodGet, "/api/compositions"},
		{http.MethodGet, "/api/compositions/some-id"},
		{http.MethodPut, "/api/compositions/some-id"},
		{http.MethodDelete, "/api/compositions/some-id"},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, bytes.NewReader(compositionPayload("Test"))))
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: expected 401, got %d", tc.method, tc.path, w.Code)
		}
	}
}

func TestUserCannotAccessOtherUserComposition(t *testing.T) {
	repo := repository.NewFileRepository()
	muxAlice := testMux(repo, "clerk-alice")
	muxBob := testMux(repo, "clerk-bob")

	// Alice creates a composition.
	id := saveComposition(t, muxAlice, compositionPayload("Composição da Alice"))

	// Bob tries GET — must receive 404 (no ownership leak).
	w := httptest.NewRecorder()
	muxBob.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/compositions/"+id, nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("GET: expected 404 (Bob cannot see Alice's composition), got %d", w.Code)
	}

	// Bob tries PUT — must receive 404.
	w2 := httptest.NewRecorder()
	muxBob.ServeHTTP(w2, httptest.NewRequest(http.MethodPut, "/api/compositions/"+id, bytes.NewReader(compositionPayload("Tentativa de sobrescrever"))))
	if w2.Code != http.StatusNotFound {
		t.Errorf("PUT: expected 404 (Bob cannot update Alice's composition), got %d", w2.Code)
	}

	// Bob tries DELETE — must receive 404.
	w3 := httptest.NewRecorder()
	muxBob.ServeHTTP(w3, httptest.NewRequest(http.MethodDelete, "/api/compositions/"+id, nil))
	if w3.Code != http.StatusNotFound {
		t.Errorf("DELETE: expected 404 (Bob cannot delete Alice's composition), got %d", w3.Code)
	}

	// Alice can still GET her own composition.
	w4 := httptest.NewRecorder()
	muxAlice.ServeHTTP(w4, httptest.NewRequest(http.MethodGet, "/api/compositions/"+id, nil))
	if w4.Code != http.StatusOK {
		t.Errorf("GET: expected 200 (Alice can see her own composition), got %d", w4.Code)
	}
}

// TestCompositionPreservesUrgencyEmergency verifies that the urgency_emergency
// flag is persisted on save and returned correctly on GET.
func TestCompositionPreservesUrgencyEmergency(t *testing.T) {
	repo := repository.NewFileRepository()
	mux := testMux(repo, "user-ue-test")

	req := generated.SaveCompositionRequest{
		Name:               "Urgência noturna",
		SBNProcedureName:   "CRANIOTOMIA DESCOMPRESSIVA",
		SBNProcedureID:     "test-sbn-id",
		SelectedCodes:      []generated.SelectedCode{{CBHPMCode: "3.02.15.02-1", Description: "Craniotomia", Porte: "9C"}},
		AccessRouteType:    generated.AccessRouteSame,
		AuxiliariesCount:   1,
		RequiresAnesthesia: true,
		UrgencyEmergency:   true,
	}
	body, _ := json.Marshal(req)
	id := saveComposition(t, mux, body)

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/compositions/"+id, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body)
	}
	var detail generated.CompositionDetail
	if err := json.NewDecoder(w.Body).Decode(&detail); err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	if !detail.UrgencyEmergency {
		t.Error("urgency_emergency should be true after save/load")
	}

	// Also verify that a composition saved without the flag returns false.
	id2 := saveComposition(t, mux, compositionPayload("Sem urgência"))
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/api/compositions/"+id2, nil))
	var detail2 generated.CompositionDetail
	json.NewDecoder(w2.Body).Decode(&detail2) //nolint:errcheck
	if detail2.UrgencyEmergency {
		t.Error("urgency_emergency should be false for a normal composition")
	}
}

func TestPublicCalculationsDoNotRequireAuth(t *testing.T) {
	repo := repository.NewFileRepository()
	// Real Clerk middleware with no JWKS: unauthenticated requests to calculation
	// endpoints should still succeed (they are not protected).
	auth := handlers.MakeClerkAuthMiddleware(handlers.ClerkConfig{}, repo)
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, repo, auth)

	// GET /api/calculations returns 200 without an Authorization header.
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/calculations", nil))
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for unauthenticated GET /api/calculations, got %d", w.Code)
	}
}

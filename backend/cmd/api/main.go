package main

import (
	"log"
	"net/http"
	"os"

	"procediprize/backend/internal/handlers"
)

func main() {
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux)

	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	log.Printf("ProcediPriz API is listening on %s 🚀", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

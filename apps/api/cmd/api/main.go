// Command api is the cosimosi backend entrypoint.
//
// This is the platform-foundation hello world: a bare net/http server with no
// transport framework, router, or internal/ contexts. A context is introduced
// by the first feature that needs it (ARCHITECTURE §2.3), not up front.
package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	// Catch-all so "/" answers without shadowing /health.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte("hello world"))
	})

	addr := ":" + port()
	log.Printf("api listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

// port reads PORT from the environment (runtime config, not a tuning constant),
// defaulting to 8080.
func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

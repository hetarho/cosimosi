// Command api is the cosimosi backend entrypoint.
package main

import (
	"log"
	"os"

	"github.com/cosimosi/api/internal/platform"
)

func main() {
	logger := log.Default()
	server := platform.NewHTTPServer(":"+port(), logger)
	logger.Printf("api listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil {
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

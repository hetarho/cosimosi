package entry

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

type handler struct {
	svc *Service
}

// RegisterRoutes wires the entry feature's HTTP routes onto a group.
// Composition root (cmd/api/main.go) is the only caller.
func RegisterRoutes(g *echo.Group, svc *Service) {
	h := &handler{svc: svc}
	g.GET("/entries", h.list)
}

func (h *handler) list(c echo.Context) error {
	entries, err := h.svc.List(c.Request().Context(), 50, 0)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return c.JSON(http.StatusNotFound, echo.Map{"error": err.Error()})
		}
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": err.Error()})
	}

	out := make([]entryResponse, 0, len(entries))
	for _, e := range entries {
		out = append(out, toResponse(e))
	}
	return c.JSON(http.StatusOK, out)
}

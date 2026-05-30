package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	deps Deps
}

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	DB      string `json:"db"`
}

func (h *Handler) Health(c echo.Context) error {
	db := "down"
	if err := h.deps.DB.Ping(c.Request().Context()); err == nil {
		db = "up"
	}
	return c.JSON(http.StatusOK, healthResponse{
		Status:  "ok",
		Version: h.deps.Version,
		DB:      db,
	})
}

func (h *Handler) ListEntries(c echo.Context) error {
	return c.JSON(http.StatusOK, []any{})
}

// Package httpserver builds the Echo instance + standard middleware
// stack used by cmd/api. Routes are NOT registered here — the
// composition root in main.go does that, feature by feature.
package httpserver

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func New(corsOrigin string) *echo.Echo {
	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(middleware.Logger())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{corsOrigin},
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{echo.HeaderContentType, echo.HeaderAuthorization},
	}))

	return e
}

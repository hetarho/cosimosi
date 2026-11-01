package main

import (
	"github.com/cosimosi/api/internal/platform/testdb"
	"os"
	"testing"
)

func TestMain(m *testing.M) { os.Exit(testdb.Run(m.Run)) }

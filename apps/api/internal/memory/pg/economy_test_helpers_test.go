package pg

import (
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
)

// withEconomy binds an EconomyTx onto every transaction the store opens. Suites that exercise the
// graph without Twinkle or achievements bind memory.NoEconomy; a suite that must hold a transaction
// inside its spend or earn binds a barrier.
func withEconomy(store Store, economy memory.EconomyTx) Store {
	return store.WithEconomyBinding(func(dbgen.DBTX) memory.EconomyTx { return economy })
}

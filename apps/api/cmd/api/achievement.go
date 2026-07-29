package main

import (
	"net/http"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	achievementrpc "github.com/cosimosi/api/internal/achievement/rpc"
	achievementv1connect "github.com/cosimosi/api/internal/gen/cosimosi/achievement/v1/achievementv1connect"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// Achievement wiring (ARCHITECTURE §2.4) — the READ wiring only. The context imports nothing and
// nothing imports it: the withdrawal sweep reaches its purge leg through account's UserDataPurger
// port, and the producer-side recorder adapters + claim path belong to the tracking use-case, so
// nothing wired here can record progress.

func newAchievementService(pool *platformdb.Pool) (*achievement.Service, error) {
	return achievement.NewService(achievement.AchievementServiceDeps{
		Repo: achievementpg.NewStore(pool.PgxPool()),
	})
}

// achievementWithdrawalPurgerFor is the sweep's achievement leg, satisfying account's
// UserDataPurger port. Built straight over the pool: a sweep needs nothing the service composes.
func achievementWithdrawalPurgerFor(pool *platformdb.Pool) achievement.WithdrawalPurger {
	return achievement.NewWithdrawalPurger(achievementpg.NewStore(pool.PgxPool()))
}

// achievementServiceOption registers the AchievementService Connect handler.
func achievementServiceOption(service *achievement.Service) (platform.HandlerOption, error) {
	server, err := achievementrpc.NewServer(service)
	if err != nil {
		return nil, err
	}
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return achievementv1connect.NewAchievementServiceHandler(server, opts...)
	}), nil
}

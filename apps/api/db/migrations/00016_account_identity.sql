-- +goose Up

-- users — account profile row ([U1][U6][U7]). The user_id primary key is the
-- persistence-isolation scope, while email remains authoritative in Supabase Auth.
CREATE TABLE users (
    user_id    TEXT PRIMARY KEY,
    nickname   TEXT NOT NULL,
    timezone   TEXT NOT NULL,
    locale     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- auth_providers — append-only sign-in-method linkage ([U5]). Supabase owns current
-- membership; this row records when the product first observed each member of the closed set.
CREATE TABLE auth_providers (
    user_id          TEXT NOT NULL,
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    linked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, provider),
    CHECK (provider IN ('GOOGLE', 'PASSWORD'))
);

-- invites — bound invite capability row ([U1][U8][G6]). There is no users foreign key
-- because withdrawal retention must preserve an inviter's settlement history without a cascade.
CREATE TABLE invites (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    invitee_user_id TEXT NOT NULL,
    token           TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL,
    bound_at        TIMESTAMPTZ NOT NULL,
    rewarded_at     TIMESTAMPTZ,
    CHECK (invitee_user_id <> user_id),
    CHECK (rewarded_at IS NULL OR rewarded_at >= bound_at)
);

CREATE UNIQUE INDEX invites_invitee_unique ON invites (invitee_user_id);

-- +goose Down

DROP TABLE invites;
DROP TABLE auth_providers;
DROP TABLE users;

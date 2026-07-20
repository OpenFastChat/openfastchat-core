// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
// SPDX-License-Identifier: AGPL-3.0-only

package store

import (
	"database/sql"
	"embed"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Migrations is the embedded shared-schema goose migration set. Wrappers layer
// their own migrations (e.g. hosted billing) on top by running them afterwards.
var Migrations = migrationsFS

// Migrate applies the shared-schema migrations to the pool's database.
func Migrate(pool *pgxpool.Pool) error {
	db := stdlib.OpenDBFromPool(pool)
	defer func(db *sql.DB) { _ = db.Close() }(db)

	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.Up(db, "migrations")
}

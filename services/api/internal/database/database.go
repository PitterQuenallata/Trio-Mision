// Package database gestiona la conexión a PostgreSQL.
package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Querier es la superficie de consultas que comparten el pool y las
// transacciones; los helpers de negocio la usan para participar de una tx.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// DB es lo que los módulos necesitan del pool: ping, consultas y
// transacciones. *pgxpool.Pool la satisface; los tests usan implementaciones falsas.
type DB interface {
	Querier
	Ping(ctx context.Context) error
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Connect crea un pool de conexiones y verifica que PostgreSQL responda.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("crear pool de conexiones: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("conectar a PostgreSQL: %w", err)
	}
	return pool, nil
}

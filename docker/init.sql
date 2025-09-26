CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  internal_id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (id, name, email, active, created_at, updated_at)
VALUES
  (1, 'Alice Johnson', 'alice@example.com', TRUE, NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days'),
  (2, 'Bob Smith', 'bob@example.com', TRUE, NOW() - INTERVAL '20 days', NOW() - INTERVAL '1 day'),
  (3, 'Carol Williams', 'carol@example.com', FALSE, NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO posts (id, user_id, title, content, published, created_at, updated_at)
VALUES
  (1, 1, 'Getting started with db-router', 'A walkthrough explaining how to use db-router with Bun and PostgreSQL.', TRUE, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  (2, 1, 'Understanding Route Configuration', 'Details on configuring routes.json to expose safe read-only queries.', TRUE, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  (3, 2, 'Database Tips for Bun Apps', 'Practical guidance for tuning PostgreSQL connections in Bun applications.', TRUE, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),
  (4, 3, 'Draft: Advanced Analytics', 'This post is still in draft and should not appear in public routes.', FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

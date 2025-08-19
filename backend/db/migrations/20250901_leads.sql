CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT NOT NULL,
  origem TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

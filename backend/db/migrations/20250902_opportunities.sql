CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  cliente TEXT NOT NULL,
  valor_estimado NUMERIC(12,2) DEFAULT 0,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'prospeccao',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);

CREATE TABLE IF NOT EXISTS factory_projects (
  id uuid PRIMARY KEY,
  workspace_hash text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  scene jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS factory_projects_owner_updated_idx
ON factory_projects (workspace_hash, updated_at DESC);

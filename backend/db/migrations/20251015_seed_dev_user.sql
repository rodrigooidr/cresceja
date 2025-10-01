-- Seed de organização e usuário de desenvolvimento

-- ORG
INSERT INTO organizations (id, name)
SELECT '8f181879-2f22-4831-967a-31c892f271bb', 'CresceJá DEV'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE id = '8f181879-2f22-4831-967a-31c892f271bb'
);

-- USER (senha: admin123)
INSERT INTO users (id, email, password_hash, name, org_id, roles)
SELECT
  'cdbdc333-87d6-4dda-9726-a77f20609b75',
  'rodrigooidr@hotmail.com',
  '$2b$10$5xw1u5vGg6Kc2w3hO7jZae4F9a4mB1Q2mO0m3vV2a0b9b3l5uQH1W',
  'Rodrigo Oliveira',
  '8f181879-2f22-4831-967a-31c892f271bb',
  ARRAY['OrgOwner','SuperAdmin']
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'rodrigooidr@hotmail.com'
);

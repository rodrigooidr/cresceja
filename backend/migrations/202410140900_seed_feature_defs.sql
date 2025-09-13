INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public, show_as_tick)
VALUES
  ('whatsapp_numbers', 'WhatsApp – Quantidade de números', 'number', NULL, 'whatsapp', 10, true, false),
  ('google_calendar_accounts', 'Google Calendar – Contas conectadas', 'number', NULL, 'google', 20, true, false),
  ('whatsapp_mode_baileys', 'WhatsApp – Baileys habilitado', 'boolean', NULL, 'whatsapp', 30, false, false),
  ('facebook_pages', 'Facebook – Páginas conectadas', 'number', NULL, 'facebook', 40, true, false)
ON CONFLICT (code) DO NOTHING;

-- sql/seed_demo_user.sql
-- Demo admin user: email admin@example.com / password admin123
INSERT INTO public.users (id, name, email, password)
VALUES (gen_random_uuid(), 'Admin', 'admin@example.com', '$2b$10$Ds8G5fkqOj0E9FUO3d4kXuSUDJeH9U6ulIOLpJUxH5ivrDyV7Z7dq')
ON CONFLICT (email) DO NOTHING;

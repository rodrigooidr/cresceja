DO $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email='rodrigooidr@hotmail.com') THEN
    INSERT INTO public.users (email, full_name, role, password_hash, created_at, updated_at)
    VALUES ('rodrigooidr@hotmail.com','Admin','admin', crypt('R0drig01!', gen_salt('bf')), now(), now())
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE public.users
       SET role='admin',
           password_hash = crypt('R0drig01!', gen_salt('bf')),
           updated_at = now()
     WHERE email='rodrigooidr@hotmail.com'
    RETURNING id INTO v_user_id;
  END IF;
END $$;

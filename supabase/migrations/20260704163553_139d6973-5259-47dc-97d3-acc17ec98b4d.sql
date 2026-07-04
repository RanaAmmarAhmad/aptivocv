CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'marikhan0320@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.email, '')) = 'marikhan0320@gmail.com'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_email() TO authenticated;
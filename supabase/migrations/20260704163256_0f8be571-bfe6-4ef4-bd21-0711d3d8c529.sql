CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'marikhan0320@gmail.com';
$$;

REVOKE ALL ON FUNCTION public.is_admin_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_email() TO authenticated;

DROP POLICY IF EXISTS "admin promo code access" ON public.promo_codes;
CREATE POLICY "admin promo code access"
ON public.promo_codes
FOR ALL
TO authenticated
USING (public.is_admin_email())
WITH CHECK (public.is_admin_email());

DROP POLICY IF EXISTS "admin redemptions read" ON public.promo_redemptions;
CREATE POLICY "admin redemptions read"
ON public.promo_redemptions
FOR SELECT
TO authenticated
USING (public.is_admin_email());

DROP POLICY IF EXISTS "admin credits read" ON public.user_promo_credits;
CREATE POLICY "admin credits read"
ON public.user_promo_credits
FOR SELECT
TO authenticated
USING (public.is_admin_email());

CREATE OR REPLACE FUNCTION public.validate_promo_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promo record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  NEW.code := upper(trim(NEW.code));

  SELECT pc.code, pc.credits, pc.active
  INTO promo
  FROM public.promo_codes pc
  WHERE pc.code = NEW.code;

  IF promo.code IS NULL THEN
    RAISE EXCEPTION 'Invalid promo code.';
  END IF;

  IF NOT promo.active THEN
    RAISE EXCEPTION 'This promo code is no longer active.';
  END IF;

  NEW.credited := promo.credits;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promo_redemption() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_promo_redemption_before_insert ON public.promo_redemptions;
CREATE TRIGGER validate_promo_redemption_before_insert
BEFORE INSERT ON public.promo_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.validate_promo_redemption();

CREATE OR REPLACE FUNCTION public.apply_promo_redemption_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_promo_credits (user_id, credits_remaining, credits_granted_total, updated_at)
  VALUES (NEW.user_id, NEW.credited, NEW.credited, now())
  ON CONFLICT (user_id) DO UPDATE
  SET credits_remaining = public.user_promo_credits.credits_remaining + excluded.credits_remaining,
      credits_granted_total = public.user_promo_credits.credits_granted_total + excluded.credits_granted_total,
      updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_promo_redemption_credit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apply_promo_redemption_credit_after_insert ON public.promo_redemptions;
CREATE TRIGGER apply_promo_redemption_credit_after_insert
AFTER INSERT ON public.promo_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.apply_promo_redemption_credit();

REVOKE ALL ON FUNCTION public.is_promo_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_create_promo_code(text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_promo_code_active(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_promo_codes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_promo_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon, authenticated;
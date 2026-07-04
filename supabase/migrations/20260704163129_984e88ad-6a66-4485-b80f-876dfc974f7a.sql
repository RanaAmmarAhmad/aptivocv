CREATE OR REPLACE FUNCTION public.is_promo_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'marikhan0320@gmail.com';
$$;

GRANT EXECUTE ON FUNCTION public.is_promo_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_promo_code(
  _code text,
  _credits integer DEFAULT 100,
  _notes text DEFAULT NULL
)
RETURNS TABLE(code text, credits integer, active boolean, notes text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code text := upper(trim(_code));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_promo_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF normalized_code !~ '^[A-Z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'Code must be 3-40 letters, numbers, _ or -.';
  END IF;

  IF _credits IS NULL OR _credits < 1 OR _credits > 10000 THEN
    RAISE EXCEPTION 'Credits must be between 1 and 10000.';
  END IF;

  RETURN QUERY
  INSERT INTO public.promo_codes (code, credits, notes, created_by)
  VALUES (normalized_code, _credits, nullif(trim(coalesce(_notes, '')), ''), auth.uid())
  RETURNING promo_codes.code, promo_codes.credits, promo_codes.active, promo_codes.notes, promo_codes.created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Promo code already exists.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_promo_code(text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_promo_code_active(
  _code text,
  _active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code text := upper(trim(_code));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_promo_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.promo_codes
  SET active = _active
  WHERE code = normalized_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promo code not found.';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_promo_code_active(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_promo_codes()
RETURNS TABLE(
  code text,
  credits integer,
  active boolean,
  notes text,
  created_at timestamptz,
  redemptions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_promo_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    pc.code,
    pc.credits,
    pc.active,
    pc.notes,
    pc.created_at,
    count(pr.user_id)::bigint AS redemptions
  FROM public.promo_codes pc
  LEFT JOIN public.promo_redemptions pr ON pr.code = pc.code
  GROUP BY pc.code, pc.credits, pc.active, pc.notes, pc.created_at
  ORDER BY pc.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_promo_codes() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_promo_stats()
RETURNS TABLE(
  total_codes bigint,
  active_codes bigint,
  total_redemptions bigint,
  unique_redeemers bigint,
  total_credits_granted bigint,
  total_credits_remaining bigint,
  total_credits_used bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_promo_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.promo_codes)::bigint,
    (SELECT count(*) FROM public.promo_codes WHERE active)::bigint,
    (SELECT count(*) FROM public.promo_redemptions)::bigint,
    (SELECT count(DISTINCT user_id) FROM public.promo_redemptions)::bigint,
    coalesce((SELECT sum(credits_granted_total) FROM public.user_promo_credits), 0)::bigint,
    coalesce((SELECT sum(credits_remaining) FROM public.user_promo_credits), 0)::bigint,
    (
      coalesce((SELECT sum(credits_granted_total) FROM public.user_promo_credits), 0)
      - coalesce((SELECT sum(credits_remaining) FROM public.user_promo_credits), 0)
    )::bigint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_promo_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS TABLE(code text, credits integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code text := upper(trim(_code));
  promo record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT pc.code, pc.credits, pc.active
  INTO promo
  FROM public.promo_codes pc
  WHERE pc.code = normalized_code;

  IF promo.code IS NULL THEN
    RAISE EXCEPTION 'Invalid promo code.';
  END IF;

  IF NOT promo.active THEN
    RAISE EXCEPTION 'This promo code is no longer active.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.promo_redemptions pr
    WHERE pr.user_id = auth.uid()
      AND pr.code = normalized_code
  ) THEN
    RAISE EXCEPTION 'You have already redeemed this code.';
  END IF;

  INSERT INTO public.promo_redemptions (user_id, code, credited)
  VALUES (auth.uid(), normalized_code, promo.credits);

  INSERT INTO public.user_promo_credits (user_id, credits_remaining, credits_granted_total, updated_at)
  VALUES (auth.uid(), promo.credits, promo.credits, now())
  ON CONFLICT (user_id) DO UPDATE
  SET credits_remaining = public.user_promo_credits.credits_remaining + excluded.credits_remaining,
      credits_granted_total = public.user_promo_credits.credits_granted_total + excluded.credits_granted_total,
      updated_at = now();

  RETURN QUERY SELECT normalized_code, promo.credits::integer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;
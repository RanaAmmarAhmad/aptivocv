
-- Promo codes (admin-managed)
CREATE TABLE public.promo_codes (
  code TEXT PRIMARY KEY,
  credits INTEGER NOT NULL CHECK (credits > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
-- Server functions gate reads/writes by admin email; deny by default here.
CREATE POLICY "no direct access" ON public.promo_codes FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Redemption ledger (one row per (user, code))
CREATE TABLE public.promo_redemptions (
  user_id UUID NOT NULL,
  code TEXT NOT NULL REFERENCES public.promo_codes(code) ON DELETE CASCADE,
  credited INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
GRANT SELECT, INSERT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own redemptions read" ON public.promo_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own redemptions insert" ON public.promo_redemptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Per-user bonus CV credits pool
CREATE TABLE public.user_promo_credits (
  user_id UUID PRIMARY KEY,
  credits_remaining INTEGER NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  credits_granted_total INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_promo_credits TO authenticated;
GRANT ALL ON public.user_promo_credits TO service_role;
ALTER TABLE public.user_promo_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credits read" ON public.user_promo_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Mutations happen via server functions with service role; block direct client writes.
CREATE POLICY "no direct writes" ON public.user_promo_credits FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "no direct updates" ON public.user_promo_credits FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON FUNCTION public.is_promo_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_promo_code(text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_promo_code_active(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_promo_codes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_promo_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_promo_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_promo_code(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_promo_code_active(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promo_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type OAuthResult =
  | { redirected: true; error: null }
  | { redirected: false; error: Error };

export const auth = {
  signInWithOAuth: async (provider: "google", opts?: SignInOptions): Promise<OAuthResult> => {
    const result = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: opts?.redirect_uri,
        queryParams: opts?.extraParams,
      },
    });

    if (result.error) {
      return { redirected: false, error: result.error };
    }

    const url = result.data?.url;
    if (url) {
      window.location.assign(url);
      return { redirected: true, error: null };
    }

    return { redirected: false, error: new Error("No redirect URL returned") };
  },
};

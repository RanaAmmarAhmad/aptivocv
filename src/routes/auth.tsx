import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/integrations/auth";
import { toast } from "sonner";
import { Target } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in, Aptivo" },
      {
        name: "description",
        content:
          "Sign in to Aptivo to tailor your CV to any job description with truthful, ATS-optimized applications.",
      },
      { property: "og:title", content: "Sign in, Aptivo" },
      {
        property: "og:description",
        content: "Sign in to Aptivo, the AI CV tailoring app that never fabricates experience.",
      },
      { property: "og:url", content: "https://aptivoco.eu.cc/auth" },
      { property: "og:type", content: "website" },
      // Auth page shouldn't compete with the landing for search rankings
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://aptivoco.eu.cc/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        navigate({ to: "/app", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        toast.success("Account created. You're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-md flex-col px-6 py-10">
        <a href="/" className="mb-10 inline-flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Target className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="font-serif text-2xl">Aptivo</span>
        </a>

        <h1 className="font-serif text-4xl">
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to tailor your CV to any job."
            : "One CV. Every application, tailored."}
        </p>

        <button
          onClick={handleGoogle}
          className="mt-8 flex items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-accent"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@work.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "No account? Create one →"
            : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.4-4.6 2.3-7.4 2.3-5.1 0-9.5-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C41.2 35.6 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

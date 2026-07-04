import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoMark from "@/assets/logo.png";
import {
  ArrowRight,
  Sparkles,
  Quote,
  FileUp,
  Wand2,
  ScanSearch,
  ShieldCheck,
  Gauge,
  MessagesSquare,
  RefreshCw,
  FileCode2,
  BadgeCheck,
  Mail,
  Github,
  Linkedin,
  CheckCircle2,
  Pin,
  Wrench,
  Briefcase,
  GraduationCap,
  MailOpen,
} from "lucide-react";

const HeroCanvas = lazy(() => import("@/components/HeroCanvas"));

function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSignedIn(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return signedIn;
}

function HeaderCta() {
  const signedIn = useSignedIn();
  if (signedIn) {
    return (
      <Link
        to="/app"
        className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90"
      >
        Open app
      </Link>
    );
  }
  return (
    <>
      <Link to="/auth" className="text-muted-foreground hover:text-foreground">
        Sign in
      </Link>
      <Link
        to="/auth"
        className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90"
      >
        Get started
      </Link>
    </>
  );
}

function FooterCta() {
  const signedIn = useSignedIn();
  return (
    <Link to={signedIn ? "/app" : "/auth"} className="transition hover:text-foreground">
      {signedIn ? "Open app" : "Get started"}
    </Link>
  );
}

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Aptivo, Tailor your CV to any job in seconds" },
      {
        name: "description",
        content:
          "Aptivo turns your CV into a truthful, ATS-optimized application for any job description. Upload once, paste a role, get hired faster.",
      },
      { property: "og:title", content: "Aptivo, Tailor your CV to any job in seconds" },
      {
        property: "og:description",
        content:
          "Upload your CV once, paste any job description, and get a truthful, ATS-optimized tailored application in seconds.",
      },
      { property: "og:url", content: "https://aptivoco.eu.cc/" },
      { property: "og:type", content: "website" },
      { property: "og:video", content: "https://aptivoco.eu.cc/aptivo-demo.mp4" },
      { property: "og:video:type", content: "video/mp4" },
      { property: "og:video:width", content: "1920" },
      { property: "og:video:height", content: "1080" },
      { property: "og:image", content: "https://aptivoco.eu.cc/aptivo-demo-poster.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://aptivoco.eu.cc/aptivo-demo-poster.jpg" },
      { name: "twitter:player", content: "https://aptivoco.eu.cc/aptivo-demo.mp4" },
    ],
    links: [{ rel: "canonical", href: "https://aptivoco.eu.cc/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Aptivo",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://aptivoco.eu.cc/",
          description:
            "AI-powered CV tailoring that keeps your experience honest while helping you land more interviews.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: "Aptivo, Tailor your CV to any job in seconds",
          description:
            "See how Aptivo turns one CV plus any job description into a truthful, ATS-optimized application in seconds, with PDF and DOCX export.",
          thumbnailUrl: ["https://aptivoco.eu.cc/aptivo-demo-poster.jpg"],
          uploadDate: "2026-07-04",
          duration: "PT25S",
          contentUrl: "https://aptivoco.eu.cc/aptivo-demo.mp4",
          embedUrl: "https://aptivoco.eu.cc/#demo",
          publisher: {
            "@type": "Organization",
            name: "Aptivo",
            url: "https://aptivoco.eu.cc/",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Does Aptivo make up experience?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. Every response is regenerated from your original CV. If a skill isn't there, it won't appear.",
              },
            },
            {
              "@type": "Question",
              name: "Will it get past ATS filters?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "The response format is a strict six-section, keyword-mirrored layout with no tables, images, or embedded objects.",
              },
            },
            {
              "@type": "Question",
              name: "What files can I upload?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "PDF, DOCX, or plain text pasted directly. Files are parsed in your browser.",
              },
            },
            {
              "@type": "Question",
              name: "Can I rewrite a response?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, one-tap rewrites for tone, length, or keyword density, always regenerated from source.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6 animate-nav-in">
        <Link to="/" className="group flex min-w-0 items-center gap-2">
          <img
            src={logoMark}
            alt="Aptivo — AI CV tailoring platform"
            width={36}
            height={36}
            className="h-8 w-8 shrink-0 rounded-xl bg-foreground/95 p-1.5 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105 sm:h-9 sm:w-9"
          />
          <span className="truncate font-serif text-xl transition-colors group-hover:text-primary sm:text-2xl">Aptivo</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          <a href="#how" className="nav-link hidden text-muted-foreground hover:text-foreground md:inline">How it works</a>
          <a href="#demo" className="nav-link hidden text-muted-foreground hover:text-foreground md:inline">Demo</a>
          <a href="#features" className="nav-link hidden text-muted-foreground hover:text-foreground md:inline">Features</a>
          <a href="#faq" className="nav-link hidden text-muted-foreground hover:text-foreground md:inline">FAQ</a>
          <ClientOnly fallback={<span className="w-24" />}>
            <HeaderCta />
          </ClientOnly>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* 3D backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <ClientOnly fallback={<div className="absolute inset-0" />}>
            <HeroCanvas />
          </ClientOnly>
          {/* Vignette + gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-background)_75%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-24 sm:pt-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI-powered · ATS-optimized · Truthful only
          </div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
            Tailor your CV to any job.
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              In seconds.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Upload your CV once. Paste any job description. Aptivo returns a
            fully-formatted, ATS-friendly application, eligibility, summary,
            skills, experience, and a cover letter, built to get you hired.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/auth"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-[0_0_40px_-8px_var(--color-primary)] transition hover:opacity-90"
            >
              Start free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 font-medium text-foreground backdrop-blur transition hover:bg-accent"
            >
              Watch 25s demo
            </a>
          </div>

          {/* Stats strip */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 border-t border-border/60 pt-8 text-left sm:mt-16 sm:gap-4">
            {[
              ["6", "sections per response"],
              ["0", "fabricated experience"],
              ["~4s", "average tailoring time"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-serif text-2xl text-primary sm:text-3xl">{n}</div>
                <div className="mt-1 text-[11px] leading-tight text-muted-foreground sm:text-xs">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo video */}
      <section id="demo" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-6 text-center sm:mb-10">
          <div className="text-xs uppercase tracking-[0.2em] text-primary">Live demo</div>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl md:text-5xl">See it work in 25 seconds.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            One CV. Any job description. A full, ATS-ready application, narrated end-to-end.
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-br from-primary/25 via-transparent to-primary/10 opacity-70 blur-2xl transition group-hover:opacity-100" />
          <video
            src="/aptivo-demo.mp4"
            poster="/aptivo-demo-poster.jpg"
            controls
            playsInline
            preload="metadata"
            className="block h-auto w-full"
            aria-label="Aptivo product demo: tailor your CV to any job in seconds"
          >
            Your browser does not support the video tag. Download the
            {" "}
            <a href="/aptivo-demo.mp4">Aptivo demo video</a>.
          </video>
        </div>
      </section>

      {/* Preview card */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            <span className="ml-3 truncate text-xs text-muted-foreground">aptivo · tailored application</span>
          </div>
          <div className="grid gap-3 p-4 text-sm sm:gap-4 sm:p-6 md:grid-cols-2">
            {[
              { icon: CheckCircle2, title: "Eligibility Check", body: "Strong match, meets 7 of 8 stated requirements." },
              { icon: Pin, title: "ATS Summary", body: "Senior Frontend Engineer with 6 yrs of React, TypeScript, and design-system leadership." },
              { icon: Wrench, title: "Technical Skills", body: "React · TypeScript · Node · GraphQL · Playwright · CI/CD" },
              { icon: Briefcase, title: "Relevant Experience", body: "Led migration to a modular design system at Acme, cutting ship time 38%." },
              { icon: GraduationCap, title: "Education", body: "B.Sc. Computer Science, University of Lahore." },
              { icon: MailOpen, title: "Cover Letter", body: "Dear Hiring Team, your emphasis on accessible, high-velocity UI is…" },
            ].map((c) => (
              <div key={c.title} className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/40 p-4 transition hover:border-primary/40 hover:bg-background/60">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
                <div className="flex items-center gap-3">
                  <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/80 via-primary/50 to-primary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_-8px_var(--color-primary)] ring-1 ring-primary/40">
                    <c.icon className="h-5 w-5 text-primary-foreground drop-shadow" strokeWidth={2.25} />
                  </div>
                  <div className="font-medium text-foreground">{c.title}</div>
                </div>
                <p className="mt-2 text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-8 text-center sm:mb-10">
          <div className="text-xs uppercase tracking-[0.2em] text-primary">How it works</div>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl md:text-5xl">Three steps. Zero fabrication.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            {
              icon: FileUp,
              title: "1. Upload your CV",
              body:
                "Drop a PDF, DOCX, or paste text. We extract your name, contact, skills, and history, you confirm and edit.",
            },
            {
              icon: ScanSearch,
              title: "2. Paste any JD",
              body:
                "Every job description becomes a new tailored application. Eligibility check, ATS keywords, and a cover letter.",
            },
            {
              icon: BadgeCheck,
              title: "3. Never fabricated",
              body:
                "Every response regenerates from your original CV. Truthful reframing, not invented experience.",
            },
          ].map((c) => (
            <div key={c.title} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/30">
                <c.icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="font-serif text-xl">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-8 text-center sm:mb-10">
          <div className="text-xs uppercase tracking-[0.2em] text-primary">What you get</div>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl md:text-5xl">Built to get past the bots, and the humans.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Truthful by design", body: "Every generation reads from your original CV. No invented roles, no fake numbers." },
            { icon: Gauge, title: "ATS-first structure", body: "Six ordered sections, JD keyword mirroring, no tables or graphics that trip parsers." },
            { icon: MessagesSquare, title: "Threaded per role", body: "One CV per chat. Paste as many JDs as you like, each becomes its own tailored draft." },
            { icon: RefreshCw, title: "One-click rewrites", body: "Shorter, more aggressive, more keyword-dense, regenerate from source in a tap." },
            { icon: FileCode2, title: "PDF & DOCX in", body: "Parsed in your browser. Your CV text never touches an extraction API." },
            { icon: Wand2, title: "Eligibility upfront", body: "See where you match and where you don't before you spend time applying." },
          ].map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40 hover:bg-card/80">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/30 transition group-hover:from-primary/40 group-hover:to-primary/10">
                <f.icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="font-serif text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="relative rounded-3xl border border-border bg-card p-6 text-center sm:p-10">
          <Quote className="absolute -top-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-primary p-1.5 text-primary-foreground" />
          <p className="font-serif text-xl leading-snug sm:text-2xl md:text-3xl">
            "I stopped rewriting my CV for every listing. I paste the JD, I get
            a version that actually reflects what I've done, and I get callbacks."
          </p>
          <div className="mt-6 text-sm text-muted-foreground">Amina R., Product Engineer</div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-8 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-primary">FAQ</div>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Straight answers.</h2>
        </div>
        <div className="space-y-3">
          {[
            ["Does Aptivo make up experience?", "No. Every response is regenerated from your original CV. If a skill isn't there, it won't appear."],
            ["Will it get past ATS filters?", "The response format is a strict six-section, keyword-mirrored layout with no tables, images, or embedded objects."],
            ["What files can I upload?", "PDF, DOCX, or plain text pasted directly. Files are parsed in your browser."],
            ["Can I rewrite a response?", "Yes, one-tap rewrites for tone, length, or keyword density, always regenerated from source."],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-border bg-card p-5 open:border-primary/40">
              <summary className="flex cursor-pointer items-center justify-between font-medium">
                {q}
                <span className="text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-secondary via-card to-background p-8 text-center sm:p-12">
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
          <h2 className="relative font-serif text-3xl sm:text-4xl md:text-5xl">
            Your next application starts <span className="text-primary">now</span>.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
            Free to start. No credit card. Bring your CV, we'll do the tailoring.
          </p>
          <Link
            to="/auth"
            className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2">
                <img
                  src={logoMark}
                  alt="Aptivo — AI CV tailoring platform"
                  width={36}
                  height={36}
                  loading="lazy"
                  className="h-9 w-9 rounded-xl bg-foreground/95 p-1.5"
                />
                <span className="font-serif text-2xl">Aptivo</span>
              </Link>
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                AI-powered CV tailoring that keeps your experience honest while helping you land more interviews.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h4 className="mb-4 text-sm font-semibold text-foreground">Contact</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a
                    href="mailto:appcloud41@gmail.com"
                    className="inline-flex items-center gap-2 transition hover:text-foreground"
                  >
                    <Mail className="h-4 w-4 text-primary" />
                    appcloud41@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/RanaAmmarAhmad"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 transition hover:text-foreground"
                  >
                    <Github className="h-4 w-4 text-primary" />
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/in/ranaammarahmad/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 transition hover:text-foreground"
                  >
                    <Linkedin className="h-4 w-4 text-primary" />
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>

            {/* Links */}
            <div>
              <h4 className="mb-4 text-sm font-semibold text-foreground">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="#how" className="transition hover:text-foreground">How it works</a>
                </li>
                <li>
                  <a href="#features" className="transition hover:text-foreground">Features</a>
                </li>
                <li>
                  <a href="#faq" className="transition hover:text-foreground">FAQ</a>
                </li>
                <li>
                  <ClientOnly fallback={<span />}>
                    <FooterCta />
                  </ClientOnly>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row">
            <span>© {new Date().getFullYear()} Aptivo</span>
            <span className="font-serif">Built to get you hired.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

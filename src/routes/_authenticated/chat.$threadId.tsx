import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  createThread,
  deleteThread,
  getThread,
  listThreads,
  parseCvText,
  saveCv,
  getCvQuota,
  type CvStructuredType,
} from "@/lib/cv.functions";
import { generateApplication } from "@/lib/generate.functions";
import { ocrPdf } from "@/lib/ocr.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  Lock,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Target,
  Activity,
  User as UserIcon,
  Mail,
  Trash2,
  Upload,
  Copy,
  Check,
  Github,
  Linkedin,
  Globe,
  Download,
} from "lucide-react";
import {
  downloadTailoredCvDocx,
  buildTailoredCvBlocks,
  blocksToPlainText,
  downloadTailoredCvPdf,
  getPreferredExportFormat,
  setPreferredExportFormat,
  verifyExportMatchesPreview,
  type ExportFormat,
  type CvBlock,
} from "@/lib/export-cv";
import {
  useExportHistory,
  recordExport,
  type ExportHistoryEntry,
} from "@/lib/export-history";
import {
  redeemPromoCode,
  listPromoCodes,
  createPromoCode,
  setPromoCodeActive,
  getPromoAdminStats,
} from "@/lib/promo.functions";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Tailored application workspace — Aptivo" },
      {
        name: "description",
        content:
          "Your private Aptivo chat where you paste job descriptions and generate ATS-optimized, tailored applications from your CV.",
      },
      { property: "og:title", content: "Tailored application workspace — Aptivo" },
      {
        property: "og:description",
        content:
          "A private Aptivo thread for one job: paste the description, generate a truthful tailored CV, and export it.",
      },
      // Protected per-user data, never index
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ChatPage,
});

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useServerFn(listThreads);
  const get = useServerFn(getThread);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);
  const parse = useServerFn(parseCvText);
  const save = useServerFn(saveCv);
  const gen = useServerFn(generateApplication);
  const ocr = useServerFn(ocrPdf);
  const quotaFn = useServerFn(getCvQuota);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const quotaQ = useQuery({
    queryKey: ["cv-quota"],
    queryFn: () => quotaFn(),
    staleTime: 30_000,
  });

  const threadQ = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => get({ data: { thread_id: threadId } }),
  });

  const thread = threadQ.data?.thread;
  const messages = (threadQ.data?.messages ?? []) as Message[];
  const hasCv = !!thread?.cv_raw_text && !!thread?.cv_structured;
  const cv = (thread?.cv_structured as CvStructuredType | null) ?? null;

  const [jd, setJd] = useState("");
  const [sending, setSending] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [stage, setStage] = useState<{
    label: string;
    progress: number;
    tone?: "info" | "warn";
  } | null>(null);
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<CvStructuredType | null>(null);
  const [changingCv, setChangingCv] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, sending]);

  useEffect(() => {
    composerRef.current?.focus();
  }, [threadId, hasCv]);

  // Reset the "changing CV" state when switching threads
  useEffect(() => {
    setChangingCv(false);
    setRawText("");
    setDraft(null);
  }, [threadId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    setStage({ label: `Reading ${file.name}…`, progress: 10 });
    try {
      const mod = await import("@/lib/parse-cv.browser");
      try {
        setStage({
          label: isPdf ? "Extracting text from PDF…" : "Extracting text…",
          progress: 40,
        });
        const text = await mod.extractCvText(file);
        setStage({ label: "Text extracted", progress: 100 });
        setRawText(text);
        setDraft(null);
        toast.success("CV text extracted. Preview it, then run extraction.");
      } catch (err) {
        if (err instanceof mod.ScannedPdfError) {
          setStage({
            label: "Scanned PDF detected, running OCR…",
            progress: 60,
            tone: "warn",
          });
          toast.info("Scanned PDF detected, running OCR (this may take a moment)…");
          const { text } = await ocr({
            data: { base64: err.base64, mime: "application/pdf" },
          });
          setStage({ label: "OCR complete", progress: 100 });
          setRawText(text);
          setDraft(null);
          toast.success("OCR complete. Preview the text, then run extraction.");
        } else {
          throw err;
        }
      }
    } catch (err) {
      setStage(null);
      toast.error(err instanceof Error ? err.message : "Could not read file");
    } finally {
      setParsing(false);
      setTimeout(() => setStage(null), 1200);
      e.target.value = "";
    }
  }

  async function handlePasteCv() {
    if (rawText.trim().length < 40) {
      toast.error("Paste your CV text first (at least 40 characters).");
      return;
    }
    setParsing(true);
    setStage({ label: "Structuring your CV with AI…", progress: 50 });
    try {
      const structured = await parse({ data: { raw_text: rawText } });
      setStage({ label: "Extraction complete", progress: 100 });
      setDraft(structured);
    } catch (err) {
      setStage(null);
      toast.error(err instanceof Error ? err.message : "Parsing failed");
    } finally {
      setParsing(false);
      setTimeout(() => setStage(null), 1000);
    }
  }

  async function confirmCv() {
    if (!draft) return;
    try {
      await save({
        data: { thread_id: threadId, raw_text: rawText, structured: draft },
      });
      toast.success("CV saved. Paste a job description to start.");
      setChangingCv(false);
      setDraft(null);
      setRawText("");
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["cv-quota"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function sendJd(rewriteHint?: string) {
    const text = jd.trim();
    if (!rewriteHint && text.length < 20) {
      toast.error("Paste a job description (at least 20 characters).");
      return;
    }
    if (!hasCv) return;
    setSending(true);
    try {
      const lastJd = rewriteHint
        ? [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
        : text;
      await gen({
        data: {
          thread_id: threadId,
          jd_text: lastJd,
          rewrite_hint: rewriteHint,
          is_rewrite: !!rewriteHint,
        },
      });
      if (!rewriteHint) setJd("");
      await qc.invalidateQueries({ queryKey: ["thread", threadId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setSending(false);
    }
  }

  async function newChat(opts?: { reuseCv?: boolean }) {
    try {
      const cloneId =
        opts?.reuseCv && hasCv
          ? threadId
          : (threadsQ.data ?? []).find(
              (t) => (t as { cv_structured: unknown }).cv_structured,
            )?.id;
      const t = await create({
        data: cloneId ? { clone_from_thread_id: cloneId } : undefined,
      });
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
      if (cloneId) toast.success("New chat started with your saved CV.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeThread(id: string) {
    if (!confirm("Delete this chat?")) return;
    try {
      await del({ data: { thread_id: id } });
      const remaining = (threadsQ.data ?? []).filter((t) => t.id !== id);
      await qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["cv-quota"] });
      if (id === threadId) {
        if (remaining[0])
          navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
        else {
          const t = await create();
          navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-background text-foreground">
      <h1 className="sr-only">Tailored application workspace</h1>
      {/* Sidebar */}
      <aside className="flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Target className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="font-serif text-xl">Aptivo</span>
        </Link>
        <button
          onClick={() => newChat()}
          className="mx-4 flex items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
        <button
          onClick={() => {
            if (hasCv && !changingCv) {
              const ok = window.confirm(
                "Replace the CV for this chat?\n\nThe current CV will be overwritten. Existing messages will keep referencing the old CV.",
              );
              if (!ok) return;
              setChangingCv(true);
              toast.info("CV unlocked. Upload or paste a new CV to replace it.");
            } else if (!hasCv) {
              // scroll intake into view; nothing else needed
              scrollRef.current?.scrollTo({ top: 0 });
            } else {
              setChangingCv(false);
            }
          }}
          className="mx-4 mt-2 flex items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          title={hasCv ? (changingCv ? "Cancel changing CV" : "CV is locked for this chat, click to change") : "Upload your CV"}
        >
          {hasCv && !changingCv ? (
            <>
              <Lock className="h-4 w-4" /> CV locked · change
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> {hasCv ? "Cancel change" : "Upload CV"}
            </>
          )}
        </button>

        {/* CV preview */}
        {hasCv && cv && (
          <div className="mx-4 mt-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3 w-3" /> CV preview
            </div>
            <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
              <UserIcon className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">{cv.full_name ?? "Unnamed"}</span>
            </div>
            {cv.email && (
              <div className="mt-1 flex items-center gap-1.5 truncate text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{cv.email}</span>
              </div>
            )}
            {cv.technical_skills && cv.technical_skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {cv.technical_skills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                  >
                    {s}
                  </span>
                ))}
                {cv.technical_skills.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{cv.technical_skills.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Activity / logs panel */}
        <div className="mx-4 mt-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-xs">
          {quotaQ.data && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>CV quota</span>
                <span className="text-foreground">
                  {quotaQ.data.remaining} left ·{" "}
                  <span className="text-muted-foreground">
                    of {quotaQ.data.limit}
                    {quotaQ.data.bonus_remaining > 0
                      ? ` +${quotaQ.data.bonus_remaining} bonus`
                      : ""}
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${
                    quotaQ.data.remaining === 0
                      ? "bg-destructive"
                      : quotaQ.data.remaining <= 2
                        ? "bg-amber-500"
                        : "bg-primary"
                  }`}
                  style={{
                    width: `${(quotaQ.data.used / quotaQ.data.limit) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {quotaQ.data.used}/{quotaQ.data.limit} used this month · resets{" "}
                  {new Date(quotaQ.data.resets_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {quotaQ.data.bonus_granted_total > 0 && (
                  <span title="Promo bonus (never resets)">
                    +{quotaQ.data.bonus_granted_total} promo
                  </span>
                )}
              </div>
              <PromoPanel
                isAdmin={!!quotaQ.data.is_admin}
                email={quotaQ.data.email ?? ""}
              />
            </div>
          )}
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3" /> Activity log
          </div>
          <ActivityLog
            messages={messages}
            hasCv={hasCv}
            changingCv={changingCv}
            sending={sending}
            parsing={parsing}
          />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-2">
          {(threadsQ.data ?? []).map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-1 text-sm ${
                t.id === threadId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 truncate py-1"
              >
                {t.title || "New chat"}
              </Link>
              <button
                onClick={() => removeThread(t.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={signOut}
          className="m-4 flex items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <DeveloperBanner />
      </aside>

      {/* Main */}
      <main className="relative flex h-screen flex-col overflow-hidden">
        <ChatBackdrop />
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {!hasCv || changingCv ? (
              <CvIntake
                rawText={rawText}
                setRawText={setRawText}
                onFile={handleFile}
                parsing={parsing}
                stage={stage}
                onParse={handlePasteCv}
                draft={draft}
                setDraft={setDraft}
                onConfirm={confirmCv}
              />
            ) : (
              <>
                <div className="mb-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  <span className="mr-2 text-primary">●</span>
                  Chatting as{" "}
                  <span className="font-medium text-foreground">
                    {(thread?.cv_structured as CvStructuredType | null)?.full_name ?? "You"}
                  </span>
                  . Paste any job description below.
                </div>
                {messages.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Your CV is loaded. Paste a job description below to generate
                    a tailored, ATS-friendly application.
                  </div>
                )}
                <div className="space-y-6">
                  {messages.map((m, i) => {
                    const prevUser = [...messages.slice(0, i)]
                      .reverse()
                      .find((x) => x.role === "user");
                    const jdPreview = (prevUser?.content ?? "").slice(0, 80);
                    return (
                      <div key={m.id} className="animate-fade-in">
                        <MessageBubble
                          message={m}
                          cv={cv}
                          threadId={threadId}
                          jdPreview={jdPreview}
                        />
                      </div>
                    );
                  })}
                  {sending && (
                    <div className="animate-fade-in space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Tailoring your application…
                      </div>
                      <div className="space-y-2">
                        {[80, 60, 90].map((w, i) => (
                          <div
                            key={i}
                            className="h-3 animate-pulse rounded bg-primary/10"
                            style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {hasCv && !changingCv && (
          <div className="border-t border-border bg-background/80 backdrop-blur">
            <div className="mx-auto max-w-3xl px-6 py-4">
              <ExportHistoryPanel
                threadId={threadId}
                messages={messages}
                cv={cv}
              />
              {messages.some((m) => m.role === "assistant") && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <RewriteChip label="Rewrite" onClick={() => sendJd("Rewrite the previous response with a fresh angle.")} disabled={sending} />
                  <RewriteChip label="More aggressive" onClick={() => sendJd("Make the tone more confident and sales-oriented while staying truthful.")} disabled={sending} />
                  <RewriteChip label="Shorter" onClick={() => sendJd("Keep everything but make each section tighter and more concise.")} disabled={sending} />
                  <RewriteChip label="More keyword-dense" onClick={() => sendJd("Pack more ATS keywords from the JD, without inventing anything.")} disabled={sending} />
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
                <textarea
                  ref={composerRef}
                  rows={2}
                  placeholder="Paste a job description…"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendJd();
                    }
                  }}
                  className="max-h-60 min-h-[52px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => sendJd()}
                  disabled={sending || jd.trim().length < 20}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Generate
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Every response is regenerated from your original CV, never fabricated. ⌘+Enter to send.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RewriteChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
    >
      <RefreshCw className="h-3 w-3" /> {label}
    </button>
  );
}

function ActivityLog({
  messages,
  hasCv,
  changingCv,
  sending,
  parsing,
}: {
  messages: Message[];
  hasCv: boolean;
  changingCv: boolean;
  sending: boolean;
  parsing: boolean;
}) {
  const entries: { time: string; label: string; tone: "info" | "ok" | "warn" }[] = [];
  if (parsing) entries.push({ time: "now", label: "Parsing CV…", tone: "info" });
  if (sending) entries.push({ time: "now", label: "Generating application…", tone: "info" });
  if (changingCv) entries.push({ time: "now", label: "CV unlocked for replacement", tone: "warn" });
  if (hasCv && !changingCv) entries.push({ time: "", label: "CV locked to this chat", tone: "ok" });

  const recent = [...messages].slice(-4).reverse();
  for (const m of recent) {
    entries.push({
      time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      label: m.role === "user" ? "JD received" : "Application generated",
      tone: m.role === "user" ? "info" : "ok",
    });
  }

  if (entries.length === 0) {
    return <div className="text-[11px] text-muted-foreground">No activity yet.</div>;
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((e, i) => (
        <li key={i} className="flex items-start gap-2 text-[11px]">
          <span
            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
              e.tone === "ok"
                ? "bg-primary"
                : e.tone === "warn"
                  ? "bg-amber-500"
                  : "bg-muted-foreground"
            }`}
          />
          <span className="flex-1 text-foreground/80">{e.label}</span>
          {e.time && <span className="text-muted-foreground">{e.time}</span>}
        </li>
      ))}
    </ul>
  );
}

function MessageBubble({
  message,
  cv,
  threadId,
  jdPreview,
}: {
  message: Message;
  cv: CvStructuredType | null;
  threadId: string;
  jdPreview: string;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl border border-border bg-secondary px-4 py-3 text-sm">
        <div className="mb-1 text-xs text-muted-foreground">Job description</div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    );
  }
  const cleaned = sanitizeAssistant(message.content);
  const sections = splitAssistantSections(cleaned);
  const cvBlocks = cv ? buildTailoredCvBlocks(cv, sections) : null;
  // "Copy all" mirrors what the exported .docx contains, so the pasted
  // text and the downloaded CV are always identical.
  const wordAll = cvBlocks
    ? blocksToPlainText(cvBlocks)
    : sections
        .map((s) => `${s.title}\n\n${markdownToWord(s.body)}`)
        .join("\n\n");
  const [preview, setPreview] = useState(false);
  const [format, setFormat] = useState<ExportFormat>(() => getPreferredExportFormat());
  const runDownload = async (f: ExportFormat) => {
    // Match-check: the exporter and the preview both render from cvBlocks,
    // so plain text derived from cvBlocks must equal what "Copy all" shows.
    // A mismatch means a regression forked the render path.
    if (cvBlocks) {
      const check = verifyExportMatchesPreview(cvBlocks, wordAll);
      if (!check.ok) {
        console.warn("[export] preview/copy mismatch", check.diff);
        toast.error(
          "Export preview and copy text drifted, please refresh and try again.",
        );
        return;
      }
    }
    setPreferredExportFormat(f);
    setFormat(f);
    if (f === "pdf") await downloadTailoredCvPdf(cv!, cleaned, sections);
    else await downloadTailoredCvDocx(cv!, cleaned, sections);
    recordExport(threadId, {
      messageId: message.id,
      format: f,
      cvName: cv?.full_name ?? "CV",
      jdPreview,
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="grid h-5 w-5 place-items-center rounded bg-primary text-primary-foreground">
          <Target className="h-3 w-3" strokeWidth={2.5} />
        </div>
        Aptivo · tailored application
        <CopyButton value={wordAll} label="Copy all" className="ml-auto" />
      </div>
      {sections.map((s, i) => (
        <SectionCard key={i} title={s.title} body={s.body} />
      ))}
      {cv && cvBlocks && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreview(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/50"
            >
              <FileText className="h-3.5 w-3.5" /> Preview export
            </button>
            <FormatDownloadButton format="docx" preferred={format} onDownload={runDownload} />
            <FormatDownloadButton format="pdf" preferred={format} onDownload={runDownload} />
            <span className="text-[11px] text-muted-foreground">
              Only summary, skills, and experience bullets change · default: .{format}
            </span>
          </div>
          {preview && (
            <ExportPreviewModal
              cv={cv}
              blocks={cvBlocks}
              previewText={wordAll}
              defaultFormat={format}
              onClose={() => setPreview(false)}
              onDownload={runDownload}
            />
          )}
        </>
      )}
    </div>
  );
}

function FormatDownloadButton({
  format,
  preferred,
  onDownload,
}: {
  format: ExportFormat;
  preferred: ExportFormat;
  onDownload: (f: ExportFormat) => void;
}) {
  const isPrimary = format === preferred;
  const label = format === "pdf" ? "Download .pdf" : "Download .docx";
  return (
    <button
      onClick={() => onDownload(format)}
      className={
        isPrimary
          ? "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          : "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-primary/20"
      }
      title={isPrimary ? "Your saved default format" : `Switch default to .${format}`}
    >
      <Download className="h-3.5 w-3.5" /> {label}
      {isPrimary && <span className="ml-1 text-[10px] opacity-80">(default)</span>}
    </button>
  );
}

function ExportHistoryPanel({
  threadId,
  messages,
  cv,
}: {
  threadId: string;
  messages: Message[];
  cv: CvStructuredType | null;
}) {
  const { entries, clear, remove } = useExportHistory(threadId);
  const [open, setOpen] = useState(true);
  if (!cv || entries.length === 0) return null;

  const redownload = async (entry: ExportHistoryEntry, format?: ExportFormat) => {
    const msg = messages.find((m) => m.id === entry.messageId);
    if (!msg) {
      toast.error("Original response is no longer in this chat.");
      return;
    }
    const cleaned = sanitizeAssistant(msg.content);
    const sections = splitAssistantSections(cleaned);
    const f = format ?? entry.format;
    try {
      if (f === "pdf") await downloadTailoredCvPdf(cv, cleaned, sections);
      else await downloadTailoredCvDocx(cv, cleaned, sections);
      recordExport(threadId, {
        messageId: msg.id,
        format: f,
        cvName: cv.full_name ?? "CV",
        jdPreview: entry.jdPreview,
      });
    } catch (err) {
      console.error("[export-history] re-download failed", err);
      toast.error("Re-download failed. Please try again.");
    }
  };

  const fmtTime = (t: number) => {
    const d = new Date(t);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="mb-3 rounded-xl border border-border bg-card/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground/80 transition hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5 text-primary" />
        Export history
        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
          {entries.length}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="border-t border-border">
          <ul className="max-h-56 divide-y divide-border overflow-y-auto">
            {entries.map((e) => {
              const stillHere = messages.some((m) => m.id === e.messageId);
              const altFormat: ExportFormat = e.format === "pdf" ? "docx" : "pdf";
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-2 px-3 py-2 text-[11px]"
                >
                  <span
                    className={
                      e.format === "pdf"
                        ? "rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-300"
                        : "rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300"
                    }
                  >
                    .{e.format}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground/90">
                      {e.cvName}
                      {e.jdPreview && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {e.jdPreview}
                          {e.jdPreview.length >= 80 ? "…" : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {fmtTime(e.at)}
                      {!stillHere && " · original message removed"}
                    </div>
                  </div>
                  <button
                    disabled={!stillHere}
                    onClick={() => redownload(e)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                    title={`Re-download .${e.format}`}
                  >
                    <Download className="h-3 w-3" /> .{e.format}
                  </button>
                  <button
                    disabled={!stillHere}
                    onClick={() => redownload(e, altFormat)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground/80 transition hover:border-primary/40 hover:text-foreground disabled:opacity-40"
                    title={`Download this response as .${altFormat} instead`}
                  >
                    .{altFormat}
                  </button>
                  <button
                    onClick={() => remove(e.id)}
                    className="rounded-md px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                    title="Remove from history"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end border-t border-border px-3 py-1.5">
            <button
              onClick={clear}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportPreviewModal({
  cv,
  blocks,
  onClose,
  onDownload,
  previewText,
  defaultFormat,
}: {
  cv: CvStructuredType;
  blocks: CvBlock[];
  previewText: string;
  defaultFormat: ExportFormat;
  onClose: () => void;
  onDownload: (f: ExportFormat) => void;
}) {
  const plain = blocksToPlainText(blocks);
  const matches = plain === previewText.trim();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <FileText className="h-4 w-4 text-primary" />
          <div className="font-serif text-lg">Export preview</div>
          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {cv.full_name ?? "CV"}
          </span>
          <span
            className={
              matches
                ? "ml-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400"
                : "ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400"
            }
            title={
              matches
                ? "Preview, download and Copy all render identical text."
                : "Preview and Copy all differ, refresh to resync."
            }
          >
            {matches ? "match ✓" : "mismatch"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <CopyButton value={plain} label="Copy" />
            <button
              onClick={() => onDownload("docx")}
              className={
                defaultFormat === "docx"
                  ? "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                  : "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-primary/20"
              }
            >
              <Download className="h-3.5 w-3.5" /> .docx
            </button>
            <button
              onClick={() => onDownload("pdf")}
              className={
                defaultFormat === "pdf"
                  ? "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                  : "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-primary/20"
              }
            >
              <Download className="h-3.5 w-3.5" /> .pdf
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-background/40 p-6">
          <div className="mx-auto max-w-2xl rounded-lg border border-border bg-[oklch(0.98_0.005_90)] p-8 text-[oklch(0.2_0.02_260)] shadow-md">
            {blocks.map((b, i) => (
              <BlockPreview key={i} block={b} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: CvBlock }) {
  switch (block.kind) {
    case "title":
      return (
        <div className="text-center text-2xl font-bold tracking-tight">
          {block.text}
        </div>
      );
    case "subtitle":
      return (
        <div className="text-center text-sm italic text-[oklch(0.45_0.02_260)]">
          {block.text}
        </div>
      );
    case "contact":
      return (
        <div className="mt-1 text-center text-xs text-[oklch(0.45_0.02_260)]">
          {block.text}
        </div>
      );
    case "heading":
      return (
        <div className="mt-5 mb-2 border-b border-[oklch(0.85_0.01_260)] pb-1 text-[11px] font-bold uppercase tracking-wider">
          {block.text}
        </div>
      );
    case "line":
      return (
        <div className={`text-sm leading-relaxed ${block.bold ? "font-semibold" : ""}`}>
          {block.text}
        </div>
      );
    case "bullet":
      return (
        <div className="ml-4 flex gap-2 text-sm leading-relaxed">
          <span>•</span>
          <span>{block.text}</span>
        </div>
      );
    case "spacer":
      return <div className="h-2" />;
  }
}

type Section = { title: string; body: string };

const SECTION_HEADS = [
  "✅ Eligibility Check",
  "📌 ATS-Friendly Summary",
  "🛠️ Technical Skills",
  "💼 Relevant Experience",
  "🎓 Education & Certifications",
  "✉️ Tailored Cover Letter",
];

function splitAssistantSections(content: string): Section[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  // Build a regex that matches any known heading (with optional leading # markdown)
  const pattern = new RegExp(
    `^\\s*#{0,3}\\s*(${SECTION_HEADS.map((h) =>
      h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ).join("|")})\\s*$`,
    "gm",
  );
  const matches: { title: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    matches.push({ title: m[1], index: m.index, length: m[0].length });
  }
  if (matches.length === 0) return [{ title: "Response", body: text }];
  const out: Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    out.push({ title: matches[i].title, body: text.slice(start, end).trim() });
  }
  return out;
}

function SectionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card px-5 py-4 transition hover:border-primary/40">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
        <CopyButton
          value={`${title}\n\n${markdownToWord(body)}`}
          className="ml-auto"
        />
      </div>
      <div className="prose-aptivo text-sm">
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
    </div>
  );
}

// Convert loose markdown into clean, Word-friendly plain text.
// Removes markdown syntax (bold, italics, headings, backticks), turns
// list markers into "- ", collapses excessive blank lines, and strips
// em/en dashes and smart quotes.
function markdownToWord(md: string): string {
  let s = md.replace(/\r\n/g, "\n");
  // Strip code fences but keep the code
  s = s.replace(/```[\w-]*\n([\s\S]*?)```/g, (_m, code: string) => code);
  // Inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Bold and italics
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/\*(.+?)\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/_(.+?)_/g, "$1");
  // Headings -> plain line
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Links [text](url) -> text (url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // Blockquotes
  s = s.replace(/^\s*>\s?/gm, "");
  // Bullet markers: *, +, • -> "- "
  s = s.replace(/^\s*[*+•]\s+/gm, "- ");
  // Numbered list stays as "1. "
  // Em/en dashes -> hyphen; smart quotes -> straight
  s = s
    .replace(/[—–]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"');
  // Collapse 3+ blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function sanitizeAssistant(text: string): string {
  // Client-side safety net: even if the model slips in em dashes, remove them.
  return text.replace(/\r\n/g, "\n").replace(/[—–]/g, "-");
}

function ChatBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl animate-aptivo-blob-1" />
      <div className="absolute right-[-8rem] top-1/3 h-[440px] w-[440px] rounded-full bg-[oklch(0.55_0.15_270_/_0.18)] blur-3xl animate-aptivo-blob-2" />
      <div className="absolute bottom-[-10rem] left-1/3 h-[520px] w-[520px] rounded-full bg-[oklch(0.75_0.15_180_/_0.14)] blur-3xl animate-aptivo-blob-3" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px] opacity-40" />
    </div>
  );
}

function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
      className={`inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground opacity-70 transition hover:text-foreground hover:opacity-100 ${className}`}
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function DeveloperBanner() {
  return (
    <div className="mx-4 mb-4 rounded-xl border border-sidebar-border bg-gradient-to-br from-primary/10 via-sidebar-accent/40 to-transparent p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Developed by
      </div>
      <div className="mt-0.5 font-serif text-sm text-foreground">
        Rana Ammar Ahmad Khan
      </div>
      <div className="mt-2 flex items-center gap-2">
        <a
          href="https://github.com/ranaammarahmadkhan"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="grid h-7 w-7 place-items-center rounded-md border border-sidebar-border bg-background/40 text-muted-foreground transition hover:text-primary"
        >
          <Github className="h-3.5 w-3.5" />
        </a>
        <a
          href="https://www.linkedin.com/in/ranaammarahmadkhan"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          className="grid h-7 w-7 place-items-center rounded-md border border-sidebar-border bg-background/40 text-muted-foreground transition hover:text-primary"
        >
          <Linkedin className="h-3.5 w-3.5" />
        </a>
        <a
          href="mailto:ranaammarahmadkhan@gmail.com"
          aria-label="Email"
          className="grid h-7 w-7 place-items-center rounded-md border border-sidebar-border bg-background/40 text-muted-foreground transition hover:text-primary"
        >
          <Mail className="h-3.5 w-3.5" />
        </a>
        <a
          href="https://ranaammarahmad.eu.cc/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Website"
          className="grid h-7 w-7 place-items-center rounded-md border border-sidebar-border bg-background/40 text-muted-foreground transition hover:text-primary"
        >
          <Globe className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function CvIntake({
  rawText,
  setRawText,
  onFile,
  parsing,
  stage,
  onParse,
  draft,
  setDraft,
  onConfirm,
}: {
  rawText: string;
  setRawText: (s: string) => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  parsing: boolean;
  stage: { label: string; progress: number; tone?: "info" | "warn" } | null;
  onParse: () => void;
  draft: CvStructuredType | null;
  setDraft: (d: CvStructuredType) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Upload your CV to start.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One CV per chat. We'll extract your details, you confirm, and every
          job description becomes a fresh tailored application.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center transition hover:border-primary">
          <Upload className="h-6 w-6 text-primary" />
          <div className="font-medium">Upload PDF / DOCX / TXT</div>
          <div className="text-xs text-muted-foreground">Parsed in your browser</div>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={onFile}
          />
        </label>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" /> Or paste CV text
          </div>
          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your CV text here…"
            className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={onParse}
            disabled={parsing || rawText.trim().length < 40}
            className="mt-2 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {parsing ? "Extracting…" : "Extract details"}
          </button>
        </div>
      </div>

      {(parsing || stage) && (
        <div className="animate-fade-in rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm">
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Check className="h-4 w-4 text-primary" />
            )}
            <span className={stage?.tone === "warn" ? "text-amber-500" : "text-foreground"}>
              {stage?.label ?? "Reading your CV…"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {stage?.progress ?? 0}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${stage?.progress ?? 10}%` }}
            />
          </div>
        </div>
      )}

      {rawText && !draft && !parsing && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-xl">CV preview</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {rawText.length.toLocaleString()} chars
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Check the extracted text looks right, then run extraction.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/50 p-3 text-xs whitespace-pre-wrap text-foreground/80">
            {rawText}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onParse}
              disabled={parsing || rawText.trim().length < 40}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Extract details
            </button>
            <button
              onClick={() => setRawText("")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {draft && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 font-serif text-2xl">Confirm your details</div>
          <p className="mb-4 text-xs text-muted-foreground">
            Edit anything that looks wrong. These stay with this chat and are
            never fabricated by the AI.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["full_name", "Full name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["address", "Address"],
                ["current_title", "Current title"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs text-muted-foreground">
                {label}
                <input
                  value={(draft[key] as string | null) ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            <EditableTagList
              label={`Technical skills (${draft.technical_skills.length})`}
              values={draft.technical_skills}
              onChange={(v) => setDraft({ ...draft, technical_skills: v })}
              tone="primary"
            />
            <EditableTagList
              label={`Soft skills (${draft.soft_skills.length})`}
              values={draft.soft_skills}
              onChange={(v) => setDraft({ ...draft, soft_skills: v })}
              tone="neutral"
            />
            <EditableWorkList
              value={draft.work_history}
              onChange={(v) => setDraft({ ...draft, work_history: v })}
            />
            <EditableEducationList
              value={draft.education}
              onChange={(v) => setDraft({ ...draft, education: v })}
            />
            <EditableTagList
              label={`Certifications (${draft.certifications.length})`}
              values={draft.certifications}
              onChange={(v) => setDraft({ ...draft, certifications: v })}
              tone="neutral"
            />
          </div>

          <button
            onClick={onConfirm}
            className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Save CV & start tailoring
          </button>
        </div>
      )}
    </div>
  );
}

type WorkItem = CvStructuredType["work_history"][number];
type EduItem = CvStructuredType["education"][number];

function EditableTagList({
  label,
  values,
  onChange,
  tone,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  tone: "primary" | "neutral";
}) {
  const [input, setInput] = useState("");
  const chipClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border bg-background/60 text-foreground/80";
  function add(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !values.includes(s));
    if (parts.length) onChange([...values, ...parts]);
    setInput("");
  }
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${chipClass}`}
          >
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder="Add and press Enter"
          className="flex-1 rounded-md border border-border bg-input px-2.5 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => add(input)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function EditableWorkList({
  value,
  onChange,
}: {
  value: WorkItem[];
  onChange: (v: WorkItem[]) => void;
}) {
  function update(i: number, patch: Partial<WorkItem>) {
    onChange(value.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Work history ({value.length})
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...value,
              { title: "", company: "", location: null, duration: null, summary: null, bullets: [] },
            ])
          }
          className="text-xs text-primary hover:underline"
        >
          + Add role
        </button>
      </div>
      {value.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No roles yet. Add one to include it.
        </div>
      )}
      <ul className="space-y-2">
        {value.map((w, i) => (
          <li
            key={i}
            className="rounded-lg border border-border bg-background/40 p-3 text-xs"
          >
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={w.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Title"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary"
              />
              <input
                value={w.company}
                onChange={(e) => update(i, { company: e.target.value })}
                placeholder="Company"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary"
              />
              <input
                value={w.duration ?? ""}
                onChange={(e) => update(i, { duration: e.target.value })}
                placeholder="Duration e.g. Jan 2022 - Present"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary md:col-span-2"
              />
              <textarea
                rows={2}
                value={w.summary ?? ""}
                onChange={(e) => update(i, { summary: e.target.value })}
                placeholder="Summary or key achievements"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary md:col-span-2"
              />
            </div>
            <div className="mt-1.5 text-right">
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PromoPanel({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const qc = useQueryClient();
  const redeem = useServerFn(redeemPromoCode);
  const listCodes = useServerFn(listPromoCodes);
  const createCode = useServerFn(createPromoCode);
  const toggleCode = useServerFn(setPromoCodeActive);
  const adminStats = useServerFn(getPromoAdminStats);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const codesQ = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => listCodes(),
    enabled: isAdmin && open,
    staleTime: 15_000,
  });

  const statsQ = useQuery({
    queryKey: ["promo-stats"],
    queryFn: () => adminStats(),
    enabled: isAdmin && open,
    staleTime: 15_000,
  });

  const [newCode, setNewCode] = useState("");
  const [newCredits, setNewCredits] = useState(100);
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const onRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setRedeeming(true);
    try {
      const r = await redeem({ data: { code: trimmed } });
      toast.success(`Redeemed! +${r.credits} bonus CV credits added.`);
      setCode("");
      await qc.invalidateQueries({ queryKey: ["cv-quota"] });
      if (isAdmin) await qc.invalidateQueries({ queryKey: ["promo-codes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to redeem promo code.");
    } finally {
      setRedeeming(false);
    }
  };

  const onCreate = async () => {
    const trimmed = newCode.trim();
    if (!trimmed) return;
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(trimmed)) {
      toast.error("Code must be 3–40 letters, numbers, _ or -.");
      return;
    }
    const credits = Number.isFinite(newCredits) && newCredits > 0 ? Math.floor(newCredits) : 100;
    setCreating(true);
    try {
      const r = await createCode({
        data: {
          code: trimmed,
          credits,
          notes: newNotes.trim() || undefined,
        },
      });
      toast.success(`Created ${r.code}`);
      setNewCode("");
      setNewNotes("");
      await qc.invalidateQueries({ queryKey: ["promo-codes"] });
      await qc.invalidateQueries({ queryKey: ["promo-stats"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[promo] createPromoCode failed:", e);
      toast.error(msg || "Failed to create code.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-sidebar-border/70 bg-sidebar-accent/40 p-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80 hover:text-foreground"
      >
        <span className="grid h-4 w-4 place-items-center rounded bg-primary/20 text-primary">%</span>
        Promo code
        {isAdmin && (
          <span className="ml-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-primary">
            admin
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {open ? "hide" : "open"}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wider outline-none focus:border-primary/50"
            />
            <button
              onClick={onRedeem}
              disabled={redeeming || !code.trim()}
              className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              {redeeming ? "…" : "Redeem"}
            </button>
          </div>
          {isAdmin && (
            <div className="mt-2 space-y-2 border-t border-sidebar-border/70 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Create code · {email}
              </div>
              {statsQ.data?.admin && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-1.5 text-[10px] leading-tight">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Overall promo credits</span>
                    <span className="text-primary">
                      {statsQ.data.total_credits_remaining} left
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    {statsQ.data.total_credits_used} used ·{" "}
                    {statsQ.data.total_credits_granted} granted ·{" "}
                    {statsQ.data.total_redemptions} redemptions ·{" "}
                    {statsQ.data.unique_redeemers} users
                  </div>
                  <div className="text-muted-foreground">
                    {statsQ.data.active_codes}/{statsQ.data.total_codes} codes active
                  </div>
                </div>
              )}
              <div className="flex gap-1">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wider outline-none focus:border-primary/50"
                />
                <input
                  type="number"
                  min={1}
                  value={newCredits}
                  onChange={(e) => setNewCredits(parseInt(e.target.value || "0"))}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary/50"
                />
              </div>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary/50"
              />
              <button
                onClick={onCreate}
                disabled={creating || !newCode.trim()}
                className="w-full rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create promo code"}
              </button>
              {codesQ.data?.admin && codesQ.data.codes && codesQ.data.codes.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto pt-1">
                  {codesQ.data.codes.map((c) => (
                    <li
                      key={c.code}
                      className="flex items-center gap-1 rounded border border-border/60 bg-background/50 px-1.5 py-1 text-[10px]"
                    >
                      <span className="font-mono font-semibold text-foreground">
                        {c.code}
                      </span>
                      <span className="text-primary">+{c.credits}</span>
                      <span className="ml-auto text-muted-foreground">
                        {c.redemptions} used
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            await toggleCode({
                              data: { code: c.code, active: !c.active },
                            });
                            await qc.invalidateQueries({ queryKey: ["promo-codes"] });
                            await qc.invalidateQueries({ queryKey: ["promo-stats"] });
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Failed to update code.",
                            );
                          }
                        }}
                        className={
                          c.active
                            ? "rounded px-1.5 py-0.5 text-[9px] text-emerald-400 hover:bg-emerald-500/10"
                            : "rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-muted"
                        }
                      >
                        {c.active ? "on" : "off"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableEducationList({
  value,
  onChange,
}: {
  value: EduItem[];
  onChange: (v: EduItem[]) => void;
}) {
  function update(i: number, patch: Partial<EduItem>) {
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Education ({value.length})
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([...value, { degree: "", institution: "", location: null, year: null, details: null }])
          }
          className="text-xs text-primary hover:underline"
        >
          + Add entry
        </button>
      </div>
      {value.length === 0 && (
        <div className="text-xs text-muted-foreground">No entries yet.</div>
      )}
      <ul className="space-y-2">
        {value.map((e, i) => (
          <li
            key={i}
            className="rounded-lg border border-border bg-background/40 p-2.5 text-xs"
          >
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={e.degree}
                onChange={(ev) => update(i, { degree: ev.target.value })}
                placeholder="Degree"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary md:col-span-2"
              />
              <input
                value={e.year ?? ""}
                onChange={(ev) => update(i, { year: ev.target.value })}
                placeholder="Year"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary"
              />
              <input
                value={e.institution}
                onChange={(ev) => update(i, { institution: ev.target.value })}
                placeholder="Institution"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs outline-none focus:border-primary md:col-span-3"
              />
            </div>
            <div className="mt-1.5 text-right">
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createThread, listThreads } from "@/lib/cv.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Your workspace — Aptivo" },
      {
        name: "description",
        content:
          "Open your Aptivo workspace to tailor CVs, generate applications, and manage your saved chats.",
      },
      { property: "og:title", content: "Your Aptivo workspace" },
      {
        property: "og:description",
        content: "Manage your tailored CVs and job-application chats inside Aptivo.",
      },
      { property: "og:url", content: "https://aptivoco.eu.cc/app" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://aptivoco.eu.cc/app" }],
  }),
  component: AppEntry,
});

function AppEntry() {
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);

  useEffect(() => {
    (async () => {
      try {
        const threads = await list();
        if (threads && threads.length > 0) {
          navigate({ to: "/chat/$threadId", params: { threadId: threads[0].id } });
        } else {
          const t = await create();
          navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [list, create, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
      Loading Aptivo…
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { SubtitleEditor } from "@/subtitle/SubtitleEditor";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Fabric Subtitle Editor — Animated Caption Preview" },
      {
        name: "description",
        content:
          "Modern word-by-word animated subtitle editor built with React, TypeScript and Fabric.js.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(45_100%_55%)] to-[hsl(15_100%_55%)] shadow-lg" />
            <div>
              <h1 className="text-base font-semibold leading-none">Caption Studio</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Word-level animated subtitle editor
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground hidden md:block">
            React · TypeScript · Fabric.js
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-6 py-8">
        <SubtitleEditor />
      </section>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/app/StudioShell";

export const Route = createFileRoute("/")({
  component: StudioShell,
  head: () => ({
    meta: [
      { title: "Captionly — Subtitle Spotting Studio" },
      {
        name: "description",
        content:
          "Type subtitle lines against your video, spot their timings, and style animated captions.",
      },
    ],
  }),
});

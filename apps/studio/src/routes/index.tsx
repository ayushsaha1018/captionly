import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/app/StudioShell";

export const Route = createFileRoute("/")({
  component: StudioShell,
});

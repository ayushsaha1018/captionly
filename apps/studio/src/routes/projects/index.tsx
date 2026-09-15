import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/auth/authClient";
import { ProjectDashboard } from "@/app/ProjectDashboard";

export const Route = createFileRoute("/projects/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/" });
  }, [isPending, session, navigate]);

  if (isPending || !session) return null;

  return <ProjectDashboard />;
}

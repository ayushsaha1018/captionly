import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/auth/authClient";
import { ProjectEditor } from "@/app/ProjectEditor";

export const Route = createFileRoute("/projects/$projectId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/" });
  }, [isPending, session, navigate]);

  if (isPending || !session) return null;

  return <ProjectEditor projectId={projectId} />;
}

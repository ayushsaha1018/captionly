import { useState } from "react";
import { signInWithGoogle } from "@/auth/authClient";
import { StudioShell } from "./StudioShell";

export function LandingGate() {
  const [guest, setGuest] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  if (guest) return <StudioShell />;

  return (
    <div className="grid min-h-screen place-items-center bg-void px-4 text-ink">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Captionly</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Sign in to save projects to the cloud and keep versioned snapshots of your work. Or jump
            straight in without an account.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              setSigningIn(true);
              void signInWithGoogle(`${window.location.origin}/projects`).finally(() =>
                setSigningIn(false),
              );
            }}
            disabled={signingIn}
            className="w-full rounded-md bg-edit px-4 py-2 text-sm font-semibold text-void
                       transition-transform hover:scale-[1.01] active:scale-95
                       disabled:pointer-events-none disabled:opacity-50"
          >
            {signingIn ? "Opening Google sign-in…" : "Sign in with Google"}
          </button>
          <button
            onClick={() => setGuest(true)}
            className="w-full rounded-md border border-hairline px-4 py-2 text-sm font-medium
                       text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}

import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/auth",
  fetchOptions: { credentials: "include" },
});

export const { useSession, signOut } = authClient;

export function signInWithGoogle(callbackURL: string) {
  return authClient.signIn.social({ provider: "google", callbackURL });
}

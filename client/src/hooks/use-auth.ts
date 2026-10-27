import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

/**
 * The session probe gates the entire app. It can hang (~30s observed on a cold server)
 * and then silently resolve to `null`, which used to render the marketing landing page at
 * whatever URL the learner was on — indistinguishable from being logged out. Bound the
 * request, retry once, and expose the failure so the UI can say "couldn't verify session".
 */
const AUTH_TIMEOUT_MS = 10_000;

export class AuthCheckError extends Error {}

async function fetchUser(): Promise<User | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch("/api/auth/user", {
      credentials: "include",
      signal: controller.signal,
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new AuthCheckError(`${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as User;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new AuthCheckError("Session check timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function logout(): Promise<void> {
  // POST + client-side redirect. Never navigate to an /api/ URL: the service
  // worker serves cached index.html for navigations, which both shows a 404 and
  // (worse) leaves the session alive.
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    window.location.replace("/");
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError, error, refetch, isFetching } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: 1,
    retryDelay: 1200,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    /** Session probe failed (timeout / 5xx) — NOT the same thing as being signed out. */
    isError,
    error,
    retry: refetch,
    isRetrying: isFetching,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Fingerprint, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProviderInfo = {
  google: boolean;
  passkeys: boolean;
  email: { configured: boolean; provider: string };
};

function browserSupportsPasskeys(): boolean {
  return typeof window !== "undefined" && typeof (window as any).PublicKeyCredential !== "undefined";
}

export function AuthPage({
  nextPath,
  initialMode = "login",
}: {
  nextPath?: string | null;
  initialMode?: "login" | "register";
}) {
  // Where to go after a successful sign-in: the page the visitor originally asked for.
  const postAuthDestination = nextPath && nextPath.startsWith("/") ? nextPath : "/";
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [adminResetUrl, setAdminResetUrl] = useState("");
  const [providers, setProviders] = useState<ProviderInfo>({
    google: false,
    passkeys: browserSupportsPasskeys(),
    email: { configured: true, provider: "unknown" },
  });
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setProviders({ google: !!d.google, passkeys: !!d.passkeys, email: d.email });
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setError(
        authError === "google_not_configured"
          ? "Google sign-in isn't enabled on this deployment yet."
          : `Sign-in failed (${authError}). Try a password or passkey instead.`,
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Something went wrong");
          setLoading(false);
          return;
        }
        setForgotSent(true);
        if (data.adminResetUrl) {
          setAdminResetUrl(data.adminResetUrl);
        } else if (data.delivery === "failed") {
          setInfo(
            "The reset email could not be delivered by this deployment's mail provider. Contact the site admin.",
          );
        } else {
          setInfo(data.message || "");
        }
        setLoading(false);
        return;
      }

      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: any = { email, password };
      if (mode === "register") {
        body.firstName = firstName;
        body.lastName = lastName;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Authentication failed");
        setLoading(false);
        return;
      }

      window.location.href = postAuthDestination;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setPasskeyLoading(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined }),
        credentials: "include",
      });
      if (!optRes.ok) {
        const d = await optRes.json().catch(() => ({}));
        throw new Error(d.message || "Could not start passkey sign-in");
      }
      const options = await optRes.json();
      const response = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
        credentials: "include",
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json().catch(() => ({}));
        throw new Error(d.message || "Passkey sign-in failed");
      }
      window.location.href = postAuthDestination;
    } catch (err: any) {
      setError(err?.message || "Passkey sign-in failed");
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring" aria-label="Synapse home">
            <div className="p-2 rounded-md bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Synapse</span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground rounded-md min-h-9 px-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </a>
        </div>
      </header>

      <main className="px-4 py-12 md:py-20">
        <div className="max-w-md mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="p-6">
              {nextPath && (
                <div
                  className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
                  data-testid="signin-required-banner"
                >
                  Sign in to open <span className="font-mono text-xs break-all">{nextPath}</span>
                </div>
              )}
              <h1 className="text-2xl font-bold mb-4 text-center">
                {mode === "login" ? "Welcome Back" : mode === "register" ? "Create Account" : "Reset Password"}
              </h1>
              {mode === "forgot" && forgotSent ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent a
                    password reset link. Check your inbox (and spam folder) — the link expires in 1 hour.
                  </p>
                  {adminResetUrl && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left space-y-2">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Email delivery is not configured on this deployment. Admin reset link:
                      </p>
                      <a href={adminResetUrl} className="text-xs break-all text-primary underline">
                        {adminResetUrl}
                      </a>
                    </div>
                  )}
                  {info && !adminResetUrl && <p className="text-xs text-muted-foreground">{info}</p>}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMode("login");
                      setForgotSent(false);
                      setAdminResetUrl("");
                      setInfo("");
                    }}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="username"
                    />
                  </div>
                  {mode !== "forgot" && (
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                      />
                    </div>
                  )}
                  {mode === "login" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setForgotSent(false);
                          setError("");
                          setInfo("");
                        }}
                        className="text-sm text-primary hover:underline inline-flex items-center min-h-6 px-1 -mx-1"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  {mode === "register" && (
                    <>
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jane"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                        />
                      </div>
                    </>
                  )}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === "login" ? "Log In" : mode === "register" ? "Create Account" : "Send Reset Link"}
                  </Button>
                </form>
              )}

              {mode !== "forgot" && (providers.google || providers.passkeys) && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {providers.google && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        window.location.href = "/api/auth/google/start";
                      }}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.8c2.2-2 3.7-5 3.7-8.8Z" />
                        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.8-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.5v3.1A12 12 0 0 0 12 24Z" />
                        <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.5a12 12 0 0 0 0 10.8l3.9-3.1Z" />
                        <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.5 6.6l3.9 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
                      </svg>
                      Continue with Google
                    </Button>
                  )}
                  {providers.passkeys && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={passkeyLoading}
                      onClick={handlePasskeyLogin}
                    >
                      {passkeyLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Fingerprint className="mr-2 h-4 w-4" />
                      )}
                      Sign in with a passkey
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-4 text-center text-sm">
                {mode === "login" ? (
                  <span>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="text-primary hover:underline inline-flex items-center min-h-6 px-1 -mx-1"
                    >
                      Sign up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-primary hover:underline inline-flex items-center min-h-6 px-1 -mx-1"
                    >
                      Log in
                    </button>
                  </span>
                )}
              </div>
            </Card>
          </motion.div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Courses are yours: AI features run on your own provider keys (BYOC), never someone else's compute.
          </p>
        </div>
      </main>
    </div>
  );
}

export default AuthPage;

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Fingerprint, Loader2, Trash2, Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PasskeyRow {
  id: number;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iOS/i.test(ua)) return "Apple device";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android device";
  if (/Windows/i.test(ua)) return "Windows device";
  if (/Linux/i.test(ua)) return "Linux device";
  return "Passkey";
}

export function PasskeySettings() {
  const { toast } = useToast();
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof (window as any).PublicKeyCredential !== "undefined");
  }, []);

  const { data: passkeys, isLoading } = useQuery<PasskeyRow[]>({
    queryKey: ["/api/auth/passkeys"],
    enabled: supported,
  });

  const register = useMutation({
    mutationFn: async () => {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await apiRequest("POST", "/api/auth/passkey/register/options", {});
      const options = await optRes.json();
      const response = await startRegistration({ optionsJSON: options });
      const verifyRes = await apiRequest("POST", "/api/auth/passkey/register/verify", {
        response,
        deviceLabel: deviceLabel(),
      });
      return verifyRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/passkeys"] });
      toast({
        title: "Passkey added",
        description: "Next time you can sign in with Face ID, Touch ID, or Windows Hello.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not add passkey",
        description: err?.message || "The browser cancelled or the device is not supported.",
        variant: "destructive",
      });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/auth/passkeys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/passkeys"] });
      toast({ title: "Passkey removed" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-primary" />
          <CardTitle>Sign-in security</CardTitle>
        </div>
        <CardDescription>
          Add a passkey to sign in with Face ID, Touch ID, a hardware security key, or your device PIN —
          no password to type or leak.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported ? (
          <p className="text-sm text-muted-foreground">
            This browser does not support passkeys. Use a current Chrome, Safari, Edge, or Firefox.
          </p>
        ) : (
          <>
            <Button onClick={() => register.mutate()} disabled={register.isPending}>
              {register.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add a passkey
            </Button>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !passkeys || passkeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No passkeys yet on this account.</p>
            ) : (
              <ul className="space-y-2">
                {passkeys.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                      <span className="font-medium">{p.deviceLabel || "Passkey"}</span>
                      <Badge variant="secondary" className="text-xs">
                        added {new Date(p.createdAt).toLocaleDateString()}
                      </Badge>
                      {p.lastUsedAt && (
                        <span className="text-xs text-muted-foreground">
                          last used {new Date(p.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(p.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

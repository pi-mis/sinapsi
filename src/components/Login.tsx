import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) toast.error("Non sono riuscito a inviare il link. Riprova.");
    else setSent(true);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Accesso con Google non riuscito.");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-glow/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="label-mono">Cervello digitale</div>
        <h1 className="mt-3 text-4xl font-extralight leading-tight text-foreground">
          Ogni idea, <span className="text-glow">una luce</span>.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Accedi per entrare nel tuo cervello.</p>

        {sent ? (
          <p className="glass mt-8 rounded-xl p-4 text-sm text-foreground">
            Controlla la posta: ti ho inviato un link per entrare.
          </p>
        ) : (
          <form onSubmit={sendLink} className="mt-8 space-y-3">
            <Input
              type="email"
              required
              placeholder="la-tua@email.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-card"
            />
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? "Invio…" : "Inviami il link"}
            </Button>
          </form>
        )}
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" onClick={google} className="h-11 w-full bg-transparent">
          Continua con Google
        </Button>
      </div>
    </main>
  );
}

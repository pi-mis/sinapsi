import { useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { LangSwitch } from "./LangSwitch";

/**
 * Shown to accounts whose email is not verified yet: Sinapsi only opens for real
 * addresses. (With "Auto-confirm email" off in Lovable Cloud, unverified users
 * cannot even sign in; this screen is the second line of defence.)
 */
export function VerifyEmail({ session }: { session: Session }) {
  const [busy, setBusy] = useState(false);
  const t = useT();
  const email = session.user.email ?? "";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mb-4 flex justify-end">
          <LangSwitch />
        </div>
        <MailCheck className="mx-auto size-10 text-glow" />
        <h1 className="mt-4 text-2xl font-light">{t("Conferma la tua email")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("Ti ho mandato un link a")} <b className="text-foreground">{email}</b>.{" "}
          {t(
            "Aprilo per attivare l’account: serve solo la prima volta, poi entri con email e password.",
          )}
        </p>
        <div className="mt-6 space-y-2">
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await supabase.auth.resend({
                type: "signup",
                email,
                options: { emailRedirectTo: window.location.origin },
              });
              setBusy(false);
              if (error)
                toast.error(t("Non sono riuscito a rinviare il link. Riprova tra un minuto."));
              else toast.success(t("Link inviato di nuovo: controlla anche lo spam."));
            }}
          >
            {t("Rinvia il link")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => void supabase.auth.signOut()}>
            {t("Usa un’altra email")}
          </Button>
        </div>
      </div>
    </main>
  );
}

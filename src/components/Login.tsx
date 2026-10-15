import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildDemoGraph } from "@/graph/demo";
import { getLang, useLang, useT } from "@/i18n";
import { LangSwitch } from "./LangSwitch";

const GraphScene = lazy(() => import("@/graph/GraphScene"));
const noop = () => {};
const NO_COMMAND = { action: "reset", tick: 0 } as const;

type Mode = "signin" | "signup" | "link";

/**
 * Sign-in. Sessions are kept on the device (localStorage), so after the first
 * access the app opens directly. Password is the default so a phone never
 * depends on opening an email link in the right browser.
 */
export function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reduced, setReduced] = useState(false);
  const t = useT();
  const lang = useLang();
  const demo = useMemo(() => buildDemoGraph(lang), [lang]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "link") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw new Error(t("Non sono riuscito a inviare il link. Riprova."));
        setNotice(
          t("Controlla la posta: ti ho inviato un link per entrare. Aprilo su questo dispositivo."),
        );
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error)
          throw new Error(
            error.message.toLowerCase().includes("confirm")
              ? t(
                  "Prima conferma l'indirizzo email con il link che ti ho inviato (controlla anche lo spam).",
                )
              : t(
                  "Email o password non corrette. Se finora entravi con il link, entra con il link e imposta una password dal menu.",
                ),
          );
      } else {
        if (password.length < 8) throw new Error(t("Scegli una password di almeno 8 caratteri."));
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { lang: getLang() } },
        });
        if (error) throw new Error(t("Non sono riuscito a creare l'account. Riprova."));
        if (data.user && data.user.identities?.length === 0)
          setNotice(
            t(
              "Esiste già un account con questa email: entra con il link, poi imposta una password dal menu ⋯.",
            ),
          );
        else if (!data.session)
          setNotice(
            t(
              "Quasi fatto! Ti ho inviato un link a {email}: aprilo per attivare l'account (controlla anche lo spam), poi entra con email e password. Serve solo la prima volta.",
              { email },
            ),
          );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error(t("Accesso con Google non riuscito."));
  };

  const field = "h-12 bg-card/80 text-base backdrop-blur sm:text-sm";
  return (
    <main className="relative flex min-h-dvh items-end justify-center overflow-hidden bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:items-center lg:justify-start lg:pl-[8vw]">
      <Suspense fallback={null}>
        <GraphScene
          ambient
          className="absolute inset-x-0 top-0 bottom-[50%] sm:bottom-0 lg:left-[32%]"
          data={demo}
          quality={0}
          reducedMotion={reduced}
          selectedId={null}
          onSelect={noop}
          command={NO_COMMAND}
          mode="orbit"
          highlighted={null}
        />
      </Suspense>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent sm:bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_80%)] sm:opacity-70 lg:bg-gradient-to-r lg:from-background lg:via-background/20 lg:to-transparent lg:opacity-100" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-background/60 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="label-mono">Sinapsi</div>
          <LangSwitch />
        </div>
        <h1 className="mt-2 text-3xl font-extralight leading-tight text-foreground sm:mt-3 sm:text-4xl">
          {t("Ogni idea,")} <span className="text-glow">{t("una luce")}</span>.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:mt-3">
          {t("Il tuo cervello digitale. Resterai collegato su questo dispositivo.")}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3 sm:mt-7">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder={t("la-tua@email.it")}
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          {mode !== "link" && (
            <Input
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? t("Scegli una password") : "Password"}
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          )}
          <Button type="submit" disabled={busy} className="h-12 w-full text-base sm:text-sm">
            {busy
              ? t("Un momento…")
              : mode === "signin"
                ? t("Entra")
                : mode === "signup"
                  ? t("Crea account")
                  : t("Inviami il link")}
          </Button>
        </form>
        {notice && (
          <p className="mt-4 rounded-lg border border-border bg-card/70 p-3 text-sm text-foreground">
            {notice}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          {mode === "signin" ? (
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => setMode("signup")}
            >
              {t("Nuovo qui? Crea un account")}
            </button>
          ) : (
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => setMode("signin")}
            >
              {t("Entra con la password")}
            </button>
          )}
          {mode !== "link" && (
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              onClick={() => setMode("link")}
            >
              {t("Preferisci un link via email?")}
            </button>
          )}
        </div>

        <div className="my-4 flex items-center gap-3 sm:my-5 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("o")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          variant="outline"
          onClick={google}
          className="h-12 w-full bg-transparent text-base sm:text-sm"
        >
          {t("Continua con Google")}
        </Button>
      </div>
    </main>
  );
}
